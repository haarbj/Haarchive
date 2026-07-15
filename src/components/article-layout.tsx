import Link from "next/link";

import { getAdjacentSections, sectionMap, type Category, type ContentBlock, type Section } from "@/lib/sections";
import { headingId } from "@/lib/heading-id";
import { countTopLevelSections, estimateReadingMinutes } from "@/lib/reading-time";
import { linkifyContent } from "@/lib/linkify";
import { ArticleByline, type ArticleAttribution } from "@/components/article-byline";
import { ArticleOverview } from "@/components/article-overview";
import { ChapterNav } from "@/components/chapter-nav";
import { ContentCallout } from "@/components/content-callout";
import { PullQuote } from "@/components/pull-quote";
import { QuestionsCta } from "@/components/questions-cta";
import { ReadingProgressBar } from "@/components/reading-progress-bar";
import { TableOfContents, type TocHeading } from "@/components/table-of-contents";

type ArticleLayoutProps = {
  section: Section;
  category: Category;
  content: ContentBlock[];
  // Only set for database-backed articles (see [slug]/page.tsx) -- undefined
  // for every Foundations page, which renders identically to before.
  attribution?: ArticleAttribution;
};

// Extracted from the isArticle branch of [slug]/page.tsx -- the sticky
// TOC/prose grid mechanics here are real layout logic (not just a width),
// so this stays its own component rather than a Container variant. The
// grid structure (TOC and #article-content as direct siblings in one grid
// row) is load-bearing: it's what makes the sticky sidebar stop naturally
// at the article's bottom edge instead of overflowing into the footer --
// see table-of-contents.tsx's own comment. Don't add a wrapping div around
// either grid child.
export function ArticleLayout({ section, category, content, attribution }: ArticleLayoutProps) {
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
    category.slug === "writing-and-resources" && (isArticleIndexMember || !!attribution)
      ? { slug: "articles", title: sectionMap.get("articles")?.title ?? "Articles" }
      : category;

  const { prev, next } = getAdjacentSections(section.slug);

  // Threaded through every block on this render so a glossary term only
  // gets auto-linked once across the whole article, not every time it's
  // mentioned. Created fresh per request -- never shared across renders.
  const linkedTermIds = new Set<string>();

  return (
    <>
      <ReadingProgressBar targetId="article-content" />

      <ArticleOverview
        category={breadcrumbCategory}
        title={section.title}
        readingMinutes={estimateReadingMinutes(content)}
        sectionCount={countTopLevelSections(content)}
        lastUpdated={section.lastUpdated}
      />

      {attribution ? <ArticleByline {...attribution} /> : null}

      <div className={showToc ? "mt-10 lg:grid lg:grid-cols-[220px_1fr] lg:gap-12" : "mt-10"}>
        {showToc ? <TableOfContents headings={headings} /> : null}

        <div
          id="article-content"
          className="max-w-article-prose space-y-6 text-lg leading-8 text-zinc-600 dark:text-zinc-300"
        >
          {content.map((block, index) => {
            if (block.type === "heading") {
              const level = block.level ?? 2;
              return level === 3 ? (
                <h3
                  key={index}
                  id={headingId(block.text)}
                  className="scroll-mt-24 pt-4 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white"
                >
                  {block.text}
                </h3>
              ) : (
                <h2
                  key={index}
                  id={headingId(block.text)}
                  className="scroll-mt-24 border-t border-black/5 pt-8 text-2xl font-semibold tracking-tight text-zinc-900 first:border-t-0 first:pt-0 dark:border-white/10 dark:text-white"
                >
                  {block.text}
                </h2>
              );
            }
            if (block.type === "list") {
              return (
                <ul key={index} className="space-y-3">
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>• {linkifyContent(item, section.slug, linkedTermIds)}</li>
                  ))}
                </ul>
              );
            }
            if (block.type === "quote") {
              return <PullQuote key={index} text={block.text} attribution={block.attribution} />;
            }
            if (block.type === "image") {
              return (
                <figure key={index}>
                  {/* Arbitrary contributor-pasted URL, not a local/optimized asset -- see contributor-profile-form.tsx */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={block.url}
                    alt={block.alt ?? ""}
                    className="w-full rounded-card border border-black/10 dark:border-white/10"
                  />
                  {block.caption ? (
                    <figcaption className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {block.caption}
                    </figcaption>
                  ) : null}
                </figure>
              );
            }
            if (block.type === "callout") {
              return (
                <ContentCallout
                  key={index}
                  variant={block.variant}
                  title={block.title}
                  text={block.text ? linkifyContent(block.text, section.slug, linkedTermIds) : undefined}
                  items={block.items?.map((item) => linkifyContent(item, section.slug, linkedTermIds))}
                  collapsed={block.collapsed}
                />
              );
            }
            return (
              <p key={index}>
                {linkifyContent(block.text, section.slug, linkedTermIds)}
                {block.linkHref && block.linkText ? (
                  <>
                    {" "}
                    <Link
                      href={block.linkHref}
                      className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
                    >
                      {block.linkText}
                    </Link>
                    .
                  </>
                ) : null}
              </p>
            );
          })}
        </div>
      </div>

      <ChapterNav prev={prev} next={next} />
      <QuestionsCta sourceSectionSlug={section.slug} />
    </>
  );
}
