import type { Metadata } from "next";
import type { ComponentType } from "react";
import { notFound } from "next/navigation";

import {
  categories,
  categoryMap,
  sectionMap,
  sections,
  sectionsInCategory,
  type Category,
  type Section,
} from "@/lib/sections";
import { createClient } from "@/lib/db/server";
import { mapArticleRow, type ArticleRow } from "@/lib/articles/map-row";
import { buildArticleAttribution } from "@/lib/articles/attribution";
import type { Article } from "@/lib/articles/types";
import { EnvironmentalCalculator } from "@/components/environmental-calculator";
import { GapCalculator } from "@/components/gap-calculator";
import { HeatTracker } from "@/components/heat-tracker";
import { PaceCalculator } from "@/components/pace-calculator";
import { ArticleLayout } from "@/components/article-layout";
import type { ArticleAttribution } from "@/components/article-byline";
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
};

type SectionPageProps = {
  params: Promise<{ slug: string }>;
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

async function loadPublishedArticleList(): Promise<{ slug: string; title: string; subtitle: string | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("articles")
    .select("slug, title, subtitle")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .returns<{ slug: string; title: string; subtitle: string | null }[]>();
  return data ?? [];
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
    return buildArticleAttribution([], [], [], article.publishedAt, article.evidenceCategory);
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
    article.publishedAt,
    article.evidenceCategory,
  );
}

export async function generateMetadata({
  params,
}: SectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const section = sectionMap.get(slug);
  const category = categoryMap.get(slug);
  let entry: { title: string; mission: string } | undefined = section ?? category;

  if (!entry) {
    const article = await loadPublishedArticle(slug);
    if (article) entry = { title: article.title, mission: article.subtitle ?? "" };
  }

  if (!entry) {
    return {};
  }

  return {
    title: entry.title,
    description: entry.mission,
    openGraph: {
      title: entry.title,
      description: entry.mission,
      images: ["/opengraph-image.png"],
    },
    twitter: {
      title: entry.title,
      description: entry.mission,
      images: ["/opengraph-image.png"],
    },
  };
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { slug } = await params;
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
          {members.map((member: Section) => (
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
          ))}
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
    const publishedArticles = section.articleSlugs ? await loadPublishedArticleList() : [];

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
            {publishedArticles.map((article) => (
              <CardLink key={article.slug} href={`/${article.slug}`}>
                <h2 className="text-xl font-semibold tracking-tight">{article.title}</h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{article.subtitle ?? ""}</p>
                <span className="mt-4 inline-flex text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-white dark:group-hover:text-white">
                  Read the essay →
                </span>
              </CardLink>
            ))}
          </div>
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

  const attribution = await loadArticleAttribution(article);
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
      <Heading>{dbSection.title}</Heading>
      {dbSection.mission ? (
        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">{dbSection.mission}</p>
      ) : null}
      <ArticleLayout section={dbSection} category={parentCategory} content={dbSection.content!} attribution={attribution} />
    </Container>
  );
}
