-- Storage for contributor-uploaded article images (e.g. a photo taken by
-- the author with no existing URL). Public bucket: articles render on
-- public /[slug] routes with no auth, so images need to be fetchable
-- without a session -- matches cover_image_url/avatar_url already being
-- plain public URLs elsewhere in this app.
--
-- No storage.objects RLS policy is added for inserts: every upload goes
-- through uploadArticleImage (a service-role-mediated server action that
-- checks content_contributor/admin itself), the same "app-level check,
-- not RLS" precedent already used for articles/article_contributors writes.
-- Service-role bypasses RLS entirely, so a public bucket with zero object
-- policies simply can't be written to from the browser directly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'article-images',
  'article-images',
  true,
  8388608, -- 8 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;
