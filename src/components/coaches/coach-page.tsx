import type { ReactNode } from "react";
import Link from "next/link";

import { coachMap } from "@/lib/coaches/data";
import type { Coach } from "@/lib/coaches/types";
import { PHYSIOLOGY_TOPICS } from "@/lib/coaches/physiology-topics";
import { CoachGenomeChart } from "./coach-genome-chart";
import { GenealogyDiagram } from "./genealogy-diagram";
import { DecisionTree } from "./decision-tree";
import { Bibliography } from "./bibliography";
// EvidenceMeter is temporarily unused sitewide -- coaches reviewing their own
// pages (starting with Tom Schwartz) should focus on factual accuracy, not
// get sidetracked by a 1-5 evidence rating. Re-wire once reviews are done.
// import { EvidenceMeter } from "./evidence-meter";
import { AtAGlance } from "./at-a-glance";
import { WorkoutReactions } from "./workout-reactions";
import { OtherCoachesCritique } from "./other-coaches-critique";
import { Card } from "@/components/ui/card";
import { CardLink } from "@/components/ui/card-link";
import { ContentCallout } from "@/components/content-callout";
import {
  eyebrowClass,
  sectionHeadingClass,
  sectionDividerClass,
  sectionProseClass,
  inlineLinkClass,
} from "@/lib/section-styles";

type CoachPageProps = {
  coach: Coach;
};

const pillClass =
  "rounded-pill border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200";

// A muted, tinted card -- distinct from the plain white/zinc-900 Card
// component -- used sparingly to mark the handful of sections that benefit
// from reading as their own distinct "zone" on a now much longer page
// (Common Criticisms, Daily Life) rather than blurring into the section
// above and below it. Same neutral palette as the rest of the site, just a
// soft fill instead of a border, so it varies rhythm without introducing a
// new color.
const tintedCardClass = "rounded-2xl border border-black/10 bg-black/[0.02] p-6 sm:p-8 dark:border-white/10 dark:bg-white/[0.02]";

function LabeledRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-black/5 py-4 last:border-b-0 dark:border-white/10">
      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{label}</p>
      <p className="mt-1.5 text-sm leading-6 text-zinc-700 dark:text-zinc-200">{children}</p>
    </div>
  );
}

