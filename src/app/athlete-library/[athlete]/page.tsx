import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { athletes, athleteMap } from "@/lib/athletes/data";
import { AthletePage } from "@/components/athletes/athlete-page";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

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

  return (
    <Container variant="content">
      <BackLink href="/athlete-library">Back to Athlete Library</BackLink>
      <Heading>{athlete.name}</Heading>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">{athlete.oneLiner}</p>

      <AthletePage athlete={athlete} />
    </Container>
  );
}
