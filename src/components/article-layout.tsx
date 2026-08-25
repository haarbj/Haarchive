import Link from "next/link";

import {
  categories,
  getAdjacentSections,
  sectionMap,
  EXPLORE_DOMAIN_SLUGS,
  type Category,
  type ContentBlock,
  type Section,
} from "@/lib/sections";
import { headingId } from "@/lib/heading-id";
import { countTopLevelSections, estimateReadingMinutes } from "@/lib/reading-time";
import type { PublicCitation } from "@/lib/articles/citations";
import type { ArticleAttribution } from "@/lib/articles/attribution";
import type { PublishedArticleListItem } from "@/lib/articles/list";
import { ArticleCitations } from "@/components/article-citations";
import { ArticleOverview } from "@/components/article-overview";
import { ChapterNav } from "@/components/chapter-nav";
import { ContentBlocks } from "@/components/content-blocks";
import { ContinueReading } from "@/components/continue-reading";
import { QuestionsCta } from "@/components/questions-cta";
import { ReadingProgressBar } from "@/components/reading-progress-bar";
import { TableOfContents, type TocHeading } from "@/components/table-of-contents";
import { logLearningEvent } from "@/app/learning-actions";
import { getKnowledgeCheckForTopic } from "@/app/knowledge-check-actions";
import { getBookmarkStatus } from "@/app/bookmark-actions";
import { conceptAnchorsForTopic } from "@/lib/mastery/concept-anchors";
import { KnowledgeCheck } from "@/components/learning/knowledge-check";
import { LearningProgressTeaser } from "@/components/learning/learning-progress-teaser";

type ArticleLayoutProps = {
  section: Section;
  category: Category;
  content: ContentBlock[];
  // Only set for database-backed articles (see [slug]/page.tsx) -- undefined
  // for every Foundations page. Title/subtitle/cover-image/byline for that
  // case are ArticleHero's job now (rendered by the page before this
  // component even runs) -- this only uses attribution's presence to know
  // to skip ArticleOverview, which ArticleHero already supersedes.
  attribution?: ArticleAttribution;
  // Same DB-backed-only scope as attribution -- Foundations pages cite
  // sources inline in prose instead (see sections.ts).
  citations?: PublicCitation[];
  // Same DB-backed-only scope again. Rendered here (before ArticleNotes, see
  // that block's own comment), not inside ArticleHero -- the hero is text
  // only (eyebrow/title/subtitle/credits); the cover image, if the article
  // has one, comes right after the reader has seen the title, as an
  // editorial artifact in its own right rather than a backdrop behind the
  // title. An article with no cover image renders nothing extra here -- no
  // manufactured empty media block.
  coverImageUrl?: string | null;
  // Same DB-backed-only scope again -- see selectRelatedArticles in
  // lib/articles/list.ts for how these are chosen (existing article data
  // only, no invented metadata). Renders as "Continue Reading" near the
  // end of the page, right after Sources.
  relatedArticles?: PublishedArticleListItem[];
};

