import { getAdjacentSections, sectionMap, type Category, type ContentBlock, type Section } from "@/lib/sections";
import { headingId } from "@/lib/heading-id";
import { countTopLevelSections, estimateReadingMinutes } from "@/lib/reading-time";
import type { PublicCitation } from "@/lib/articles/citations";
import type { ArticleAttribution } from "@/lib/articles/attribution";
import { ArticleCitations } from "@/components/article-citations";
import { ArticleOverview } from "@/components/article-overview";
import { ArticleNotes } from "@/components/notes/article-notes";
import { ChapterNav } from "@/components/chapter-nav";
import { ContentBlocks } from "@/components/content-blocks";
import { QuestionsCta } from "@/components/questions-cta";
import { ReadingProgressBar } from "@/components/reading-progress-bar";
import { TableOfContents, type TocHeading } from "@/components/table-of-contents";
import { logLearningEvent } from "@/app/learning-actions";
import { getKnowledgeCheckForTopic } from "@/app/knowledge-check-actions";
import { getBookmarkStatus } from "@/app/bookmark-actions";
import { conceptAnchorsForTopic } from "@/lib/mastery/concept-anchors";
import { KnowledgeCheck } from "@/components/learning/knowledge-check";

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
};

// Extracted from the isArticle branch of [slug]/page.tsx -- the sticky
// TOC/prose grid mechanics here are real layout logic (not just a width),
// so this stays its own component rather than a Container variant. The
// grid structure (TOC and #article-content as direct siblings in one grid
// row) is load-bearing: it's what makes the sticky sidebar stop naturally
// at the article's bottom edge instead of overflowing into the footer --
// see table-of-contents.tsx's own comment. Don't add a wrapping div around
// either grid child.
export async function ArticleLayout({ section, category, content, attribution, citations }: ArticleLayoutProps) {
  const headings: TocHeading[] = content
    .filter((block) => block.type === "heading")
    .map((block) => ({
      id: headingId(block.text),
      text: block.text,
      level: block.level ?? 2,
    }));

  // "Articles" (the writing-and-resources category -- both the hand-written
  // essays and contributor-authored pieces from /contribute/articles) read
  // as personal, essay-style writing, not structured technical reference --
  // no in-page jump-to-section nav, no matter how many headings they have.
  // Foundations pages keep it.
  const showToc = headings.length > 0 && category.slug !== "writing-and-resources";

  // An essay/article is reached by drilling into the "Articles" index page
  // (sections.ts' own articleSlugs list, or -- for a DB-backed article,
  // signaled by `attribution` being set -- the published-article fallback
  // in [slug]/page.tsx), never directly off the raw "Writing & Resources"
  // category landing page. That landing page also lists unrelated peer
  // pages (Resources, Contact) that must keep their real category
  // breadcrumb, so this only overrides for actual Articles-index members.
  const isArticleIndexMember = !!sectionMap.get("articles")?.articleSlugs?.includes(section.slug);
  const breadcrumbCategory =
    category.slug === "writing-and-resources" && isArticleIndexMember
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
  const [knowledgeCheck, initialBookmarked] = await Promise.all([
    getKnowledgeCheckForTopic(section.slug),
    getBookmarkStatus(section.slug),
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
        />
      ) : null}

      {/* Its own sibling, not wrapped around the TOC/content grid below (see
          that grid's own comment on why not to add a wrapping div there) --
          this only needs to sit above it, and reading notes apply the same
          way whether or not this particular page happens to have a TOC. */}
      <div className="mt-8">
        <ArticleNotes contentSlug={section.slug} content={content} initialBookmarked={initialBookmarked} />
      </div>

      {/* xl:pr-[var(--notes-reserved-width)] narrows this grid's own available
          width while the desktop Notes panel is open (article-notes.tsx sets
          the variable directly on <html>, since the panel is a fixed overlay
          and can't otherwise be reached from a sibling like this). Zero by
          default, so this is a no-op everywhere the panel isn't open. */}
      <div
        className={
          showToc
            ? "mt-4 xl:pr-[var(--notes-reserved-width)] lg:grid lg:grid-cols-[220px_1fr] lg:gap-12"
            : "mt-4 xl:pr-[var(--notes-reserved-width)]"
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

      {knowledgeCheck ? (
        <div className="mt-10">
          <KnowledgeCheck question={knowledgeCheck} topicTitle={section.title} />
        </div>
      ) : null}

      <ChapterNav prev={prev} next={next} />
      <QuestionsCta sourceSectionSlug={section.slug} />
    </>
  );
}
