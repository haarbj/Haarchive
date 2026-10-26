"use client";

import { useActionState, useState } from "react";

import { submitClubIntake } from "./actions";
import { CLUB_INTAKE_WTP_LABELS } from "@/lib/validation/club-intake";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

const WTP_OPTIONS = Object.entries(CLUB_INTAKE_WTP_LABELS) as [keyof typeof CLUB_INTAKE_WTP_LABELS, string][];

const checkboxRow = "flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-200";

export function ClubIntakeForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(submitClubIntake.bind(null, token), {});
  const [goalType, setGoalType] = useState<"finish" | "time">("finish");
  const [interested1on1, setInterested1on1] = useState(false);

  if (state.success) {
    return (
      <p className="text-sm text-zinc-700 dark:text-zinc-200">
        {state.redirectedNotReady
          ? "Thanks for your interest. Keep coming to club runs and build toward 25 mi/week, you'll be set for the next cycle. A kind no beats a resentful one."
          : "You're in. Keep an eye on your notifications for next steps."}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
          Minimum requirements
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
          <li>A GPS watch. Workouts are prescribed by pace and time; logging needs real data. No watch, no plan.</li>
          <li>
            Running regularly now. The 6-week base phase (from Nov 9) is designed to build you up, no hard mileage
            gate. Most athletes will peak around 40-50 mpw.
          </li>
          <li>Available to run 5-7 days a week through the buildup.</li>
          <li>
            A current fitness reference (a recent race works) or run the team 5K time trial Run Club is hosting near
            the end of base (date TBD) to set your paces going into the general phase.
          </li>
          <li>For paid 1-on-1 only: willingness to log workouts and communicate weekly. The feedback loop needs data; no logs, no coaching.</li>
        </ul>
      </section>

      <section>
        <label htmlFor="currentWeeklyMileage" className={labelClass}>
          Current weekly mileage (4-week average)
        </label>
        <input id="currentWeeklyMileage" name="currentWeeklyMileage" type="number" step="0.1" min="0" required className={`w-full ${fieldClass}`} />
      </section>

      <section>
        <h2 className={labelClass}>Recent 5K race result or team time trial</h2>
        <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">
          A current fitness reference works best. No recent 5K? Check the box to use Run Club&rsquo;s team 5K time
          trial near the end of base instead (date TBD).
        </p>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <input name="raceName" placeholder="Race name" className={fieldClass} />
            <input name="raceDate" type="date" className={fieldClass} />
            <input name="finishTimeS" type="number" min="0" placeholder="Finish time (seconds)" className={fieldClass} />
          </div>
          <label className={checkboxRow}>
            <input type="checkbox" name="plansTimeTrial" className="mt-0.5" />
            I&rsquo;ll use the team 5K time trial instead.
          </label>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="yearsRunning" className={labelClass}>
            Years running
          </label>
          <input id="yearsRunning" name="yearsRunning" type="number" min="0" required className={`w-full ${fieldClass}`} />
        </div>
        <div>
          <label htmlFor="plansCompleted" className={labelClass}>
            Marathon or half-marathon plans completed
          </label>
          <input id="plansCompleted" name="plansCompleted" type="number" min="0" defaultValue={0} className={`w-full ${fieldClass}`} />
        </div>
      </section>

      <section>
        <h2 className={labelClass}>Nashville goal</h2>
        <div className="mt-2 flex gap-4 text-sm text-zinc-700 dark:text-zinc-200">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="goalType"
              value="finish"
              checked={goalType === "finish"}
              onChange={() => setGoalType("finish")}
            />
            Just finish
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="goalType"
              value="time"
              checked={goalType === "time"}
              onChange={() => setGoalType("time")}
            />
            Time target
          </label>
        </div>
        {goalType === "time" ? (
          <input
            name="goalTimeS"
            type="number"
            min="0"
            placeholder="Goal time (seconds)"
            className={`mt-3 w-full ${fieldClass}`}
          />
        ) : null}
      </section>

      <section>
        <label htmlFor="injuryHistory" className={labelClass}>
          Injury or illness history
        </label>
        <textarea id="injuryHistory" name="injuryHistory" rows={3} className={`w-full ${fieldClass}`} />
      </section>

      <section>
        <label htmlFor="schoolEmail" className={labelClass}>
          School email (optional, for roster cross-check only)
        </label>
        <input id="schoolEmail" name="schoolEmail" type="email" className={`w-full ${fieldClass}`} />
      </section>

      <section className="rounded-card border border-black/10 p-5 dark:border-white/10">
        <label className={checkboxRow}>
          <input
            type="checkbox"
            name="interested1on1"
            className="mt-0.5"
            checked={interested1on1}
            onChange={(e) => setInterested1on1(e.target.checked)}
          />
          I&rsquo;m interested in paid 1-on-1 coaching.
        </label>

        <div className="mt-6 space-y-6 text-sm text-zinc-600 dark:text-zinc-300">
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-white">Why coach with me</h3>
            <p className="mt-2">
              Coached by Olympic coach Mike Scannell, a mentor I&rsquo;m in regular contact with, and the source of
              much of what I know about coaching. I&rsquo;ve kept learning through running camps and coaching
              clinics since. D1 SEC distance runner at Vanderbilt, NCAA South Region qualifier every year, one of
              four chosen to race as a freshman. In high school I went from Most Coachable as a sophomore to Most
              Inspirational as a junior on a state-championship team, then captain and Team MVP as a senior, 30-40
              mpw as a freshman to 60-80 as a senior. I&rsquo;ve coached runners 1-on-1 since the COVID lockdowns,
              when I founded the Run22 Track Club, which drew 80 of the top 100 fastest high school runners
              nationally in the class of &lsquo;22, and I coach the Vanderbilt Run Club now. I built the platform
              you&rsquo;ll train on, every workout tells you why, not just what, because a good coach makes athletes
              independent, not dependent.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-white">What 1-on-1 entails</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Your plan adapts. Bad week, illness, life, the plan gets retooled around it instead of you guessing.</li>
              <li>Message me in-app. I read your check-ins and training logs.</li>
              <li>Your fitness estimate gets reviewed every 2-4 weeks so your paces stay honest as you get fitter.</li>
              <li>Race-week plan and race-day guidance.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-white">Why 1-on-1</h3>
            <p className="mt-2">
              A training plan is a guess about the future. It&rsquo;s written for the athlete you are today, assuming
              the next 18 weeks go perfectly. They won&rsquo;t. Coaching is the correction loop. When you get sick,
              when a workout goes sideways, when school explodes, the plan gets rebuilt around reality instead of you
              guessing what to do. Your paces get re-anchored every few weeks as your fitness changes, so you&rsquo;re
              always training at the right effort, not last month&rsquo;s. You also get a second pair of eyes. I read
              your logs, I see the patterns you can&rsquo;t see in yourself, and I tell you the truth about what they
              mean, including when the truth is &lsquo;back off.&rsquo; Get hurt and the plan doesn&rsquo;t just stop.
              You get cross-training that holds your fitness together while you heal, pool, bike, whatever you have
              access to, and a structured ramp back, instead of the classic &lsquo;take two weeks off, then try to
              pick up where you left off, then get hurt again.&rsquo; The free plan gives you the what and the why.
              1-on-1 gives you the what-now.
            </p>
          </div>

          <p>
            This is an interest form, not enrollment. Expressing interest doesn&rsquo;t guarantee a coaching spot. If
            demand exceeds capacity, spots go to the most ready athletes first and the rest join a waitlist.
          </p>

          <p>
            Group discount: We&rsquo;re working on a Rock &lsquo;n&rsquo; Roll group discount for the team (10% off
            for groups of 25 or more). Not confirmed yet, details to come once it is. Your submission helps us get
            an accurate headcount, which is what sets the discount tier.
          </p>

          {interested1on1 ? (
            <div className="space-y-4 border-t border-black/10 pt-4 dark:border-white/10">
              <div>
                <h3 className={labelClass}>If offered a spot, what would you pay per month?</h3>
                <select name="wtpBracket" className={`mt-2 w-full ${fieldClass}`} required={interested1on1}>
                  <option value="">Select one</option>
                  {WTP_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <p className={labelClass}>The coaching agreement</p>
                <label className={checkboxRow}>
                  <input type="checkbox" name="agreementLogHonestly" className="mt-0.5" required={interested1on1} />
                  I will log my workouts honestly, including the bad ones. A coach can&rsquo;t adjust what he
                  can&rsquo;t see.
                </label>
                <label className={checkboxRow}>
                  <input type="checkbox" name="agreementSayIfWrong" className="mt-0.5" required={interested1on1} />
                  If something goes wrong (injury, illness, life), I&rsquo;ll say so instead of going silent.
                </label>
                <label className={checkboxRow}>
                  <input type="checkbox" name="agreementRunPrescribedPaces" className="mt-0.5" required={interested1on1} />
                  I&rsquo;ll run the paces the plan prescribes for my current fitness, not the paces I wish I were in
                  shape for.
                </label>
                <label className={checkboxRow}>
                  <input type="checkbox" name="agreementReadTheWhy" className="mt-0.5" required={interested1on1} />
                  I understand the plan explains why, and I&rsquo;ll read the why, not just the what.
                </label>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="text-sm text-zinc-600 dark:text-zinc-300">
        <p>
          Free Club Plan: a framework matched to your mileage, experience, and goal. Full education layer. Logging
          for your own tracking. No messaging, no adjustments, no feedback.
        </p>
      </section>

      {state.error ? <FormError>{state.error}</FormError> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Submitting…" : "Submit"}
      </Button>
    </form>
  );
}
