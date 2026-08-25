import type { Metadata } from "next";
import type { ComponentType } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  categories,
  categoryMap,
  sectionMap,
  sections,
  sectionsInCategory,
  EXPLORE_DOMAIN_SLUGS,
  type Category,
  type Section,
} from "@/lib/sections";
import { createClient } from "@/lib/db/server";
import { canonicalUrl } from "@/lib/canonical";
import { mapArticleRow, type ArticleRow } from "@/lib/articles/map-row";
import { buildArticleAttribution, type ArticleAttribution } from "@/lib/articles/attribution";
import { ARTICLE_TYPE_LABELS, type ArticleType } from "@/lib/articles/constants";
import { mapPublicCitationRow, type PublicCitation } from "@/lib/articles/citations";
import { loadPublishedArticleList, selectRelatedArticles } from "@/lib/articles/list";
import { getBookmarkStatus } from "@/app/bookmark-actions";
import type { Article } from "@/lib/articles/types";
import { formatDate, titleCase } from "@/lib/format";
import { estimateReadingMinutes } from "@/lib/reading-time";
import { ContactPage } from "@/components/contact-page";
import { CoachingLibraryHome } from "@/components/coaches/coaching-library-home";
import { AthleteLibraryHome } from "@/components/athletes/athlete-library-home";
import { EnvironmentalCalculator } from "@/components/environmental-calculator";
import { GapCalculator } from "@/components/gap-calculator";
import { PacePercentCalculator } from "@/components/pace-percent-calculator";
import { CvThresholdCalculator } from "@/components/cv-threshold-calculator";
import { RacePaceCalculator } from "@/components/race-pace-calculator";
import { HrThresholdCalculator } from "@/components/hr-threshold-calculator";
import { TinmanCalculator } from "@/components/tinman-calculator";
import { MarathonPacingCalculator } from "@/components/marathon-pacing-calculator";
import { AltitudeCalculator } from "@/components/altitude-calculator";
import { TrainingPlansHome } from "@/components/training-plans/training-plans-home";
import { HeatTracker } from "@/components/heat-tracker";
import { PaceCalculator } from "@/components/pace-calculator";
import { TrainingPhilosophyPage } from "@/components/training-philosophy-page";
import { ArticleHero } from "@/components/article-hero";
import { ArticleLayout } from "@/components/article-layout";
import { CATEGORY_VISUALS } from "@/lib/category-visuals";
import { TOOL_CATEGORY_LABELS, TOOL_CATEGORY_ORDER, TOOL_VISUALS, TOOLS_GUIDE_SLUG } from "@/lib/tool-visuals";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

// Sections with a dedicated interactive component render that instead of
// the generic "Planned Topics" list. Add future tools as another entry here.
const sectionTools: Record<string, ComponentType> = {
  "heat-tracker": HeatTracker,
  "pace-calculator": PaceCalculator,
  "environmental-calculator": EnvironmentalCalculator,
  "gap-calculator": GapCalculator,
  "pace-percent-calculator": PacePercentCalculator,
  "cv-threshold-calculator": CvThresholdCalculator,
  "race-pace-calculator": RacePaceCalculator,
  "hr-threshold-calculator": HrThresholdCalculator,
  "tinman-calculator": TinmanCalculator,
  "marathon-pacing-calculator": MarathonPacingCalculator,
  "altitude-calculator": AltitudeCalculator,
  "training-plans": TrainingPlansHome,
  contact: ContactPage,
  "training-philosophy": TrainingPhilosophyPage,
  "coaching-library": CoachingLibraryHome,
  "athlete-library": AthleteLibraryHome,
};

type SectionPageProps = {
  params: Promise<{ slug: string }>;
  // Only meaningful on the "articles" index (see the tag pill links on each
  // card) -- every other section ignores it.
  searchParams: Promise<{ tag?: string }>;
};

export function generateStaticParams() {
  const sectionSlugs = sections.map((section: Section) => ({
    slug: section.slug,
  }));
  const categorySlugs = categories.map((category: Category) => ({
    slug: category.slug,
  }));
  return [...sectionSlugs, ...categorySlugs];
}

// A published, database-backed contributor article -- the counterpart to
// Foundations' sectionMap/categoryMap, for any slug that isn't one of
// those. Uses the RLS-scoped client (not service-role): articles_select_
// published is a public policy, exactly like questions_select_visible.
async function loadPublishedArticle(slug: string): Promise<Article | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle<ArticleRow>();
  if (!data) return null;
  return mapArticleRow(data);
}

