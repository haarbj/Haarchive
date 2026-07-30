-- Reverses part of the "citations are internal-only" decision from the
-- content_suggestions migration: per-article citations (article_id set)
-- should actually render as a Sources list on the published article, so
-- they need to be publicly readable once that article is published --
-- same shape as article_contributors_select_published. Standalone citation
-- suggestions (article_id null, reviewed via /admin/suggestions) stay fully
-- locked: the article_id is not null guard means this policy can never
-- match them, and no other select policy exists for that path.
create policy "article_citations_select_published" on public.article_citations
  for select to public using (
    article_id is not null
    and exists (
      select 1 from public.articles
      where articles.id = article_citations.article_id and articles.status = 'published'
    )
  );
