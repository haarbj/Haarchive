"use client";

import { useState } from "react";

import {
  depletionWorkoutEligibility,
  depletionWorkoutGuidance,
  doubleThresholdEligibility,
  doubleThresholdGuidance,
  highMileageGuidance,
  specialBlockEligibility,
  specialBlockGuidance,
  strengthTrainingGuidance,
  STRENGTH_OPTIONS,
  type AdvancedGuidance,
} from "@/lib/private-coaching/advanced-techniques";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Part J, coach-only. Four independent, collapsed-by-default sections --
// high mileage, depletion workouts, double-threshold days, and special
// blocks -- plus the strength reference. Nothing here writes anything;
// every section answers "is this appropriate right now" from inputs the
// coach types in the moment, because these are infrequent, high-stakes
// decisions rather than something to track across sessions.
//
// Depletion's contraindication checklist is answered FIRST and its result
// gates everything else in that section -- the UI structure itself mirrors
// depletionWorkoutEligibility's own "contraindication checked before
// anything else" order, so a coach cannot scroll past it to the workout
// description without passing through the four questions.

function GuidanceBlock({ guidance }: { guidance: AdvancedGuidance }) {
  return (
    <div className="mt-2">
      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{guidance.title}</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{guidance.detail}</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5">
        {guidance.actions.map((action) => (
          <li key={action} className="text-sm text-zinc-600 dark:text-zinc-300">
            {action}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-control border border-black/10 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((prev) => !prev)}>
          {open ? "Hide" : "Show"}
        </Button>
      </div>
      {open ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

export function AdvancedTechniquesPanel() {
  // High mileage.
  const [peakMileage, setPeakMileage] = useState("");
  const [respondedWell, setRespondedWell] = useState(false);
  const [lifestyleSupports, setLifestyleSupports] = useState(false);
  const [stagnating, setStagnating] = useState(false);

  // Depletion.
  const [redsHistory, setRedsHistory] = useState(false);
  const [disorderedEating, setDisorderedEating] = useState(false);
  const [menstrualDisturbance, setMenstrualDisturbance] = useState(false);
  const [overtrainingHistory, setOvertrainingHistory] = useState(false);
  const [aerobicallyStrong, setAerobicallyStrong] = useState(false);
  const [multipleCycles, setMultipleCycles] = useState(false);
  const [depletionMileage, setDepletionMileage] = useState("");
  const [fadesLate, setFadesLate] = useState(false);
  const [depletionForm, setDepletionForm] = useState<"general" | "marathon-specific">("general");

  // Double threshold.
  const [dtMileage, setDtMileage] = useState("");
  const [dtSingleThreshold, setDtSingleThreshold] = useState("");

  // Special block.
  const [sbPhase, setSbPhase] = useState("Specific");
  const [sbMileage, setSbMileage] = useState("");
  const [sbCycles, setSbCycles] = useState("");
  const [sbPacing, setSbPacing] = useState(false);
  const [sbInjuryProne, setSbInjuryProne] = useState(false);
  const [sbRebounding, setSbRebounding] = useState(false);
  const [sbEasyDaysBefore, setSbEasyDaysBefore] = useState("");
  const [sbLowerMileage, setSbLowerMileage] = useState(false);

  const depletionEligibility = depletionWorkoutEligibility({
    redsHistory,
    disorderedEatingHistory: disorderedEating,
    menstrualDisturbanceHistory: menstrualDisturbance,
    overtrainingHistory,
    aerobicallyStrong,
    experiencedMultipleCycles: multipleCycles,
    peakMileage: Number(depletionMileage) || 0,
    fadesLateInMarathon: fadesLate,
  });

  return (
    <Card padding="md">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
        Advanced techniques
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Infrequent, high-stakes decisions. Each section answers whether this is appropriate right now; none of it is
        saved.
      </p>

      <div className="mt-3 space-y-3">
        <Section title="High mileage">
          <label className="block max-w-xs">
            <span className={labelClass}>Current peak weekly mileage</span>
            <input value={peakMileage} onChange={(e) => setPeakMileage(e.target.value)} className={fieldClass} />
          </label>
          <div className="mt-2 space-y-1.5">
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={respondedWell} onChange={(e) => setRespondedWell(e.target.checked)} />
              Responded well to earlier mileage increases
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={lifestyleSupports} onChange={(e) => setLifestyleSupports(e.target.checked)} />
              Lifestyle genuinely supports doubles and the fuelling this needs
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={stagnating} onChange={(e) => setStagnating(e.target.checked)} />
              Stagnating or breaking down at the current mileage
            </label>
          </div>
          <GuidanceBlock
            guidance={highMileageGuidance({
              currentPeakMileage: Number(peakMileage) || 0,
              respondedWellToEarlyIncreases: respondedWell,
              lifestyleSupportsDoubles: lifestyleSupports,
              stagnatingOrBreakingDown: stagnating,
            })}
          />
        </Section>

        <Section title="Depletion workouts">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Contraindication check, first
          </p>
          <div className="mt-1.5 space-y-1.5">
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={redsHistory} onChange={(e) => setRedsHistory(e.target.checked)} />
              History of RED-S
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={disorderedEating} onChange={(e) => setDisorderedEating(e.target.checked)} />
              History of disordered eating
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={menstrualDisturbance}
                onChange={(e) => setMenstrualDisturbance(e.target.checked)}
              />
              History of menstrual disturbance
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={overtrainingHistory} onChange={(e) => setOvertrainingHistory(e.target.checked)} />
              History of overtraining
            </label>
          </div>

          {!depletionEligibility.contraindicated ? (
            <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
              <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                Eligibility
              </p>
              <div className="mt-1.5 space-y-1.5">
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input type="checkbox" checked={aerobicallyStrong} onChange={(e) => setAerobicallyStrong(e.target.checked)} />
                  Aerobically strong
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input type="checkbox" checked={multipleCycles} onChange={(e) => setMultipleCycles(e.target.checked)} />
                  Completed multiple marathon cycles
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input type="checkbox" checked={fadesLate} onChange={(e) => setFadesLate(e.target.checked)} />
                  Documented pattern of fading late in the marathon
                </label>
                <label className="block max-w-xs">
                  <span className={labelClass}>Peak weekly mileage</span>
                  <input value={depletionMileage} onChange={(e) => setDepletionMileage(e.target.value)} className={fieldClass} />
                </label>
                <label className="block max-w-xs">
                  <span className={labelClass}>Form</span>
                  <select
                    value={depletionForm}
                    onChange={(e) => setDepletionForm(e.target.value as "general" | "marathon-specific")}
                    className={fieldClass}
                  >
                    <option value="general">General</option>
                    <option value="marathon-specific">Marathon-specific</option>
                  </select>
                </label>
              </div>
            </div>
          ) : null}

          <GuidanceBlock guidance={depletionWorkoutGuidance(depletionEligibility, depletionForm)} />
        </Section>

        <Section title="Double-threshold days">
          <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Current weekly mileage</span>
              <input value={dtMileage} onChange={(e) => setDtMileage(e.target.value)} className={fieldClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Current single-threshold volume (mi)</span>
              <input value={dtSingleThreshold} onChange={(e) => setDtSingleThreshold(e.target.value)} className={fieldClass} />
            </label>
          </div>
          <GuidanceBlock
            guidance={doubleThresholdGuidance(
              doubleThresholdEligibility({
                currentWeeklyMileage: Number(dtMileage) || 0,
                currentSingleThresholdVolumeMiles: Number(dtSingleThreshold) || 0,
              }),
            )}
          />
        </Section>

        <Section title="Special blocks">
          <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Current phase</span>
              <select value={sbPhase} onChange={(e) => setSbPhase(e.target.value)} className={fieldClass}>
                <option value="General">General</option>
                <option value="Supportive">Supportive</option>
                <option value="Specific">Specific</option>
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Weekly mileage</span>
              <input value={sbMileage} onChange={(e) => setSbMileage(e.target.value)} className={fieldClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Marathon cycles completed</span>
              <input value={sbCycles} onChange={(e) => setSbCycles(e.target.value)} className={fieldClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Easy days immediately before</span>
              <input value={sbEasyDaysBefore} onChange={(e) => setSbEasyDaysBefore(e.target.value)} className={fieldClass} />
            </label>
          </div>
          <div className="mt-2 space-y-1.5">
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={sbPacing} onChange={(e) => setSbPacing(e.target.checked)} />
              Strong pacing discipline
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={sbInjuryProne} onChange={(e) => setSbInjuryProne(e.target.checked)} />
              Injury-prone
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={sbRebounding} onChange={(e) => setSbRebounding(e.target.checked)} />
              Rebounding from a recent setback
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={sbLowerMileage} onChange={(e) => setSbLowerMileage(e.target.checked)} />
              Lower-mileage athlete (scale the day rather than running it full-size)
            </label>
          </div>
          <GuidanceBlock
            guidance={specialBlockGuidance(
              specialBlockEligibility({
                phaseKey: sbPhase,
                currentWeeklyMileage: Number(sbMileage) || 0,
                marathonCyclesCompleted: Number(sbCycles) || 0,
                pacingDisciplineGood: sbPacing,
                injuryProne: sbInjuryProne,
                reboundingFromSetback: sbRebounding,
                easyDaysBefore: Number(sbEasyDaysBefore) || 0,
              }),
              { isLowerMileageAthlete: sbLowerMileage },
            )}
          />
        </Section>

        <Section title="Strength training">
          <GuidanceBlock guidance={strengthTrainingGuidance({ confidentInChoice: true })} />
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {STRENGTH_OPTIONS.map((o) => o.name).join(" · ")}
          </p>
        </Section>
      </div>
    </Card>
  );
}
