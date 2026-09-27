#!/usr/bin/env -S npx tsx
// One-time loader for "Carbohydrate Absorption and Delivery", Fueling
// Fridays #1 -- see scripts/data/fueling-fridays-1.ts for the actual
// article content, citations, and this article's own header comment on
// what was and wasn't verified. Not run in CI -- a documented, manually-
// invoked script (see audit-knowledge-checks.ts / seed-canyon-program.ts
// for this repo's own convention).
//
// Writes via a service-role client, not a Server Action: a standalone
// script has no request-scoped session/cookies to call one with. Can't
// import createServiceRoleClient from src/lib/db/service-role.ts as-is
// (starts with `import "server-only"`, which throws unconditionally under
// plain Node/tsx -- see src/lib/knowledge-checks/db.ts's own identical
// comment) -- constructs the identical client inline instead.
//
// Seeds to status 'draft': nothing here is publicly visible under RLS
// until a coach deliberately reviews it (via /contribute/articles/[id]/
// preview, which renders through the same ContentBlocks component the
// live page uses) and transitions it to 'published' themselves.
//
// Usage:
//   npm run seed:fueling-fridays-1 -- --author-email=brody@example.com

import { createClient } from "@supabase/supabase-js";
import { ARTICLE_TITLE, ARTICLE_SUBTITLE, ARTICLE_TAGS, CITATIONS, CONTENT } from "./data/fueling-fridays-1";

function createServiceRoleClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveAuthorIdByEmail(admin: ReturnType<typeof createServiceRoleClient>, email: string): Promise<string> {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (!data.nextPage) break;
    page = data.nextPage;
  }
  throw new Error(`No user found with email ${email}`);
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const emailArg = process.argv.find((a) => a.startsWith("--author-email="));
  if (!emailArg) {
    console.error("Usage: npm run seed:fueling-fridays-1 -- --author-email=you@example.com");
    process.exit(1);
  }
  const email = emailArg.split("=")[1];

  const admin = createServiceRoleClient();
  const authorId = await resolveAuthorIdByEmail(admin, email);
  console.log(`Resolved author ${email} -> ${authorId}`);

  const slug = slugify(ARTICLE_TITLE);
  const { data: existing } = await admin.from("articles").select("id").eq("slug", slug).maybeSingle();
  if (existing) {
    console.error(`An article with slug "${slug}" already exists (id ${existing.id}) -- delete it first if you want to reseed.`);
    process.exit(1);
  }

  const { data: article, error: articleError } = await admin
    .from("articles")
    .insert({
      slug,
      title: ARTICLE_TITLE,
      subtitle: ARTICLE_SUBTITLE,
      article_type: "article",
      evidence_category: "mixed_evidence",
      tags: ARTICLE_TAGS,
      content: CONTENT,
      status: "draft",
      primary_author_id: authorId,
    })
    .select("id")
    .single();
  if (articleError) throw new Error(`articles insert failed: ${articleError.message}`);
  const articleId = article.id as string;
  console.log(`Created article ${articleId} (slug: ${slug}, status: draft)`);

  // Inserted sequentially (not one bulk insert) so each row's created_at
  // is genuinely distinct -- see loadArticleCitations' own ordering
  // comment on why the numbered Sources list depends on real insertion
  // order, matching the article body's own [n] markers.
  let citationCount = 0;
  for (const citation of CITATIONS) {
    const { error } = await admin.from("article_citations").insert({
      article_id: articleId,
      paper_title: citation.paperTitle,
      authors: citation.authors,
      year: citation.year,
      link_or_doi: citation.linkOrDoi,
      submitted_by: authorId,
    });
    if (error) throw new Error(`article_citations insert failed (${citation.paperTitle}): ${error.message}`);
    citationCount += 1;
  }
  console.log(`Inserted ${citationCount} citations.`);

  console.log(`Done. Review at /contribute/articles/${articleId}/preview`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
