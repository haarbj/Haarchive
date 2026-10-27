import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { getAthleteMostRecentRace } from "@/lib/private-coaching/pace-reference";
import { ATHLETE_GUIDES, getAthleteGuide } from "@/lib/private-coaching/athlete-education";
import { ContentBlocks } from "@/components/content-blocks";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// One route for the whole athlete education library: a guide is a data
// entry in athlete-education.ts, not a new page (the same generic-template
// discipline [slug]/page.tsx uses for the public content library).
//
// Content renders through the site's own ContentBlocks renderer rather
// than hand-rolled prose JSX, so these pages inherit the existing callout
// variants, heading anchors and glossary auto-linking for free.
//
// Visible to a coached athlete (this is their material) and to a private
// coach (so a coach can read exactly what their athletes are being told).
// Everyone else goes back to /coaching.
export default async function AthleteGuidePage({ params }: { params: Promise<{ guide: string }> }) {
  const session = await getAppSession();
  if (!session) redirect("/coaching");
  if (!session.isCoachedAthlete && !session.isPrivateCoach) redirect("/coaching");

  const { guide: slug } = await params;
  // Only the "workout-types" guide's own worked examples read this -- a
  // coach with no coaching practice of their own (isCoachedAthlete false)
  // gets null here, same as an athlete with no race on file yet, and
  // getAthleteGuide/resolveGlossaryExample both already handle that case
  // honestly (structure shown, no fabricated splits).
  const race = session.isCoachedAthlete ? await getAthleteMostRecentRace(await createClient(), session.userId) : null;
  const guide = getAthleteGuide(slug, race);
  if (!guide) notFound();

  const others = ATHLETE_GUIDES.filter((g) => g.slug !== guide.slug);

  return (
    <Container variant="dashboard">
      <BackLink href="/coaching">My Coaching</BackLink>

      <p className="mt-6 text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
        {guide.eyebrow}
      </p>
      <Heading>{guide.title}</Heading>

      <div className="mt-8">
        <ContentBlocks content={guide.content} sectionSlug={`coaching-learn-${guide.slug}`} />
      </div>

      <div className="mt-14 border-t border-black/10 pt-6 dark:border-white/10">
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Keep reading</p>
        <div className="mt-3 flex flex-col gap-2">
          {others.map((other) => (
            <Link
              key={other.slug}
              href={`/coaching/learn/${other.slug}`}
              className="text-sm text-zinc-600 hover:underline dark:text-zinc-300"
            >
              {other.title}
            </Link>
          ))}
        </div>
      </div>
    </Container>
  );
}
