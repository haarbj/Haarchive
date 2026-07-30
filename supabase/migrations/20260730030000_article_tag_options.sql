-- A fixed, admin-managed library of tags -- replaces free-text tag entry
-- in the article editor (which allowed typo/synonym drift: "heart rate"
-- vs "Heart-Rate" vs "hr" all meaning the same thing). articles.tags stays
-- exactly as it was (a plain text[] column); this is just the list of
-- values the editor is allowed to offer, enforced again server-side in
-- createArticleDraft/updateArticleDraft, not just by the picker UI.
--
-- Removing an option here only affects what the editor offers going
-- forward -- it does not strip that tag from articles that already carry
-- it, matching how removing a contributor_role option elsewhere never
-- retroactively edits existing rows.
--
-- No RLS policies: every read is service-role-mediated, from the article
-- editor (contributor-authenticated) and the admin management page --
-- matching coach_invites' precedent.
create table public.article_tag_options (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.article_tag_options enable row level security;

insert into public.article_tag_options (name) values
  ('heart rate'), ('longevity'), ('adaptation'), ('aerobic base'), ('vo2 max'),
  ('lactate threshold'), ('marathon'), ('half marathon'), ('5k'), ('10k'),
  ('recovery'), ('injury prevention'), ('nutrition'), ('fueling'), ('hydration'),
  ('sleep'), ('sports psychology'), ('motivation'), ('periodization'), ('strength training'),
  ('cross training'), ('race strategy'), ('pacing'), ('heat training'), ('altitude training'),
  ('youth running'), ('masters running'), ('female athletes'), ('coaching philosophy'), ('training plans')
on conflict (name) do nothing;
