import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { athletes, athleteMap } from "@/lib/athletes/data";
import { canonicalUrl } from "@/lib/canonical";
import { AthletePage } from "@/components/athletes/athlete-page";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { ReadingProgressBar } from "@/components/reading-progress-bar";
import { logLearningEvent } from "@/app/learning-actions";
import { getKnowledgeCheckForTopic } from "@/app/knowledge-check-actions";
import { KnowledgeCheck } from "@/components/learning/knowledge-check";

type AthleteRouteParams = {
  params: Promise<{ athlete: string }>;
};

export function generateStaticParams() {
  return athletes.map((athlete) => ({ athlete: athlete.slug }));
}

export async function generateMetadata({ params }: AthleteRouteParams): Promise<Metadata> {
  const { athlete: slug } = await params;
  const athlete = athleteMap.get(slug);
  if (!athlete) return {};

  return {
    title: athlete.name,
    description: athlete.oneLiner,
    ...canonicalUrl(`/athlete-library/${slug}`),
    openGraph: { title: athlete.name, description: athlete.oneLiner, images: ["/opengraph-image.png"] },
    twitter: { title: athlete.name, description: athlete.oneLiner, images: ["/opengraph-image.png"] },
  };
}

// One template (AthletePage) driving one page per athlete -- a dedicated
// nested route rather than a [slug]/page.tsx entry, mirroring
// /coaching-library/[coach]/page.tsx exactly: /athlete-library itself is a
// Foundations section (see sections.ts' ToolComponent for that page) and
// these are a distinct, structured content type nested one level under it.
export default async function AthleteRoutePage({ params }: AthleteRouteParams) {
  const { athlete: slug } = await params;
  const athlete = athleteMap.get(slug);
  if (!athlete) notFound();

  // Same "shared index topic" pattern as coaching-library's own route (see
  // its comment) -- no athlete-library concepts are seeded today (this
  // library has no per-page glossary anchors the way coaching-library
  // does), so there's no conceptAnchors/onConceptSeen wiring here, but a
  // knowledge check is still a real, self-contained signal worth exposing
  // if one ever gets seeded. getKnowledgeCheckForTopic returns null for a
  // topic with zero questions (the case today), so this stays fully
  // dormant -- no content invented, just capability wired up so a future
  // question doesn't hit the same "unreachable because unwired" bug
  // coaching-library had.
  const knowledgeCheck = await getKnowledgeCheckForTopic("athlete-library");

  return (
    <Container variant="content">
      {/* Individual athlete pages aren't their own learning Topic --
          sections.ts/taxonomy.ts only seed the "athlete-library" index
          page as one, so real reading of any athlete's page counts toward
          that shared topic (mirrors /coaching-library/[coach]/page.tsx). */}
      <ReadingProgressBar
        targetId="article-content"
        onView={logLearningEvent.bind(null, "athlete-library", "content_viewed")}
        onDeepScroll={logLearningEvent.bind(null, "athlete-library", "content_engaged")}
      />

      <BackLink href="/athlete-library">Back to Athlete Library</BackLink>
      <Heading>{athlete.name}</Heading>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">{athlete.oneLiner}</p>

      <div id="article-content">
        <AthletePage athlete={athlete} />
      </div>

      {knowledgeCheck ? (
        <div className="mt-10">
          <KnowledgeCheck question={knowledgeCheck} topicTitle="Athlete Library" />
        </div>
      ) : null}
    </Container>
  );
}
