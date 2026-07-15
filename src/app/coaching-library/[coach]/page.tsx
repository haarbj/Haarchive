import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { coaches, coachMap } from "@/lib/coaches/data";
import { CoachPage } from "@/components/coaches/coach-page";
import { VerifiedBadge } from "@/components/coaches/verified-badge";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

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

  return (
    <Container variant="content">
      <BackLink href="/coaching-library">Back to Coaching Library</BackLink>
      <Heading>
        {coach.name}
        {coach.shortName ? <span className="text-zinc-400 dark:text-zinc-500"> ({coach.shortName})</span> : null}
      </Heading>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">{coach.oneLiner}</p>
      {coach.review ? (
        <div className="mt-4">
          <VerifiedBadge coachName={coach.name} reviewedAt={coach.review.reviewedAt} />
        </div>
      ) : null}

      <CoachPage coach={coach} />
    </Container>
  );
}
