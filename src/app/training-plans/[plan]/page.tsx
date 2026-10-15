import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TRAINING_PLANS, trainingPlanMap } from "@/lib/training-plans/data";
import { TRACK_PROFILES } from "@/lib/training-plans/track-profiles";
import { canonicalUrl } from "@/lib/canonical";
import { eyebrowClass } from "@/lib/section-styles";
import { PlanPage } from "@/components/training-plans/plan-page";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

type PlanRouteParams = {
  params: Promise<{ plan: string }>;
};

export function generateStaticParams() {
  return TRAINING_PLANS.map((plan) => ({ plan: plan.slug }));
}

export async function generateMetadata({ params }: PlanRouteParams): Promise<Metadata> {
  const { plan: slug } = await params;
  const plan = trainingPlanMap.get(slug);
  if (!plan) return {};

  const title = `${plan.trackLabel}: ${plan.durationWeeks}-Week ${plan.raceType} Plan`;
  const description = `A ${plan.durationWeeks}-week ${plan.raceType.toLowerCase()} plan averaging roughly ${Math.round(plan.referenceAvgWeeklyMiles)} miles per week, peaking around ${Math.round(plan.referencePeakWeeklyMiles)}.`;

  return {
    title,
    description,
    ...canonicalUrl(`/training-plans/${slug}`),
    openGraph: { title, description, images: ["/opengraph-image.png"] },
    twitter: { title, description, images: ["/opengraph-image.png"] },
  };
}

// One template (PlanPage) driving one page per plan -- a dedicated nested
// route rather than a [slug]/page.tsx entry, mirroring
// /coaching-library/[coach]/page.tsx exactly: /training-plans itself is a
// Foundations section (see sections.ts' ToolComponent for that page) and
// these are a distinct, structured content type nested one level under it.
export default async function PlanRoutePage({ params }: PlanRouteParams) {
  const { plan: slug } = await params;
  const plan = trainingPlanMap.get(slug);
  if (!plan) notFound();

  const profile = TRACK_PROFILES[plan.track];

  return (
    <Container variant="content">
      <BackLink href="/training-plans">Back to Training Plans</BackLink>
      <Heading>
        {plan.trackLabel}: {plan.durationWeeks}-Week {plan.raceType}
      </Heading>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Reference plan averages roughly {Math.round(plan.referenceAvgWeeklyMiles)} miles per week, peaking around{" "}
        {Math.round(plan.referencePeakWeeklyMiles)} miles.
      </p>

      <Card padding="md" className="mt-6 max-w-3xl">
        <dl className="grid grid-cols-1 gap-4 xs:grid-cols-2">
          <div>
            <dt className={eyebrowClass}>Peak mileage</dt>
            <dd className="mt-1 text-zinc-900 dark:text-white">{profile.peakOptions}</dd>
          </div>
          <div>
            <dt className={eyebrowClass}>Typical goal times</dt>
            <dd className="mt-1 text-zinc-900 dark:text-white">{profile.goalTimeRange}</dd>
          </div>
        </dl>
        <p className={`${eyebrowClass} mt-4`}>Recommended for</p>
        <ul className="mt-1 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
          {profile.recommendedFor.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>

      <PlanPage plan={plan} />
    </Container>
  );
}
