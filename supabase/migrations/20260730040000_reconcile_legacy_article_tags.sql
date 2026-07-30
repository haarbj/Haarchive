-- Legacy cleanup: article_tag_options was seeded from scratch, but four
-- existing articles/drafts already carried free-text tags from before this
-- feature existed. Reconciling each one individually rather than leaving
-- them silently unrecognized by the new picker:
--
-- Clear synonyms of an already-seeded tag get normalized onto it (so the
-- tag-filter links on /articles actually group them together, instead of
-- "aerobic base" and "aerobic fitness" silently splitting the same topic
-- into two dead-end filters):
--   "mental performance"  -> "sports psychology"  (The Onus to Quit)
--   "aerobic fitness"     -> "aerobic base"        (Why Running Is Valuable for Everyone)
--   "health & longevity"  -> "longevity"           (Why Running Is Valuable for Everyone)
--
-- Everything else names a real, distinct topic this site actually covers
-- and just wasn't in the initial seed list -- added to the library rather
-- than force-fit onto an existing tag that doesn't quite mean the same
-- thing:
--   "athlete identity", "burnout", "running philosophy"  (The Onus to Quit)
--   "long runs"                                           (The High Carb Revolution)
--   "running benefits", "exercise science"                (Why Running Is Valuable for Everyone)

insert into public.article_tag_options (name) values
  ('athlete identity'),
  ('burnout'),
  ('running philosophy'),
  ('long runs'),
  ('running benefits'),
  ('exercise science')
on conflict (name) do nothing;

update public.articles
set tags = array_replace(tags, 'mental performance', 'sports psychology')
where id = '840f9bca-11a0-4b85-be44-ff48e7080979';

update public.articles
set tags = array_replace(array_replace(tags, 'aerobic fitness', 'aerobic base'), 'health & longevity', 'longevity')
where id = '42ec3953-5b39-486f-8f4e-b58923a1c9df';
