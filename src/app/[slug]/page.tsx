import type { Metadata } from "next";
import type { ComponentType } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

import {
  categories,
  categoryMap,
  sectionMap,
  sections,
  sectionsInCategory,
  type Category,
  type ContentBlock,
  type Section,
} from "@/lib/sections";
import { createClient } from "@/lib/db/server";
import { mapArticleRow, type ArticleRow } from "@/lib/articles/map-row";
import { buildArticleAttribution, type ArticleAttribution } from "@/lib/articles/attribution";
import { ARTICLE_TYPE_LABELS, type ArticleType } from "@/lib/articles/constants";
import { mapPublicCitationRow, type PublicCitation } from "@/lib/articles/citations";
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
import { TrainingPlansHome } from "@/components/training-plans/training-plans-home";
import { HeatTracker } from "@/components/heat-tracker";
import { PaceCalculator } from "@/components/pace-calculator";
import { TrainingPhilosophyPage } from "@/components/training-philosophy-page";
import { ArticleHero } from "@/components/article-hero";
import { ArticleLayout } from "@/components/article-layout";
import { ToolCard } from "@/components/tool-card";
import { TOOL_VISUALS } from "@/lib/tool-visuals";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import { CardLink } from "@/components/ui/card-link";
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

type PublishedArticleListItem = {
  slug: string;
  title: string;
  subtitle: string | null;
  publishedAt: string | null;
  coverImageUrl: string | null;
  tags: string[];
  articleType: string;
  readingMinutes: number;
};