// Every coach page's body -- Philosophy through Related Philosophies. The
// hero (name, one-liner, optional Reviewed-by badge) is rendered by the
// route's page.tsx instead, using the same Heading/mission pattern every
// other page on the site uses, so a coach page's top matches everywhere
// else exactly.
export function CoachPage({ coach }: CoachPageProps) {
  return (
    <>
      <div className="mt-10">
        <AtAGlance coach={coach} />
      </div>

      {coach.historicalContext ? (
        <section className={sectionDividerClass}>
          <p className={eyebrowClass}>Historical Context</p>
          <h2 className={sectionHeadingClass}>Why This Philosophy Emerged</h2>
          <div className={`${tintedCardClass} mt-8`}>
            <LabeledRow label="Why it emerged">{coach.historicalContext.emergedBecause}</LabeledRow>
            <LabeledRow label="The problem it solved">{coach.historicalContext.problemItSolved}</LabeledRow>
            <LabeledRow label="What came before it">{coach.historicalContext.priorSystems}</LabeledRow>
            <LabeledRow label="What assumptions it challenged">{coach.historicalContext.assumptionsChallenged}</LabeledRow>
            <LabeledRow label="How it influenced later coaching">{coach.historicalContext.laterInfluence}</LabeledRow>
          </div>
        </section>
      ) : null}

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Philosophy</p>
        <h2 className={sectionHeadingClass}>What Limits Performance?</h2>
        {coach.philosophy.map((paragraph, i) => (
          <p key={i} className={sectionProseClass}>
            {paragraph}
          </p>
        ))}
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Core Principles</p>
        <h2 className={sectionHeadingClass}>{coach.name}&rsquo;s Core Principles</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {coach.corePrinciples.map((principle) => (
            <Card key={principle} padding="md">
              <p className="font-semibold text-zinc-900 dark:text-white">{principle}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Physiological Model</p>
        <h2 className={sectionHeadingClass}>Systems This Coach Emphasizes</h2>
        <div className="mt-6 flex flex-wrap gap-2">
          {coach.physiologicalEmphasis.map((key) => {
            const topic = PHYSIOLOGY_TOPICS[key];
            if (!topic) return null;
            return (
              <Link key={key} href={topic.href} className={pillClass}>
                {topic.label}
              </Link>
            );
          })}
        </div>
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Signature Workouts</p>
        <h2 className={sectionHeadingClass}>Sessions That Define the System</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {coach.signatureWorkouts.map((workout) =>
            workout.workoutLibraryHref ? (
              <CardLink key={workout.name} href={workout.workoutLibraryHref} padding="md">
                <h3 className="font-semibold text-zinc-900 dark:text-white">{workout.name}</h3>
                <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">{workout.description}</p>
                <span className="mt-3 inline-flex text-xs font-semibold text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white">
                  See it in the Workout Library →
                </span>
              </CardLink>
            ) : (
              <Card key={workout.name} padding="md">
                <h3 className="font-semibold text-zinc-900 dark:text-white">{workout.name}</h3>
                <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">{workout.description}</p>
              </Card>
            ),
          )}
        </div>
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Periodization</p>
        <h2 className={sectionHeadingClass}>Structuring a Season</h2>
        <p className={sectionProseClass}>{coach.periodizationSummary}</p>
        <div className="mt-8 flex flex-col items-center">
          {coach.periodization.map((stage, i) => (
            <div key={stage.label} className="flex w-full max-w-sm flex-col items-center">
              <div className="w-full rounded-xl border border-black/10 bg-white px-5 py-3 dark:border-white/10 dark:bg-zinc-900">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">{stage.label}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{stage.description}</p>
              </div>
              {i < coach.periodization.length - 1 ? (
                <div aria-hidden="true" className="py-2 text-lg text-zinc-300 dark:text-zinc-700">
                  ↓
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Example Week</p>
        <h2 className={sectionHeadingClass}>What a Week Looks Like</h2>
        <p className={sectionProseClass}>{coach.weeklyStructureNote}</p>
        <div className="mt-8 divide-y divide-black/5 overflow-hidden rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
          {coach.weeklyStructure.map((day) => (
            <div key={day.day} className="flex items-center justify-between gap-4 bg-white px-5 py-3 dark:bg-zinc-900">
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">{day.day}</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-300">{day.session}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Best For</p>
        <h2 className={sectionHeadingClass}>Who This Fits</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {coach.bestFor.map((audience) => (
            <Card key={audience.label} padding="md">
              <p className="font-semibold text-zinc-900 dark:text-white">{audience.label}</p>
              <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">{audience.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Who This Does Not Fit</p>
        <h2 className={sectionHeadingClass}>This System May Not Be Ideal If...</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {coach.notIdealFor.map((audience) => (
            <Card key={audience.label} padding="md" className="border-dashed">
              <p className="font-semibold text-zinc-900 dark:text-white">{audience.label}</p>
              <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">{audience.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Common Criticisms</p>
        <h2 className={sectionHeadingClass}>What Critics Say</h2>
        <div className={`${tintedCardClass} mt-8`}>
          <div className="space-y-6">
            {coach.criticisms.map((item) => (
              <div key={item.criticism} className="border-b border-black/5 pb-6 last:border-b-0 last:pb-0 dark:border-white/10">
                <p className="font-semibold text-zinc-900 dark:text-white">{item.criticism}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{item.explanation}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">How supporters respond: </span>
                  {item.response}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 border-t border-black/10 pt-6 dark:border-white/10">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              The strongest argument in favor
            </p>
            <p className="mt-2 text-sm leading-6 font-medium text-zinc-900 dark:text-white">
              {coach.strongestArgument}
            </p>
          </div>
        </div>
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>What Other Coaches Might Say</p>
        <h2 className={sectionHeadingClass}>How Other Coaches Would Critique This</h2>
        <OtherCoachesCritique critiques={coach.otherCoachesCritique} />
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Common Misunderstandings</p>
        <h2 className={sectionHeadingClass}>What People Get Wrong</h2>
        <div className="mt-8 space-y-4">
          {coach.misunderstandings.map((item) => (
            <div key={item.myth} className="rounded-xl border border-black/10 dark:border-white/10">
              <div className="border-b border-black/5 bg-black/[0.02] px-5 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  People think
                </p>
                <p className="mt-1 font-medium text-zinc-900 dark:text-white">{item.myth}</p>
              </div>
              <div className="px-5 py-3">
                <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  Reality
                </p>
                <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">{item.reality}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>If You Trained Under This Coach</p>
        <h2 className={sectionHeadingClass}>If {coach.name} Coached You</h2>
        <p className={sectionProseClass}>{coach.dailyLife.narrative}</p>
        <div className={`${tintedCardClass} mt-8`}>
          <LabeledRow label="Easy days feel like">{coach.dailyLife.easyDays}</LabeledRow>
          <LabeledRow label="Hard sessions feel like">{coach.dailyLife.hardSessions}</LabeledRow>
          <LabeledRow label="How often workouts occur">{coach.dailyLife.frequency}</LabeledRow>
          <LabeledRow label="Recovery philosophy">{coach.dailyLife.recovery}</LabeledRow>
          <LabeledRow label="Mileage expectations">{coach.dailyLife.mileage}</LabeledRow>
          <LabeledRow label="Progression through the season">{coach.dailyLife.progression}</LabeledRow>
          <LabeledRow label="How mistakes are handled">{coach.dailyLife.mistakes}</LabeledRow>
        </div>
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>If This Coach Watched Your Workout</p>
        <h2 className={sectionHeadingClass}>Practical Interpretation</h2>
        <WorkoutReactions reactions={coach.workoutReactions} />
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Lasting Influence</p>
        <h2 className={sectionHeadingClass}>What Changed Because {coach.name} Existed</h2>
        {coach.lastingInfluence.paragraphs.map((paragraph, i) => (
          <p key={i} className={sectionProseClass}>
            {paragraph}
          </p>
        ))}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {coach.lastingInfluence.items.map((item) => (
            <Card key={item.label} padding="md">
              <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                {item.label}
              </p>
              <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-200">{item.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Influenced By</p>
        <h2 className={sectionHeadingClass}>Genealogy</h2>
        <GenealogyDiagram tiers={coach.influencedBy} coachName={coach.name} />
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Notable Athletes</p>
        <h2 className={sectionHeadingClass}>Runners Associated With This Philosophy</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {coach.notableAthletes.map((athlete) => (
            <Card key={athlete.name} padding="md">
              <p className="font-semibold text-zinc-900 dark:text-white">
                {athlete.slug ? (
                  <Link
                    href={`/athlete-library/${athlete.slug}`}
                    className="underline decoration-black/20 underline-offset-4 transition hover:decoration-black/60 dark:decoration-white/30 dark:hover:decoration-white/70"
                  >
                    {athlete.name}
                  </Link>
                ) : (
                  athlete.name
                )}
              </p>
              <p className="mt-0.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                {athlete.events} · {athlete.relationship === "coached" ? "Directly coached" : "Influenced"}
              </p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{athlete.whyRepresentative}</p>
              {athlete.caseStudy ? (
                <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/10">
                  <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                    Example week
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {athlete.caseStudy.exampleWeek.map((item, i) => (
                      <li key={i} className="text-sm text-zinc-600 dark:text-zinc-300">
                        • {item}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-200">Race outcome: </span>
                    {athlete.caseStudy.raceOutcome}
                  </p>
                  <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-200">Why it fits: </span>
                    {athlete.caseStudy.whyItFits}
                  </p>
                </div>
              ) : null}
              {athlete.slug ? (
                <Link
                  href={`/athlete-library/${athlete.slug}`}
                  className="mt-3 inline-flex text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                  View athlete profile →
                </Link>
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Decision Tree</p>
        <h2 className={sectionHeadingClass}>How {coach.name} Makes Decisions</h2>
        <DecisionTree scenarios={coach.decisionScenarios} />
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Bibliography</p>
        <h2 className={sectionHeadingClass}>Go Deeper</h2>
        <Bibliography sources={coach.primarySources} />
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Coach Genome</p>
        <h2 className={sectionHeadingClass}>Emphasis at a Glance</h2>
        <p className={sectionProseClass}>
          Not a ranking — just where {coach.name} puts training emphasis, relative to the other six systems in
          the{" "}
          <Link href="/coaching-library" className={inlineLinkClass}>
            Coaching Library
          </Link>
          .
        </p>
        <div className="mt-8 max-w-2xl">
          <CoachGenomeChart genome={coach.genome} />
        </div>
      </section>

      <section className={sectionDividerClass}>
        <ContentCallout variant="takeaway" title="Key Takeaways" items={coach.keyTakeaways} />
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Related Philosophies</p>
        <h2 className={sectionHeadingClass}>Compare With...</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {coach.relatedPhilosophies.map((related) => {
            const relatedCoach = coachMap.get(related.slug);
            if (!relatedCoach) return null;
            return (
              <CardLink key={related.slug} href={`/coaching-library/${related.slug}`} padding="md">
                <h3 className="font-semibold text-zinc-900 dark:text-white">{relatedCoach.name}</h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">Shared: </span>
                  {related.shared}
                </p>
                <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">Difference: </span>
                  {related.difference}
                </p>
                <span className="mt-3 inline-flex text-xs font-semibold text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white">
                  View philosophy →
                </span>
              </CardLink>
            );
          })}
        </div>
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Keep Exploring</p>
        <h2 className={sectionHeadingClass}>Related on the Haarchive</h2>
        <div className="mt-6 flex flex-wrap gap-2">
          {coach.crossLinks.map((link) => (
            <Link key={link.href} href={link.href} className={pillClass}>
              {link.label} →
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