async function loadArticleAttribution(article: Article): Promise<ArticleAttribution> {
  const supabase = await createClient();
  const { data: contributors } = await supabase
    .from("article_contributors")
    .select("user_id, contributor_role, title_override")
    .eq("article_id", article.id)
    .returns<{ user_id: string; contributor_role: string; title_override: string | null }[]>();

  const userIds = (contributors ?? []).map((c) => c.user_id);
  if (userIds.length === 0) {
    return buildArticleAttribution([], [], [], article.primaryAuthorId, article.publishedAt, article.evidenceCategory);
  }

  const [{ data: profiles }, { data: contributorProfiles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", userIds)
      .returns<{ id: string; display_name: string; avatar_url: string | null }[]>(),
    supabase
      .from("contributor_profiles")
      .select("user_id, title")
      .in("user_id", userIds)
      .returns<{ user_id: string; title: string | null }[]>(),
  ]);

  return buildArticleAttribution(
    contributors ?? [],
    profiles ?? [],
    contributorProfiles ?? [],
    article.primaryAuthorId,
    article.publishedAt,
    article.evidenceCategory,
  );
}

// Narrow column list on purpose -- never selects notes/status/admin_notes/
// submitted_by, which are internal editorial fields (see the
// content_suggestions migration's own reasoning) and shouldn't reach a
// public page even server-side. Relies on article_citations_select_
// published (articles.sql's public-read migration) to scope this to the
// current published article; RLS itself is what stops a draft's citations
// from leaking here.
async function loadArticleCitations(articleId: string): Promise<PublicCitation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("article_citations")
    .select("id, paper_title, authors, year, link_or_doi")
    .eq("article_id", articleId)
    .returns<{ id: string; paper_title: string; authors: string | null; year: number | null; link_or_doi: string | null }[]>();
  return (data ?? []).map(mapPublicCitationRow);
}

export async function generateMetadata({
  params,
  searchParams,
}: SectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { tag: activeTag } = await searchParams;
  const section = sectionMap.get(slug);
  const category = categoryMap.get(slug);
  const entry = section ?? category;

  // A `?tag=` filtered view (only the "articles" index actually uses this,
  // but the rule is harmless and correct for any slug) is a subset of its
  // own base page's content, not a distinct page -- it never gets its own
  // canonical, and never gets indexed separately, regardless of which
  // section it's on. The canonical below already points back to the clean
  // `/${slug}` URL either way; this adds the stronger, explicit signal on
  // top of it. See docs/seo-audit.md section 6.
  const tagFilterRobots: Pick<Metadata, "robots"> = activeTag
    ? { robots: { index: false, follow: true } }
    : {};

  if (entry) {
    return {
      title: entry.title,
      description: entry.mission,
      ...canonicalUrl(`/${slug}`),
      ...tagFilterRobots,
      openGraph: {
        title: entry.title,
        description: entry.mission,
        images: ["/opengraph-image.png"],
      },
      twitter: {
        card: "summary_large_image",
        title: entry.title,
        description: entry.mission,
        images: ["/opengraph-image.png"],
      },
    };
  }

  // A DB-backed article: share-link previews should show its own cover
  // photo and title, not the generic sitewide fallback -- og:type
  // "article" plus publishedTime is the standard signal link-preview
  // consumers (iMessage, Slack, Twitter/X) key off for an article-style
  // card instead of a plain website link.
  const article = await loadPublishedArticle(slug);
  if (!article) return {};

  const ogImage = article.coverImageUrl ?? "/opengraph-image.png";
  const description = article.subtitle ?? "";

  return {
    title: article.title,
    description,
    ...canonicalUrl(`/${slug}`),
    openGraph: {
      type: "article",
      title: article.title,
      description,
      images: [ogImage],
      publishedTime: article.publishedAt ?? undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: [ogImage],
    },
  };
}

