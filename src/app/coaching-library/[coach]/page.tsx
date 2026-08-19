import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { coaches, coachMap } from "@/lib/coaches/data";
import { canonicalUrl } from "@/lib/canonical";
import { CoachPage } from "@/components/coaches/coach-page";
import { VerifiedBadge } from "@/components/coaches/verified-badge";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { ReadingProgressBar } from "@/components/reading-progress-bar";
import { logLearningEvent } from "@/app/learning-actions";
import { getKnowledgeCheckForTopic } from "@/app/knowledge-check-actions";
import { conceptAnchorsForTopic } from "@/lib/mastery/concept-anchors";
import { KnowledgeCheck } from "@/components/learning/knowledge-check";

type CoachRouteParams = {
  params: Promise<{ coach: string }>;
};

export function generateStaticParams() {
  return coaches.map((coach) => ({ coach: coach.slug }));
}

export async function generateMetadata({ params }: CoachRouteParams): Promise<Metadata> {
  const { coach: slug } = await params;
  const coach = coachMap.get(slug);
  if (!coach) return {};

  return {
    title: coach.name,
    description: coach.oneLiner,
    ...canonicalUrl(`/coaching-library/${slug}`),
    openGraph: { title: coach.name, description: coach.oneLiner, images: ["/opengraph-image.png"] },
    twitter: { title: coach.name, description: coach.oneLiner, images: ["/opengraph-image.png"] },
  };
}

// One template (CoachPage) driving one page per coaching philosophy -- a
// dedicated nested route rather than a [slug]/page.tsx entry, since
// /coaching-library itself is still a Foundations section (see sections.ts'
// ToolComponent for that page) and these are a distinct, structured content
// type nested one level under it.
export default async function CoachRoutePage({ params }: CoachRouteParams) {
  const { coach: slug } = await params;
  const coach = coachMap.get(slug);
  if (!coach) notFound();

  // Individual coach pages aren't their own learning Topic (sections.ts /
  // taxonomy.ts only seed the "coaching-library" index page as one) -- real
  // reading of any coach's page counts as engagement with that shared
  // Coaching Library topic, which is also where its curated Concepts
  // (double-threshold, periodization, vdot) actually live.
  const conceptAnchors = conceptAnchorsForTopic("coaching-library");
  // Same "coaching-library" topic as above, for the same reason -- a
  // knowledge check answered from any coach's page counts toward the one
  // shared topic. Mirrors article-layout.tsx's own wiring exactly; this
  // route predates that pattern and was missed when it was added, which
  // meant coaching-library's own knowledge checks (once seeded) would have
  // had no page to actually render on.
  const knowledgeCheck = await getKnowledgeCheckForTopic("coaching-library");

  return (
    <Container variant="content">
      <ReadingProgressBar
        targetId="article-content"
        onView={logLearningEvent.bind(null, "coaching-library", "content_viewed")}
        onDeepScroll={logLearningEvent.bind(null, "coaching-library", "content_engaged")}
        conceptAnchors={conceptAnchors}
        onConceptSeen={logLearningEvent.bind(null, "coaching-library", "concept_engaged")}
      />

      <BackLink href="/coaching-library">Back to Coaching Library</BackLink>
      <Heading>
        {coach.name}
        {coach.shortName ? <span className="text-zinc-500 dark:text-zinc-400"> ({coach.shortName})</span> : null}
      </Heading>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">{coach.oneLiner}</p>
      {coach.review ? (
        <div className="mt-4">
          <VerifiedBadge coachName={coach.name} reviewedAt={coach.review.reviewedAt} />
        </div>
      ) : null}

      <div id="article-content">
        <CoachPage coach={coach} />
      </div>

      {knowledgeCheck ? (
        <div className="mt-10">
          <KnowledgeCheck question={knowledgeCheck} topicTitle="Coaching Library" />
        </div>
      ) : null}
    </Container>
  );
}