async function loadPublishedArticleList(): Promise<PublishedArticleListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("articles")
    .select("slug, title, subtitle, published_at, cover_image_url, tags, article_type, content")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .returns<
      {
        slug: string;
        title: string;
        subtitle: string | null;
        published_at: string | null;
        cover_image_url: string | null;
        tags: string[] | null;
        article_type: string;
        content: ContentBlock[] | null;
      }[]
    >();
  return (data ?? []).map((row) => ({
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    publishedAt: row.published_at,
    coverImageUrl: row.cover_image_url,
    tags: row.tags ?? [],
    articleType: row.article_type,
    readingMinutes: estimateReadingMinutes(row.content ?? []),
  }));
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
}: SectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const section = sectionMap.get(slug);
  const category = categoryMap.get(slug);
  const entry = section ?? category;

  if (entry) {
    return {
      title: entry.title,
      description: entry.mission,
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

    return (
      <Container variant="content">
        <BackLink href="/">Back to home</BackLink>
        <Heading>
          {category.title}
        </Heading>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          {category.mission}
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {members.map((member: Section) => {
            const visual = TOOL_VISUALS[member.slug];
            return visual ? (
              <ToolCard key={member.slug} href={`/${member.slug}`} title={member.title} mission={member.mission} visual={visual} />
            ) : (
              <CardLink key={member.slug} href={`/${member.slug}`}>
                <h2 className="text-xl font-semibold tracking-tight">
                  {member.title}
                </h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {member.mission}
                </p>
                <span className="mt-4 inline-flex text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-white dark:group-hover:text-white">
                  View section →
                </span>
              </CardLink>
            );
          })}
        </div>
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
        ) : section.articleSlugs ? (
          <>
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
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {section.articleSlugs.map((articleSlug) => {
              const article = sectionMap.get(articleSlug);
              if (!article) return null;
              return (
                <CardLink key={article.slug} href={`/${article.slug}`}>
                  <h2 className="text-xl font-semibold tracking-tight">
                    {article.title}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                    {article.mission}
                  </p>
                  <span className="mt-4 inline-flex text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-white dark:group-hover:text-white">
                    Read the essay →
                  </span>
                </CardLink>
              );
            })}
            {publishedArticles.map((article) =>
              article.coverImageUrl ? (
                <div key={article.slug} className="group relative flex aspect-video overflow-hidden rounded-card">
                  {/* The "go to article" hit-area for the whole card --
                      sits behind everything else so the tag links below
                      (pointer-events-auto) can claim clicks in their own
                      small region instead. Deliberately no z-index here:
                      plain DOM order (this, then the image, then the
                      gradient, then the content wrapper) already stacks
                      everything correctly within the card, and an explicit
                      z-index previously tied numerically with the site
                      header's own z-[var(--z-header)] token, which made the
                      card's content render above the sticky header while
                      scrolling. The card can't just be one big <Link>
                      anymore now that tags are their own links -- <a> can't
                      nest inside <a> -- so this is the standard "stretched
                      link" pattern instead. */}
                  <Link
                    href={`/${article.slug}`}
                    aria-label={article.title}
                    className="absolute inset-0 rounded-card focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded/external URL, not a local/optimized asset */}
                  <img
                    src={article.coverImageUrl}
                    alt=""
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  {/* Two scrims, not one -- the eyebrow line now lives at the
                      top of the card (filling what used to be dead space
                      above the headline), so the top needs its own fade
                      too, not just the bottom-anchored one the headline
                      sits on. Same "never fully transparent" reasoning as
                      ArticleHero's own scrim either way. Lighter than that
                      one (45/70 vs. 60/80): a cover that's already dark --
                      a stylized illustration, a night photo -- was reading
                      as "no image at all" under the stronger version. */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/70" />
                  <div className="pointer-events-none relative flex h-full w-full flex-col justify-between p-4">
                    <div className="pointer-events-auto space-y-1.5">
                      {/* h-7 + flex-wrap + overflow-hidden, not just
                          overflow-hidden on a single non-wrapping row: a tag
                          that doesn't fully fit now wraps whole onto a
                          second row instead of getting sliced in half at
                          the edge -- and since that second row sits past
                          the fixed one-row height, it's clipped away
                          entirely rather than shown partially. No JS
                          measurement needed; flex-wrap already only ever
                          wraps a whole item, never part of one. */}
                      <div className="flex h-7 flex-wrap gap-1.5 overflow-hidden">
                        {/* Article type first and visually distinct (solid,
                            not translucent) -- it's the one label here that
                            actually says what kind of piece this is; the
                            free-form tags are secondary context after it. */}
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-white px-2.5 py-1 text-xs font-semibold text-zinc-900">
                          <FileText className="h-3 w-3" />
                          {ARTICLE_TYPE_LABELS[article.articleType as ArticleType] ?? "Article"}
                        </span>
                        {article.tags.map((tag) => (
                          <Link
                            key={tag}
                            href={`/${section.slug}?tag=${encodeURIComponent(tag)}`}
                            className="shrink-0 scale-100 rounded-pill bg-white/15 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm transition hover:scale-110 hover:bg-white/30"
                          >
                            {titleCase(tag)}
                          </Link>
                        ))}
                      </div>
                      {/* drop-shadow, not just a lighter/darker gradient --
                          plain text (unlike the tags above) has no pill
                          background of its own to fall back on, so a photo
                          with a bright patch right here needs a per-pixel
                          contrast aid, not just an average darkening. */}
                      <p className="text-xs font-medium text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                        {article.readingMinutes} min read
                        {article.publishedAt ? ` · ${formatDate(article.publishedAt.slice(0, 10))}` : ""}
                      </p>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight text-white text-balance line-clamp-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                        {article.title}
                      </h2>
                      {article.subtitle ? (
                        <p className="mt-1 text-sm text-white/80 line-clamp-2">{article.subtitle}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <CardLink key={article.slug} href={`/${article.slug}`}>
                  <h2 className="text-xl font-semibold tracking-tight">{article.title}</h2>
                  {article.publishedAt ? (
                    <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {formatDate(article.publishedAt.slice(0, 10))}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{article.subtitle ?? ""}</p>
                  <span className="mt-4 inline-flex text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-white dark:group-hover:text-white">
                    Read the essay →
                  </span>
                </CardLink>
              ),
            )}
            </div>
          </>
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

  const [attribution, citations] = await Promise.all([
    loadArticleAttribution(article),
    loadArticleCitations(article.id),
  ]);
  const parentCategory = categoryMap.get("writing-and-resources")!;
  // Every DB-backed article belongs to the Articles pipeline (see
  // /contribute/articles), never to the broader Writing & Resources
  // category directly -- the back link and breadcrumb should say what the
  // reader actually clicked through (see article-layout.tsx's own
  // breadcrumbCategory override for the in-page byline breadcrumb).
  const articlesSection = sectionMap.get("articles")!;
  const dbSection: Section = {
    slug: article.slug,
    title: article.title,
    mission: article.subtitle ?? "",
    topics: [],
    category: "writing-and-resources",
    content: article.content,
  };

  return (
    <Container variant="content">
      <BackLink href={`/${articlesSection.slug}`}>Back to {articlesSection.title}</BackLink>
      <ArticleHero
        title={dbSection.title}
        mission={article.subtitle}
        coverImageUrl={article.coverImageUrl}
        attribution={attribution}
        readingMinutes={estimateReadingMinutes(article.content)}
      />
      <ArticleLayout
        section={dbSection}
        category={parentCategory}
        content={dbSection.content!}
        attribution={attribution}
        citations={citations}
      />
    </Container>
  );
}
