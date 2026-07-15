import Link from "next/link";

import type { Athlete } from "@/lib/athletes/types";
import { PHYSIOLOGY_TOPICS } from "@/lib/coaches/physiology-topics";
import { CoachTimeline } from "./coach-timeline";
import { Card } from "@/components/ui/card";
import { CardLink } from "@/components/ui/card-link";
import {
  eyebrowClass,
  sectionHeadingClass,
  sectionDividerClass,
  sectionProseClass,
} from "@/lib/section-styles";

type AthletePageProps = {
  athlete: Athlete;
};

const pillClass =
  "rounded-pill border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200";

const tintedCardClass =
  "rounded-2xl border border-black/10 bg-black/[0.02] p-6 sm:p-8 dark:border-white/10 dark:bg-white/[0.02]";

// Every athlete page's body -- the same "one shared template" principle as
// CoachPage. This is deliberately NOT a biography: every section exists to
// show how a coaching philosophy actually showed up in this athlete's
// training (Coaching Philosophy, Coaches Timeline, Signature Training,
// Famous Sessions, Physiology Connections), not to catalog their life. The
// hero (name, one-liner) is rendered by the route's page.tsx, matching
// CoachPage's own split.
export function AthletePage({ athlete }: AthletePageProps) {
  return (
    <>
      <section className={`${sectionDividerClass} mt-10`}>
        <div className={tintedCardClass}>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                Country
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">{athlete.country}</p>
              <p className="mt-4 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                Primary Events
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">{athlete.primaryEvents}</p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                Personal Bests
              </p>
              <ul className="mt-1.5 space-y-1">
                {athlete.personalBests.map((pb) => (
                  <li key={pb.event} className="text-sm text-zinc-700 dark:text-zinc-200">
                    <span className="font-semibold">{pb.event}:</span> {pb.time}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-6 border-t border-black/10 pt-6 dark:border-white/10">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              Major Results
            </p>
            <ul className="mt-1.5 space-y-1">
              {athlete.majorResults.map((result) => (
                <li key={result.competition} className="text-sm text-zinc-700 dark:text-zinc-200">
                  <span className="font-semibold">{result.competition}:</span> {result.result}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Coaching Philosophy</p>
        <h2 className={sectionHeadingClass}>How {athlete.name} Actually Trained</h2>
        {athlete.philosophyNarrative.map((paragraph, i) => (
          <p key={i} className={sectionProseClass}>
            {paragraph}
          </p>
        ))}
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Coaches Timeline</p>
        <h2 className={sectionHeadingClass}>Coaching History</h2>
        <CoachTimeline history={athlete.coachHistory} />
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Signature Training</p>
        <h2 className={sectionHeadingClass}>The Recurring Structure</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {athlete.signatureTraining.map((item) =>
            item.workoutLibraryHref ? (
              <CardLink key={item.name} href={item.workoutLibraryHref} padding="md">
                <h3 className="font-semibold text-zinc-900 dark:text-white">{item.name}</h3>
                <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">{item.description}</p>
                <span className="mt-3 inline-flex text-xs font-semibold text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white">
                  See it in the Workout Library →
                </span>
              </CardLink>
            ) : (
              <Card key={item.name} padding="md">
                <h3 className="font-semibold text-zinc-900 dark:text-white">{item.name}</h3>
                <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">{item.description}</p>
              </Card>
            ),
          )}
        </div>
      </section>

      {athlete.famousSessions.length > 0 ? (
        <section className={sectionDividerClass}>
          <p className={eyebrowClass}>Famous Training Sessions</p>
          <h2 className={sectionHeadingClass}>The Sessions That Defined a Career</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {athlete.famousSessions.map((item) =>
              item.workoutLibraryHref ? (
                <CardLink key={item.name} href={item.workoutLibraryHref} padding="md">
                  <h3 className="font-semibold text-zinc-900 dark:text-white">{item.name}</h3>
                  <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">{item.description}</p>
                  <span className="mt-3 inline-flex text-xs font-semibold text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white">
                    See it in the Workout Library →
                  </span>
                </CardLink>
              ) : (
                <Card key={item.name} padding="md">
                  <h3 className="font-semibold text-zinc-900 dark:text-white">{item.name}</h3>
                  <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">{item.description}</p>
                </Card>
              ),
            )}
          </div>
        </section>
      ) : null}

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Physiology Connections</p>
        <h2 className={sectionHeadingClass}>What This Training Actually Targets</h2>
        <div className="mt-6 flex flex-wrap gap-2">
          {athlete.physiologicalEmphasis.map((key) => {
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
        <p className={eyebrowClass}>Mental Approach</p>
        <h2 className={sectionHeadingClass}>Racing and Training Mindset</h2>
        {athlete.mentalApproachSummary.map((paragraph, i) => (
          <p key={i} className={sectionProseClass}>
            {paragraph}
          </p>
        ))}
        {athlete.mentalQuotes.length > 0 ? (
          <div className="mt-8 space-y-4">
            {athlete.mentalQuotes.map((q, i) => (
              <div key={i} className={tintedCardClass}>
                <p className="text-lg leading-8 font-medium text-zinc-900 dark:text-white">&ldquo;{q.quote}&rdquo;</p>
                <p className="mt-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  {q.theme}
                  {q.context ? ` · ${q.context}` : ""}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Recovery</p>
        <h2 className={sectionHeadingClass}>How Recovery Fit Into the System</h2>
        {athlete.recoveryNotes.map((paragraph, i) => (
          <p key={i} className={sectionProseClass}>
            {paragraph}
          </p>
        ))}
      </section>

      {athlete.equipmentNotes && athlete.equipmentNotes.length > 0 ? (
        <section className={sectionDividerClass}>
          <p className={eyebrowClass}>Equipment</p>
          <h2 className={sectionHeadingClass}>Gear Worth Noting</h2>
          {athlete.equipmentNotes.map((paragraph, i) => (
            <p key={i} className={sectionProseClass}>
              {paragraph}
            </p>
          ))}
        </section>
      ) : null}

      <section className={sectionDividerClass}>
        <p className={eyebrowClass}>Keep Exploring</p>
        <h2 className={sectionHeadingClass}>Related on the Haarchive</h2>
        <div className="mt-6 flex flex-wrap gap-2">
          {athlete.crossLinks.map((link) => (
            <Link key={link.href} href={link.href} className={pillClass}>
              {link.label} →
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
