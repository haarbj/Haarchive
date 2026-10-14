-- Private 1-on-1 coaching: image attachments on coach<->athlete messages.
--
-- Unlike the existing avatars/article-images buckets (both deliberately
-- public -- they render on public pages with no auth), a message image is
-- private conversation content and needs the same real access boundary
-- everything else in this feature has. So, unlike those two:
--
--   1. The bucket is NOT public.
--   2. There IS a real storage.objects RLS policy (not just an app-layer
--      check at upload time) -- reads need to survive on their own merit,
--      the same "RLS is the actual boundary, app checks are defense in
--      depth" rule the rest of private coaching follows. Object paths are
--      "{coach_athlete_id}/{uuid}.{ext}", so the policy can check
--      participancy directly off the path's first folder segment without
--      a second lookup table.
--
-- Uploads still go through a service-role-mediated Server Action
-- (uploadMessageImage, mirroring uploadAvatarImage's shape) that verifies
-- the caller is a participant before writing -- there's no
-- storage.objects INSERT policy for `authenticated`, same as the existing
-- two buckets, since nothing ever needs to upload directly from the
-- browser.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-images',
  'message-images',
  false,
  8388608, -- 8 MB, matching avatars/article-images
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "message_images_select_participant" on storage.objects
  for select to authenticated using (
    bucket_id = 'message-images'
    and exists (
      select 1 from public.coach_athletes ca
      where ca.id::text = (storage.foldername(name))[1]
        and ca.status = 'active'
        and ((select auth.uid()) = ca.coach_id or (select auth.uid()) = ca.athlete_id)
    )
  );

-- body stays the primary content, but a message can now be image-only
-- (a coach sending a photo with no caption) -- the check constraint is the
-- real guard against a genuinely empty message (no text AND no image),
-- not just relying on sendCoachAthleteMessage's own app-layer validation.
alter table public.coach_athlete_messages alter column body drop not null;
alter table public.coach_athlete_messages add column image_path text;
alter table public.coach_athlete_messages add constraint coach_athlete_messages_has_content
  check (body is not null or image_path is not null);

-- image_path needs the same column-level protection body/coach_athlete_id
-- already have (20260825030000's own revoke/grant) -- covered for free:
-- that migration's `revoke update on ... from authenticated` already
-- applies to every column including this new one, and its narrow
-- `grant update (read_at) ...` was never widened, so image_path stays
-- exactly as immutable-after-send as body already is.