export default async function SectionPage({ params, searchParams }: SectionPageProps) {
  const { slug } = await params;
  const { tag: activeTag } = await searchParams;
  const section = sectionMap.get(slug);
  const category = categoryMap.get(slug);

  // Category landing page
  if (category) {
    const members = sectionsInCategory(category.slug);
    const categoryVisual = CATEGORY_VISUALS[category.slug];
    // Tools is the one category whose members are interactive calculators
    // with real per-instrument identity (TOOL_VISUALS: an icon, an accent,
    // and now a category of its own -- see that file's own header comment
    // for how "pacing/environment/physiology" was derived from what the
    // tools themselves actually do, not invented from scratch). It gets
    // its own rendering path below -- grouped by that category, icon-led,
    // no numbering -- rather than being forced through the plain numbered
    // index every reading category uses, since a flat "01, 02, 03..." over
    // an unrelated grab-bag of calculators isn't a real discovery aid the
    // way it is over an author's own ordered table of contents.
    const hasToolVisuals = members.some((member) => TOOL_VISUALS[member.slug]);
    // The one genuine exception on Tools: "Choosing a Pace Calculator" is
    // editorial guidance about the tools, not a tool itself (see
    // TOOLS_GUIDE_SLUG's own comment in tool-visuals.ts) -- rendered
    // separately, above the categorized index, as its own "Start Here"
    // entry rather than a 12th tool row.
    const toolsGuide = hasToolVisuals ? members.find((member) => member.slug === TOOLS_GUIDE_SLUG) : undefined;
    // Row pairs for the plain numbered index below (non-Tools categories
    // only): chunked so a hairline rule can span the full width beneath
    // each pair (not per-column), matching the article pages' own divide-y
    // list convention. Numbering stays sequential across the whole list
    // (01, 02, 03...) regardless of which column an entry lands in.
    const memberRows: Section[][] = [];
    for (let i = 0; i < members.length; i += 2) memberRows.push(members.slice(i, i + 2));
    // Same "the archive itself is the CTA" closer article pages already
    // end on (article-layout.tsx's own Continue Exploring), reused here
    // for the same reason: a real, useful next step rather than dead
    // space, which matters most for a short category like Philosophy (3
    // sections) that would otherwise leave a large empty region above the
    // footer. Excludes the category the reader is already on.
    const exploreOtherDomains = categories.filter(
      (c) => EXPLORE_DOMAIN_SLUGS.includes(c.slug) && c.slug !== category.slug,
    );

    return (
      <Container variant="content">
        <BackLink href="/">Back to home</BackLink>
        {categoryVisual ? (
          <span
            aria-hidden="true"
            className="mt-8 mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundImage: `linear-gradient(135deg, ${categoryVisual.accentFrom}26, ${categoryVisual.accentTo}40)` }}
          >
            <categoryVisual.icon aria-hidden="true" strokeWidth={1.5} className="h-6 w-6" style={{ color: categoryVisual.accentFrom }} />
          </span>
        ) : null}
        <Heading>
          {category.title}
        </Heading>
        {/* max-w-[66ch], not the wider max-w-3xl this used -- matches the
            reading measure already established everywhere else (article
            prose, sectionProseClass) rather than a wider, dashboard-scale
            paragraph. */}
        <p className="mt-6 max-w-[66ch] text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          {category.mission}
        </p>

        {hasToolVisuals ? (
          <>
            {toolsGuide ? (
              // Deliberately different visual language from every tool row
              // below: font-serif at the same text-2xl scale ContentBlocks
              // gives a real in-article h2 (not text-xl, the tool-title
              // size) -- a reader shouldn't need to read the fine print to
              // tell this apart from the 11 real tools underneath it; the
              // title's own scale should already say "this is guidance,"
              // not just its typeface. No icon (nothing here should look
              // like a calculator it isn't), no number, "Read the guide"
              // rather than "Open tool."
              <div className="mt-12 border-t border-black/10 pt-10 dark:border-white/10">
                <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
                  Start Here
                </p>
                <Link href={`/${toolsGuide.slug}`} className="group mt-6 block">
                  <h2 className="font-serif text-2xl font-medium tracking-tight text-zinc-900 group-hover:underline dark:text-white">
                    {toolsGuide.title}
                  </h2>
                  <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-300">{toolsGuide.mission}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Read the guide
                    <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                      →
                    </span>
                  </span>
                </Link>
              </div>
            ) : null}
            {/* Tools: grouped by TOOL_VISUALS' own category (pacing/
                environment/physiology, in that fixed order), icon-led, no
                numbering -- each tool's own icon is a real semantic cue (a
                thermometer for heat, a mountain for grade), not decoration,
                so it stays; an arbitrary "07" never told a reader anything
                and is gone. Category label uses the exact same eyebrow/rule
                rhythm as "Continue Exploring" below -- first:mt-12 only
                matters when there's no guide above it (the guide already
                carries its own mt-12 when present, so the first category
                correctly falls back to the later mt-16 rhythm instead). */}
            {TOOL_CATEGORY_ORDER.map((toolCategory) => {
              const categoryMembers = members.filter((member) => TOOL_VISUALS[member.slug]?.category === toolCategory);
              if (categoryMembers.length === 0) return null;
              const categoryRows: Section[][] = [];
              for (let i = 0; i < categoryMembers.length; i += 2) categoryRows.push(categoryMembers.slice(i, i + 2));
              // A category that's just one tool (Physiology today) doesn't
              // carry the same conceptual weight as Pacing or Environment,
              // so it shouldn't claim the same vertical space either -- a
              // smaller pt/py here, not a shorter gap to Continue Exploring
              // specifically (that section's own spacing is fixed
              // regardless of what precedes it, and making it context-aware
              // would be more machinery than this cosmetic difference is
              // worth).
              const isCompactCategory = categoryMembers.length === 1;
              return (
              <div
                key={toolCategory}
                className={`mt-16 border-t border-black/10 first:mt-12 dark:border-white/10 ${isCompactCategory ? "pt-8" : "pt-10"}`}
              >
                <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
                  {TOOL_CATEGORY_LABELS[toolCategory]}
                </p>
                <div className="mt-6 divide-y divide-black/10 dark:divide-white/10">
                  {categoryRows.map((row) => (
                    <div
                      key={row[0].slug}
                      // A trailing solo row (an odd-sized category, or the
                      // one-tool Physiology category outright) stays plain
                      // grid-cols-1 instead of sm:grid-cols-2 -- otherwise
                      // it reserves an empty second column next to it,
                      // which reads as a missing tool rather than a
                      // deliberately short list.
                      className={
                        row.length === 2
                          ? "grid grid-cols-1 divide-y divide-black/5 sm:grid-cols-2 sm:gap-x-12 sm:divide-y-0 dark:divide-white/10"
                          : "grid grid-cols-1"
                      }
                    >
                      {row.map((member) => {
                        const toolVisual = TOOL_VISUALS[member.slug]!;
                        return (
                          <Link
                            key={member.slug}
                            href={`/${member.slug}`}
                            className={`group block ${isCompactCategory ? "py-6" : "py-9"}`}
                          >
                            <div className="flex items-center gap-3">
                              <toolVisual.icon
                                aria-hidden="true"
                                strokeWidth={1.75}
                                className="h-4 w-4 shrink-0"
                                style={{ color: toolVisual.accentFrom }}
                              />
                              <h2 className="text-xl font-semibold tracking-tight text-zinc-900 group-hover:underline dark:text-white">
                                {member.title}
                              </h2>
                            </div>
                            {/* max-w-xl on a solo row only -- close to what
                                a normal half-width column already measures,
                                so a lone entry's description doesn't
                                stretch to the full container width just
                                because it has no sibling column to share
                                with. */}
                            <p className={`mt-2 ml-7 text-zinc-600 dark:text-zinc-300 ${row.length === 1 ? "max-w-xl" : ""}`}>
                              {member.mission}
                            </p>
                            <span className="mt-5 ml-7 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                              Open tool
                              <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                                →
                              </span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          </>
        ) : (
          // Every other category: a plain numbered index, hairline rules
          // between rows, a plain arrow text-link -- no border/fill/shadow
          // anywhere. The index number carries a thin wash of the
          // category's own accent color, its one appearance beyond the
          // icon chip above.
          <div className="mt-12 divide-y divide-black/10 border-t border-black/10 dark:divide-white/10 dark:border-white/10">
            {memberRows.map((row, rowIndex) => (
              <div
                key={row[0].slug}
                className="grid grid-cols-1 divide-y divide-black/5 sm:grid-cols-2 sm:gap-x-12 sm:divide-y-0 dark:divide-white/10"
              >
                {row.map((member, columnIndex) => {
                  const number = String(rowIndex * 2 + columnIndex + 1).padStart(2, "0");
                  return (
                    <Link key={member.slug} href={`/${member.slug}`} className="group block py-9">
                      <div className="flex items-baseline gap-4">
                        <span
                          aria-hidden="true"
                          className="w-6 shrink-0 text-xs font-semibold tabular-nums"
                          style={{ color: categoryVisual?.accentFrom }}
                        >
                          {number}
                        </span>
                        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 group-hover:underline dark:text-white">
                          {member.title}
                        </h2>
                      </div>
                      <p className="mt-2 ml-10 text-zinc-600 dark:text-zinc-300">{member.mission}</p>
                      <span className="mt-5 ml-10 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        View section
                        <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                          →
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {exploreOtherDomains.length > 0 ? (
          <div className="mt-16 border-t border-black/10 pt-10 dark:border-white/10">
            <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
              Continue Exploring
            </p>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
              {exploreOtherDomains.map((domain) => (
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
        ) : null}
      </Container>
    );
  }

  // Individual Foundations section page
  if (section) {
    const parentCategory = categoryMap.get(section.category)!;
    const ToolComponent = sectionTools[section.slug];
    const content = section.content;
    const isArticle = !!content && content.length > 0;

    // Only the "articles" index section needs this -- the DB articles it
    // lists alongside the hand-authored essays are the contributor
    // pipeline's actual output (see /contribute/articles).
    const allPublishedArticles = section.articleSlugs ? await loadPublishedArticleList() : [];
    // Tags are stored lowercase (see parseTags in validation/articles.ts),
    // and the tag pill links pass the raw stored value through untouched
    // -- titleCase() only ever applies at render time -- so this is a
    // plain, exact, case-sensitive match against real data, not a fuzzy
    // text search.
    const publishedArticles = activeTag
      ? allPublishedArticles.filter((article) => article.tags.includes(activeTag))
      : allPublishedArticles;

    // An essay reached via the Articles index (sections.ts' articleSlugs)
    // should link back to Articles, not the broader Writing & Resources
    // category it happens to share with unrelated pages like Resources and
    // Contact -- matches the breadcrumb override in article-layout.tsx.
    const articlesSection = sectionMap.get("articles");
    const isArticleIndexMember = !!articlesSection?.articleSlugs?.includes(section.slug);
    const backLinkTarget = isArticleIndexMember && articlesSection ? articlesSection : parentCategory;

    // Same width as a category landing -- including for articles, which have
    // plenty of room for their sticky TOC + prose grid (see article-layout.tsx)
    // well under this width.
    if (section.articleSlugs) {
      // The "articles" index: an editorial archive/catalogue, not a card
      // grid -- eyebrow + serif heading matching the homepage's own
      // section-opening pattern (see about-page.tsx), a distinct featured
      // treatment for the most recent piece, then a plain divide-y list for
      // the rest. No 01/02/03 numbering here (unlike the homepage's category
      // index) -- articles aren't a fixed taxonomy the way the six
      // categories are.
      const [featured, ...restOfPublished] = publishedArticles;
      return (
        <Container variant="content">
          <BackLink href={`/${backLinkTarget.slug}`}>Back to {backLinkTarget.title}</BackLink>
          <p className="mt-8 text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
            Library
          </p>
          <h1 className="font-serif mt-3 text-3xl font-medium tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
            {section.title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
            {section.mission}
          </p>

          {activeTag ? (
            <div className="mt-8 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <span>
                Filtering by <span className="font-semibold text-zinc-900 dark:text-white">{titleCase(activeTag)}</span>
              </span>
              <Link
                href={`/${section.slug}`}
                className="font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
              >
                Clear
              </Link>
            </div>
          ) : null}

          {featured ? (
            <div className="mt-12 border-t border-black/10 pt-10 dark:border-white/10">
              <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
                Featured
              </p>
              <div
                className={
                  featured.coverImageUrl
                    ? "mt-5 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center"
                    : "mt-5 max-w-2xl"
                }
              >
                {featured.coverImageUrl ? (
                  <Link href={`/${featured.slug}`} className="block overflow-hidden rounded-card">
                    {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded/external URL, not a local/optimized asset */}
                    <img src={featured.coverImageUrl} alt="" className="aspect-video w-full object-cover" />
                  </Link>
                ) : null}
                <div>
                  <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
                    {ARTICLE_TYPE_LABELS[featured.articleType as ArticleType] ?? "Article"}
                    {featured.tags.length > 0 ? ` · ${featured.tags.map(titleCase).join(" · ")}` : ""}
                  </p>
                  <Link href={`/${featured.slug}`} className="group">
                    <h2 className="font-serif mt-3 text-3xl font-medium tracking-tight text-zinc-900 group-hover:underline sm:text-4xl dark:text-white">
                      {featured.title}
                    </h2>
                  </Link>
                  {featured.subtitle ? (
                    <p className="mt-3 text-lg leading-8 text-zinc-600 dark:text-zinc-300">{featured.subtitle}</p>
                  ) : null}
                  <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                    {featured.readingMinutes} min read
                    {featured.publishedAt ? ` · ${formatDate(featured.publishedAt.slice(0, 10))}` : ""}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-4 divide-y divide-black/10 border-t border-black/10 dark:divide-white/10 dark:border-white/10">
            {section.articleSlugs.map((articleSlug) => {
              const article = sectionMap.get(articleSlug);
              if (!article) return null;
              return (
                <Link key={article.slug} href={`/${article.slug}`} className="group block py-8">
                  <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
                    Essay
                  </p>
                  <h3 className="font-serif mt-2 text-xl font-medium tracking-tight text-zinc-900 group-hover:underline dark:text-white">
                    {article.title}
                  </h3>
                  <p className="mt-2 text-zinc-600 dark:text-zinc-300">{article.mission}</p>
                </Link>
              );
            })}
            {restOfPublished.map((article) => (
              <Link key={article.slug} href={`/${article.slug}`} className="group block py-8">
                <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
                  {ARTICLE_TYPE_LABELS[article.articleType as ArticleType] ?? "Article"}
                  {article.tags.length > 0 ? ` · ${article.tags.map(titleCase).join(" · ")}` : ""}
                </p>
                <h3 className="font-serif mt-2 text-xl font-medium tracking-tight text-zinc-900 group-hover:underline dark:text-white">
                  {article.title}
                </h3>
                {article.subtitle ? <p className="mt-2 text-zinc-600 dark:text-zinc-300">{article.subtitle}</p> : null}
                <p className="mt-3 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                  <span>
                    {article.readingMinutes} min read
                    {article.publishedAt ? ` · ${formatDate(article.publishedAt.slice(0, 10))}` : ""}
                  </span>
                  <span aria-hidden="true" className="opacity-0 transition group-hover:opacity-100">
                    →
                  </span>
                </p>
              </Link>
            ))}
          </div>
        </Container>
      );
    }

    return (
      <Container variant="content">
        <BackLink href={`/${backLinkTarget.slug}`}>Back to {backLinkTarget.title}</BackLink>
        <Heading>
          {section.title}
        </Heading>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          {section.mission}
        </p>

        {ToolComponent ? (
          <ToolComponent />
        ) : isArticle ? (
          <ArticleLayout section={section} category={parentCategory} content={content} />
        ) : (
          <Card padding="lg" className="mt-10">
            <h2 className="text-lg font-semibold">Planned Topics</h2>
            <ul className="mt-4 space-y-2 text-zinc-600 dark:text-zinc-300">
              {section.topics.map((topic: string) => (
                <li key={topic}>• {topic}</li>
              ))}
            </ul>
          </Card>
        )}
      </Container>
    );
  }

  // Neither a Foundations section nor a category -- try a published,
  // database-backed contributor article (see /contribute) before giving up.
  const article = await loadPublishedArticle(slug);
  if (!article) {
    notFound();
  }

  const [attribution, citations, publishedArticles, initialBookmarked] = await Promise.all([
    loadArticleAttribution(article),
    loadArticleCitations(article.id),
    loadPublishedArticleList(),
    getBookmarkStatus(article.slug),
  ]);
  const relatedArticles = selectRelatedArticles(publishedArticles, article.slug, article.tags);
  const parentCategory = categoryMap.get("archive")!;
  // Every DB-backed article belongs to the Articles pipeline (see
  // /contribute/articles), never to the broader Library category directly
  // -- the back link and breadcrumb should say what the reader actually
  // clicked through (see article-layout.tsx's own breadcrumbCategory
  // override for the in-page byline breadcrumb). "archive" here was
  // "writing-and-resources" before the four-domain migration -- its slug
  // isn't "library" because /library is already a different, unrelated
  // authenticated route (see sections.ts's own comment on this category).
  const articlesSection = sectionMap.get("articles")!;
  const dbSection: Section = {
    slug: article.slug,
    title: article.title,
    mission: article.subtitle ?? "",
    topics: [],
    category: "archive",
    content: article.content,
  };

  return (
    <Container variant="content">
      <BackLink href={`/${articlesSection.slug}`}>Back to {articlesSection.title}</BackLink>
      <ArticleHero
        title={dbSection.title}
        mission={article.subtitle}
        articleType={article.articleType}
        attribution={attribution}
        readingMinutes={estimateReadingMinutes(article.content)}
        contentSlug={dbSection.slug}
        content={dbSection.content!}
        initialBookmarked={initialBookmarked}
      />
      <ArticleLayout
        section={dbSection}
        category={parentCategory}
        content={dbSection.content!}
        attribution={attribution}
        citations={citations}
        coverImageUrl={article.coverImageUrl}
        relatedArticles={relatedArticles}
      />
    </Container>
  );
}
