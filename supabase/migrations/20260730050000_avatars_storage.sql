-- Mirrors article-images' own setup exactly (see that migration's own
-- comment): public bucket, since profiles.avatar_url renders on public
-- pages (contributor/community profile pages, article bylines) with no
-- auth required. No storage.objects RLS policy -- every upload goes
-- through uploadAvatarImage, a service-role-mediated server action that
-- only checks "is this your own account", not a stricter permission; the
-- bucket being public simply can't be written to from the browser
-- directly regardless.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  8388608, -- 8 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;
