import Link from "next/link";

import { coaches } from "@/lib/coaches/data";
import { FAMILY_FOREST } from "@/lib/coaches/family-tree";
import { CoachAvatar } from "./coach-avatar";
import { CoachGenomeCompare } from "./coach-genome-compare";
import { CoachComparisonTable } from "./coach-comparison-table";
import { CoachingTimeline } from "./coaching-timeline";
import { FamilyTree } from "./family-tree";
import { CardLink } from "@/components/ui/card-link";
import {
  eyebrowClass,
  sectionHeadingClass,
  sectionDividerClass,
  sectionProseClass,
} from "@/lib/section-styles";

const SHARED_PRINCIPLES = [
  "Aerobic volume is the foundation, even in systems that don't advertise it that way — marathon-specific blocks and double-threshold work both sit on top of large aerobic mileage, not instead of it.",
  "Recovery is trainable and has to be managed deliberately, not treated as time off from the real work.",
  "Progression has to move toward race specificity — general fitness eventually has to convert into the exact demand of the goal race.",
];

const DISAGREEMENTS = [
  "How much quality work should sit near threshold — some systems spend heavily there; others argue that's exactly the zone to minimize.",
  "How prescriptive training should be — precise pace zones and lactate targets on one end, feel and context on the other.",
  "How much technical and mental coaching matters — a core pillar for some systems, largely agnostic for others.",
];

