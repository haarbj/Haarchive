-- "Fueling Fridays" -- a recurring editorial series, not a topic tag (the
-- existing 'fueling' tag already covers the topic). Series identity is
-- deliberately just this tag plus a subtitle convention ("Fueling
-- Fridays #N: ...") on each article -- no new series table/column, since
-- articles.tags + the existing related-article tag-scoring
-- (selectRelatedArticles) already give a series page everything it needs
-- (filter by ?tag=fueling+fridays) without a schema change.
insert into public.article_tag_options (name) values
  ('fueling fridays')
on conflict (name) do nothing;
