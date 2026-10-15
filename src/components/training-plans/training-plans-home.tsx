import Link from "next/link";

import { TRAINING_PLANS } from "@/lib/training-plans/data";
import { TRACK_PROFILES } from "@/lib/training-plans/track-profiles";
import type { TrackKey } from "@/lib/training-plans/types";
import { Card } from "@/components/ui/card";
import {
  eyebrowClass,
  sectionHeadingClass,
  sectionDividerClass,
  sectionProseClass,
} from "@/lib/section-styles";

const TRACK_ORDER: TrackKey[] = ["breeze", "wind", "gale", "tornado", "hurricane"];

function formatMiles(value: number): string {
  return `${Math.round(value)} mi`;
}

// Training Plans' homepage -- registered as this section's own ToolComponent
// (see sectionTools in [slug]/page.tsx). This page used to also carry a
// beginner-program essay and an advanced-periodization essay; neither was
// really about training PLANS, so they moved to How to Start Running
// (Getting Started) and Workout Library respectively, leaving this page
// focused purely on the real, interactive marathon plan picker. Five tracks
// and their mileage stats are computed once in lib/training-plans/data.ts
// from the plans' own workout data, never hand-maintained here.
export function TrainingPlansHome() {
  return (
    <section className={sectionDividerClass}>
      <p className={eyebrowClass}>Marathon Plans</p>
      <h2 className={sectionHeadingClass}>Choose Your Plan</h2>
      <p className={sectionProseClass}>
        Five real, day-by-day marathon plans from John Davis&rsquo;s <em>Marathon Excellence for Everyone</em>,
        each available as a 12- or 18-week build. The tracks are ordered by weekly mileage, not difficulty
        labels: pick the one whose peak week is closest to what you&rsquo;re actually training, or already know
        you can build to. New to running entirely? Start with{" "}
        <Link
          href="/how-to-start-running"
          className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
        >
          How to Start Running
        </Link>{" "}
        instead: these plans assume a real aerobic base already exists.
      </p>

      {/* The generator, not the five fixed tracks -- a prominent link, not
          buried after the five cards below, since this is the more
          customized answer for anyone whose own numbers don't land neatly
          on one of the five reference tracks. */}
      <Card padding="md" emphasis className="mt-8">
        <p className="font-semibold text-zinc-900 dark:text-white">Want a plan built from your own numbers instead?</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Enter your goal race, date, mileage, and days per week to generate a custom day-by-day plan -- free, no
          account needed.
        </p>
        <Link
          href="/training-plans/build"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900 underline decoration-black/20 underline-offset-4 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
        >
          Build my plan <span aria-hidden="true">→</span>
        </Link>
      </Card>

      <div className="mt-8 space-y-4">
        {TRACK_ORDER.map((track) => {
          const plans = TRAINING_PLANS.filter((plan) => plan.track === track);
          const reference = plans[0];
          const profile = TRACK_PROFILES[track];
          return (
            <Card key={track} padding="md">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
                    {reference.trackLabel}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    ~{formatMiles(reference.referenceAvgWeeklyMiles)}/week average · peak week{" "}
                    {formatMiles(reference.referencePeakWeeklyMiles)} · goal times {profile.goalTimeRange}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Best for: {profile.recommendedFor.join(" · ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {plans
                    .slice()
                    .sort((a, b) => a.durationWeeks - b.durationWeeks)
                    .map((plan) => (
                      <Link
                        key={plan.slug}
                        href={`/training-plans/${plan.slug}`}
                        className="rounded-pill border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-black/20 hover:bg-black/[0.02] dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-white/20 dark:hover:bg-white/[0.03]"
                      >
                        {plan.durationWeeks}-week →
                      </Link>
                    ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-zinc-600 dark:text-zinc-300">
        Every plan scales to your own target peak weekly mileage and displays in miles or kilometers: the
        numbers above are each plan&rsquo;s own reference volume, not a fixed requirement. Looking for advanced
        periodization strategy (double threshold, altitude, heat, individualizing the load) instead of a
        specific plan? See{" "}
        <Link
          href="/workout-library"
          className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
        >
          Workout Library
        </Link>
        .
      </p>
    </section>
  );
}
