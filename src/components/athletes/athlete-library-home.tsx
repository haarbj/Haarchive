import Link from "next/link";

import { athletes } from "@/lib/athletes/data";
import { coachMap } from "@/lib/coaches/data";
import { CoachAvatar } from "@/components/coaches/coach-avatar";
import { CardLink } from "@/components/ui/card-link";
import {
  eyebrowClass,
  sectionHeadingClass,
  sectionDividerClass,
  sectionProseClass,
} from "@/lib/section-styles";

// The coach a given athlete's page is grouped under on this directory --
// the first coaching stint with a real Coaching Library page, since that's
// almost always the coach who actually built the philosophy into them
// (a later stint's coachSlug, if any, still gets its own link on the
// athlete's own page via CoachTimeline).
function primaryCoachSlug(athlete: (typeof athletes)[number]): string | undefined {
  return athlete.coachHistory.find((stint) => stint.coachSlug)?.coachSlug;
}

// The Athlete Library's homepage -- registered as the "athlete-library"
// section's ToolComponent (see sectionTools in [slug]/page.tsx), mirroring
// CoachingLibraryHome. Deliberately not a biography index: every athlete
// here exists to show a coaching philosophy applied in practice, so the
// primary organization is "grouped by coach," not alphabetical.
export function AthleteLibraryHome() {
  const groups = Array.from(coachMap.values())
    .map((coach) => ({
      coach,
      athletes: athletes.filter((athlete) => primaryCoachSlug(athlete) === coach.slug),
    }))
    .filter((group) => group.athletes.length > 0);

  return (
    <>
      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Introduction</p>
        <h2 className={sectionHeadingClass}>Philosophy, Applied</h2>
        <p className={sectionProseClass}>
          The{" "}
          <Link
            href="/coaching-library"
            className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
          >
            Coaching Library
          </Link>{" "}
          covers what each coaching philosophy believes. This library covers what that belief actually looked
          like in a real athlete&rsquo;s training — the weekly structure, the signature sessions, the
          physiological targets, and how it changed across coaching changes. These pages are not biographies:
          the point is always the philosophy in practice, not the athlete&rsquo;s life story.
        </p>
      </section>

      {groups.map(({ coach, athletes: coachAthletes }) => (
        <section key={coach.slug} className={sectionDividerClass}>
          <p className={eyebrowClass}>Trained Under</p>
          <h2 className={sectionHeadingClass}>
            <Link
              href={`/coaching-library/${coach.slug}`}
              className="underline decoration-black/20 underline-offset-4 transition hover:decoration-black/60 dark:decoration-white/30 dark:hover:decoration-white/70"
            >
              {coach.name}
            </Link>
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {coachAthletes.map((athlete) => (
              <CardLink key={athlete.slug} href={`/athlete-library/${athlete.slug}`} padding="md">
                <div className="flex items-start gap-3">
                  <CoachAvatar name={athlete.name} imageUrl={athlete.portraitUrl} />
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
                      {athlete.name}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {athlete.country} · {athlete.primaryEvents}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{athlete.oneLiner}</p>
                <span className="mt-3 inline-flex text-xs font-semibold text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white">
                  View athlete profile →
                </span>
              </CardLink>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