// Extracted from the isArticle branch of [slug]/page.tsx -- the sticky
// TOC/prose grid mechanics here are real layout logic (not just a width),
// so this stays its own component rather than a Container variant. The
// grid structure (TOC and #article-content as direct siblings in one grid
// row) is load-bearing: it's what makes the sticky sidebar stop naturally
// at the article's bottom edge instead of overflowing into the footer --
// see table-of-contents.tsx's own comment. Don't add a wrapping div around
// either grid child.
export async function ArticleLayout({
  section,
  category,
  content,
  attribution,
  citations,
  coverImageUrl,
  relatedArticles,
}: ArticleLayoutProps) {
  const headings: TocHeading[] = content
    .filter((block) => block.type === "heading")
    .map((block) => ({
      id: headingId(block.text),
      text: block.text,
      level: block.level ?? 2,
    }));

  // "Articles" (the Library category, slug "archive" -- both the
  // hand-written essays and contributor-authored pieces from
  // /contribute/articles) read as personal, essay-style writing, not
  // structured technical reference -- no in-page jump-to-section nav, no
  // matter how many headings they have. Other library/domain pages keep it.
  const showToc = headings.length > 0 && category.slug !== "archive";

  // An essay/article is reached by drilling into the "Articles" index page
  // (sections.ts' own articleSlugs list, or -- for a DB-backed article,
  // signaled by `attribution` being set -- the published-article fallback
  // in [slug]/page.tsx), never directly off the raw "Library" category
  // landing page. That landing page also lists unrelated peer pages
  // (Resources, Contact) that must keep their real category breadcrumb, so
  // this only overrides for actual Articles-index members.
  const isArticleIndexMember = !!sectionMap.get("articles")?.articleSlugs?.includes(section.slug);
  const breadcrumbCategory =
    category.slug === "archive" && isArticleIndexMember
      ? { slug: "articles", title: sectionMap.get("articles")?.title ?? "Articles" }
      : category;

  const { prev, next } = getAdjacentSections(section.slug);
  const conceptAnchors = conceptAnchorsForTopic(section.slug);
  // null on the ~36 topics with no curated questions yet -- renders
  // nothing below, no empty card, no layout footprint (see
  // knowledge-check-actions.ts's own comment on why this is the common case).
  // Phase 5.1 audit fix: these two were previously awaited sequentially --
  // two independent Supabase round-trips back-to-back on every single
  // article page load, the hottest read path in the app. They don't
  // depend on each other, so Promise.all halves that latency.
  // Bookmark status is only fetched here for a Foundations page (rendered
  // into ArticleOverview below) -- a DB article's Save/Notes now render
  // inline in ArticleHero instead, which [slug]/page.tsx already fetches
  // this same status for directly, so fetching it again here for that case
  // would just be a second, redundant round-trip for a value nothing in
  // this component would even use.
  const [knowledgeCheck, initialBookmarked] = await Promise.all([
    getKnowledgeCheckForTopic(section.slug),
    attribution ? Promise.resolve(false) : getBookmarkStatus(section.slug),
  ]);

  return (
    <>
      {/* A Server Component can only pass a "use server" reference (or a
          .bind() of one) as a prop to a Client Component -- not an arbitrary
          closure -- so every learning signal below is wired this way rather
          than an inline arrow function. logLearningEvent no-ops silently if
          section.slug isn't a recognized learning Topic. onConceptSeen's
          .bind() pre-fills contentSlug/eventType only, leaving conceptSlug
          (logLearningEvent's 3rd, trailing argument) to be supplied by
          ReadingProgressBar at call time. */}
      <ReadingProgressBar
        targetId="article-content"
        onView={logLearningEvent.bind(null, section.slug, "content_viewed")}
        onDeepScroll={logLearningEvent.bind(null, section.slug, "content_engaged")}
        conceptAnchors={conceptAnchors}
        onConceptSeen={logLearningEvent.bind(null, section.slug, "concept_engaged")}
      />

      {!attribution ? (
        <ArticleOverview
          category={breadcrumbCategory}
          title={section.title}
          readingMinutes={estimateReadingMinutes(content)}
          sectionCount={countTopLevelSections(content)}
          lastUpdated={section.lastUpdated}
          hasKnowledgeCheck={!!knowledgeCheck}
          contentSlug={section.slug}
          content={content}
          initialBookmarked={initialBookmarked}
        />
      ) : null}

      {coverImageUrl ? (
        // Plain <img>, not ImageSlot -- an arbitrary contributor-uploaded
        // URL, not a local curated asset (see CLAUDE.md's image-handling
        // section). No gradient, no overlaid text, no border -- an
        // editorial photograph sitting on the page, not a UI card. Save/Notes
        // no longer render as a separate row here -- a DB article's live
        // inline in ArticleHero's own eyebrow line above (see that
        // component), a Foundations page's live inline in ArticleOverview's
        // breadcrumb line above -- so the image now sits directly below
        // whichever of those two headers this page actually has.
        <div className="mt-8 overflow-hidden rounded-card">
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded/external URL, not a local/optimized asset */}
          <img src={coverImageUrl} alt="" className="aspect-video w-full object-cover" />
        </div>
      ) : null}

      {/* mt-8, not the tighter mt-4 this used when a separate Save/Notes row
          used to sit directly above this grid -- now the previous sibling
          is either the cover image or the header itself, so this needs the
          same breathing room as every other major transition on the page.
          xl:pr-[var(--notes-reserved-width)] narrows this grid's own
          available width while the desktop Notes panel is open
          (article-notes.tsx sets the variable directly on <html>, since the
          panel is a fixed overlay and can't otherwise be reached from a
          sibling like this). Zero by default, so this is a no-op everywhere
          the panel isn't open. */}
      <div
        className={
          showToc
            ? "mt-8 xl:pr-[var(--notes-reserved-width)] lg:grid lg:grid-cols-[220px_1fr] lg:gap-12"
            : "mt-8 xl:pr-[var(--notes-reserved-width)]"
        }
      >
        {showToc ? <TableOfContents headings={headings} /> : null}

        <div
          id="article-content"
          className="max-w-article-prose space-y-6 text-lg leading-8 text-zinc-600 dark:text-zinc-300"
        >
          <ContentBlocks content={content} sectionSlug={section.slug} />
          <ArticleCitations citations={citations ?? []} />
        </div>
      </div>

      {/* Right before Continue Reading -- the archive's own invitation to
          contribute comes first in the end-of-article cluster, then the
          archive itself takes over (related pieces, the four domains).
          Renders for Foundations pages too (this sits outside the
          attribution-only block below), just with nothing DB-article-only
          following it in that case. */}
      <QuestionsCta sourceSectionSlug={section.slug} />

      {attribution ? (
        <>
          <ContinueReading articles={relatedArticles ?? []} />
          {/* "Continue Exploring" -- plain text links to the four domains,
              not a giant CTA card. The archive itself is the CTA. */}
          <div className="mt-16 border-t border-black/10 pt-10 dark:border-white/10">
            <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
              Continue Exploring
            </p>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
              {categories
                .filter((c) => EXPLORE_DOMAIN_SLUGS.includes(c.slug))
                .map((domain) => (
                  <Link
                    key={domain.slug}
                    href={`/${domain.slug}`}
                    className="font-serif text-lg font-medium tracking-tight text-zinc-900 hover:underline dark:text-white"
                  >
                    {domain.title}
                  </Link>
                ))}
            </div>
          </div>
        </>
      ) : null}

      {knowledgeCheck ? (
        <div className="mt-10">
          <KnowledgeCheck question={knowledgeCheck} topicTitle={section.title} topicSlug={section.slug} />
        </div>
      ) : null}

      {/* Chapter wayfinding, then the account/product nudge last and
          quietest -- see learning-progress-teaser.tsx's own comment on why
          it's no longer a Card. Renders nothing at all for an
          authenticated visitor (see its own authStatus guard). */}
      <ChapterNav prev={prev} next={next} />
      <LearningProgressTeaser />
    </>
  );
}