// The Coaching Library's homepage -- registered as the "coaching-library"
// section's ToolComponent (see sectionTools in [slug]/page.tsx), replacing
// the single long comparative essay that used to live there. Every fact
// shown here (comparison table cells, timeline order, shared/disagreement
// lists) is either lifted from a coach's own data.ts entry or a fixed,
// hand-curated summary -- nothing here is computed from opinion at render
// time.
export function CoachingLibraryHome() {
  return (
    <>
      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Introduction</p>
        <h2 className={sectionHeadingClass}>What Is a Coaching Philosophy?</h2>
        <p className={sectionProseClass}>
          A coaching philosophy is a belief about which physiological or psychological constraint most limits
          performance, and in what order that constraint should be addressed. Every workout a coach prescribes
          is downstream of that belief — which is exactly why two systems can look completely different on
          paper and still both produce Olympic medalists.
        </p>
        <p className={sectionProseClass}>
          The goal of this library isn&rsquo;t to rank the seven systems below. It&rsquo;s to make each one&rsquo;s
          internal logic legible enough that you can judge which beliefs actually match your own training
          history, goals, and constraints — see{" "}
          <Link
            href="/training-philosophy"
            className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
          >
            Training Philosophy
          </Link>{" "}
          for the site&rsquo;s own take on why that question matters more than which coach is &ldquo;right.&rdquo;
        </p>
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Coach Directory</p>
        <h2 className={sectionHeadingClass}>Seven Coaching Philosophies</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {coaches.map((coach) => {
            const famousAthlete = coach.notableAthletes[0];
            const signatureWorkout = coach.signatureWorkouts[0];
            return (
              <CardLink key={coach.slug} href={`/coaching-library/${coach.slug}`} padding="md">
                <div className="flex items-start gap-3">
                  <CoachAvatar name={coach.name} imageUrl={coach.portraitUrl} />
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
                      {coach.name}
                      {coach.shortName ? (
                        <span className="text-zinc-400 dark:text-zinc-500"> ({coach.shortName})</span>
                      ) : null}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{coach.yearsActive}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{coach.oneLiner}</p>

                <dl className="mt-4 space-y-1.5 border-t border-black/5 pt-3 text-xs dark:border-white/10">
                  {famousAthlete ? (
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 font-semibold text-zinc-500 dark:text-zinc-400">Famous athlete:</dt>
                      <dd className="text-zinc-600 dark:text-zinc-300">{famousAthlete.name}</dd>
                    </div>
                  ) : null}
                  {signatureWorkout ? (
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 font-semibold text-zinc-500 dark:text-zinc-400">Signature workout:</dt>
                      <dd className="text-zinc-600 dark:text-zinc-300">{signatureWorkout.name}</dd>
                    </div>
                  ) : null}
                  <div className="flex gap-1.5">
                    <dt className="shrink-0 font-semibold text-zinc-500 dark:text-zinc-400">Best if you&rsquo;re:</dt>
                    <dd className="text-zinc-600 dark:text-zinc-300">{coach.bestFor[0]?.label}</dd>
                  </div>
                </dl>

                <span className="mt-3 inline-flex text-xs font-semibold text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white">
                  View philosophy →
                </span>
              </CardLink>
            );
          })}
        </div>
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Compare Philosophies</p>
        <h2 className={sectionHeadingClass}>Coach Comparison Table</h2>
        <p className={sectionProseClass}>
          The fastest way to see how seven philosophies actually differ, side by side. Sort any column, filter to
          a slice you care about, and scroll horizontally on a narrow screen — the coach column stays put.
        </p>
        <div className="mt-8">
          <CoachComparisonTable coaches={coaches} />
        </div>
      </section>

      {/* The signature feature of the library -- given its own bordered
          panel (rather than sitting flush like every other section) so it
          reads as a distinct, elevated tool rather than one more block of
          text. Today's version is two static bar charts side by side;
          CoachGenomeCompare already isolates all the interactive state
          (which two coaches are selected) from CoachGenomeChart's pure
          rendering, specifically so a later upgrade -- an animated radar
          view, click-to-highlight categories, more than two coaches at
          once -- only touches those two components, not this page. Hover
          any row in either chart for what that dimension actually means
          (see GENOME_CATEGORIES in lib/coaches/genome.ts). */}
      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Coach Genome</p>
        <h2 className={sectionHeadingClass}>Compare Two Coaches Side by Side</h2>
        <p className={sectionProseClass}>
          Ten categories, scored 0-100 by emphasis — not a ranking of which coach is better, just where each one
          puts training focus. Pick any two coaches to compare directly, and hover a category for what it means.
        </p>
        <div className="mt-8 rounded-2xl border border-black/10 bg-white p-6 shadow-card sm:p-8 dark:border-white/10 dark:bg-zinc-900">
          <CoachGenomeCompare coaches={coaches} />
        </div>
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Timeline</p>
        <h2 className={sectionHeadingClass}>Evolution of Coaching Ideas</h2>
        <p className={sectionProseClass}>
          These seven philosophies didn&rsquo;t arrive one after another — most were active at the same time as
          several others. The bars below show each coach&rsquo;s real active era, so the overlap itself is part
          of the story.
        </p>
        <CoachingTimeline coaches={coaches} />
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Genealogy</p>
        <h2 className={sectionHeadingClass}>The Coaching Family Tree</h2>
        <p className={sectionProseClass}>
          How these seven philosophies actually relate to each other and to the coaches who shaped them, drawn
          from the same influence data on each coach&rsquo;s own page. Not every philosophy here descends from
          another — some emerged independently, which is exactly why they appear as separate roots rather than
          forced into one connected chain.
        </p>
        <div className="mt-8 rounded-2xl border border-black/10 bg-white p-6 shadow-card sm:p-8 dark:border-white/10 dark:bg-zinc-900">
          <FamilyTree roots={FAMILY_FOREST} />
        </div>
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Shared Principles</p>
        <h2 className={sectionHeadingClass}>Where Everyone Agrees</h2>
        <div className="mt-8 rounded-2xl border border-black/10 bg-black/[0.02] p-6 sm:p-8 dark:border-white/10 dark:bg-white/[0.02]">
          <ul className="space-y-3 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
            {SHARED_PRINCIPLES.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className={sectionDividerClass}>
        <div className="rounded-2xl bg-zinc-900 px-6 py-10 text-white sm:px-10 dark:bg-zinc-800">
          <p className="text-xs font-semibold tracking-[0.2em] text-zinc-400 uppercase">Major Disagreements</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Where Philosophies Diverge</h2>
          <ul className="mt-6 space-y-3 text-lg leading-8 text-zinc-300">
            {DISAGREEMENTS.map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden="true" className="text-zinc-500">
                  ×
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
