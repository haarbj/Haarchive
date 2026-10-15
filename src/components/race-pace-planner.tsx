"use client";

import { useId } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";

import { SaveCalculationButton } from "@/components/save-calculation-button";
import { Button } from "@/components/ui/button";
import { LabeledInput } from "@/components/ui/labeled-input";
import { evaluateConditions, type ConditionsInput } from "@/lib/race-pace-planner/conditions";
import { buildFuelingSchedule } from "@/lib/race-pace-planner/fueling-plan";
import {
  averageHillImpactSecPerMile,
  buildCheckpoints,
  buildRacePacePlan,
  formatPace,
  type PlanMile,
  type RaceClimb,
  type StartStrategy,
} from "@/lib/race-pace-planner/pace-plan";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { formatClock, parseTimeToSeconds } from "@/lib/running-format";
import { usePersistedField, usePersistedJSON } from "@/lib/use-persisted-field";
import {
  detailsBodyClass,
  detailsClass,
  heroCardClass,
  sectionLabelClass,
  segmentedButtonClass,
  statCardClass,
  statLabelClass,
  summaryClass,
} from "@/lib/tool-styles";

const STORAGE_KEY = "haarchive-race-pace-planner-state";
const DEFAULT_CLIMB: RaceClimb = { atMile: 10, lengthMiles: 1, feet: 150, direction: "climb" };

type PersistedState = {
  goalTimeInput: string;
  strategy: StartStrategy;
  totalGainFtInput: string;
  totalLossFtInput: string;
  climbs: RaceClimb[];
  useConditions: boolean;
  tempFInput: string;
  humidityInput: string;
  windMphInput: string;
  altitudeDiffFtInput: string;
  carbRateInput: string;
  gelGramsInput: string;
  caffeineEnabled: boolean;
};

const EFFORT_TONE: Record<PlanMile["effort"], string> = {
  Relaxed: "text-zinc-600 dark:text-zinc-300",
  "Settling in": "text-zinc-700 dark:text-zinc-200",
  "Marathon effort": "text-zinc-900 dark:text-white",
  "Comfortably hard": "text-amber-700 dark:text-amber-400",
  "Strong finish": "text-emerald-700 dark:text-emerald-400",
};

// A race-day planner that turns a goal pace, a sketch of the course's
// hills, and expected conditions into a mile-by-mile plan, a fueling
// schedule, and segment-by-segment mental strategy -- the "what do I
// actually do on race day" layer, not a fitness-prediction model. See
// pace-plan.ts's own module doc for how this deliberately differs in
// shape from the Marathon Pacing Calculator's GPS/physics engine: this
// tool works from what a runner can read off a course map (a goal time,
// total gain/loss, a few named climbs), not an uploaded route file.
export function RacePacePlanner() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [goalTimeInput, setGoalTimeInput] = usePersistedField(persisted?.goalTimeInput, "3:45:00");
  const [strategy, setStrategy] = usePersistedField<StartStrategy>(persisted?.strategy, "progressive");
  const [totalGainFtInput, setTotalGainFtInput] = usePersistedField(persisted?.totalGainFtInput, "0");
  const [totalLossFtInput, setTotalLossFtInput] = usePersistedField(persisted?.totalLossFtInput, "0");
  const [climbs, setClimbs] = usePersistedField<RaceClimb[]>(persisted?.climbs, []);

  const [useConditions, setUseConditions] = usePersistedField(persisted?.useConditions, false);
  const [tempFInput, setTempFInput] = usePersistedField(persisted?.tempFInput, "55");
  const [humidityInput, setHumidityInput] = usePersistedField(persisted?.humidityInput, "50");
  const [windMphInput, setWindMphInput] = usePersistedField(persisted?.windMphInput, "5");
  const [altitudeDiffFtInput, setAltitudeDiffFtInput] = usePersistedField(persisted?.altitudeDiffFtInput, "0");

  const [carbRateInput, setCarbRateInput] = usePersistedField(persisted?.carbRateInput, "60");
  const [gelGramsInput, setGelGramsInput] = usePersistedField(persisted?.gelGramsInput, "25");
  const [caffeineEnabled, setCaffeineEnabled] = usePersistedField(persisted?.caffeineEnabled, false);

  function persistState() {
    try {
      const state: PersistedState = {
        goalTimeInput,
        strategy,
        totalGainFtInput,
        totalLossFtInput,
        climbs,
        useConditions,
        tempFInput,
        humidityInput,
        windMphInput,
        altitudeDiffFtInput,
        carbRateInput,
        gelGramsInput,
        caffeineEnabled,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }

  function updateClimb(index: number, patch: Partial<RaceClimb>) {
    setClimbs(climbs.map((climb, i) => (i === index ? { ...climb, ...patch } : climb)));
    persistState();
  }

  function addClimb() {
    setClimbs([...climbs, { ...DEFAULT_CLIMB }]);
    persistState();
  }

  function removeClimb(index: number) {
    setClimbs(climbs.filter((_, i) => i !== index));
    persistState();
  }

  const goalTimeSeconds = parseTimeToSeconds(goalTimeInput);
  const totalGainFt = Number(totalGainFtInput);
  const totalLossFt = Number(totalLossFtInput);
  const courseValid = Number.isFinite(totalGainFt) && Number.isFinite(totalLossFt);

  const canGeneratePlan = goalTimeSeconds !== null && goalTimeSeconds > 0 && courseValid;

  const plan = canGeneratePlan
    ? buildRacePacePlan(goalTimeSeconds!, strategy, {
        totalGainFt: Math.max(0, totalGainFt),
        totalLossFt: Math.max(0, totalLossFt),
        climbs,
      })
    : null;

  const checkpoints = plan ? buildCheckpoints(plan) : [];
  const hillImpact = plan ? averageHillImpactSecPerMile(plan) : 0;

  const tempFRaw = Number(tempFInput);
  const humidityRaw = Number(humidityInput);
  const windMphRaw = Number(windMphInput);
  const altitudeDiffFtRaw = Number(altitudeDiffFtInput);
  const conditionsValid =
    Number.isFinite(tempFRaw) && Number.isFinite(humidityRaw) && Number.isFinite(windMphRaw) && Number.isFinite(altitudeDiffFtRaw);
  const conditionsInput: ConditionsInput = {
    tempF: tempFRaw,
    humidityPct: humidityRaw,
    windMph: windMphRaw,
    altitudeDiffFt: altitudeDiffFtRaw,
  };
  const conditionFlags = useConditions && conditionsValid ? evaluateConditions(conditionsInput) : [];

  const carbRateRaw = Number(carbRateInput);
  const gelGramsRaw = Number(gelGramsInput);
  const fuelingValid = Number.isFinite(carbRateRaw) && carbRateRaw > 0 && Number.isFinite(gelGramsRaw) && gelGramsRaw > 0;
  const fuelingSchedule = plan && fuelingValid
    ? buildFuelingSchedule(plan, { carbGramsPerHour: carbRateRaw, gelCarbGrams: gelGramsRaw, caffeineEnabled })
    : null;

  return (
    <div className="mt-10 space-y-10">
      <div>
        <p className={sectionLabelClass}>Goal</p>
        <div className={`${statCardClass} space-y-4`}>
          <div className="flex flex-wrap items-end gap-4">
            <LabeledInput
              id={`${baseId}-goal-time`}
              label="Goal marathon time"
              type="text"
              value={goalTimeInput}
              onChange={(event) => {
                setGoalTimeInput(event.target.value);
                persistState();
              }}
              placeholder="h:mm:ss"
              autoComplete="off"
              className="w-32"
            />
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            Use your honest current-fitness estimate here, a range is fine, not a number you hope race day magic
            will deliver. Need help landing on one? The{" "}
            <Link
              href="/cv-threshold-calculator"
              className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
            >
              Threshold, CV &amp; VO2 Max Pace Calculator
            </Link>{" "}
            and{" "}
            <Link
              href="/marathon-pacing-calculator"
              className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
            >
              Marathon Pacing Calculator
            </Link>{" "}
            can both help you get there from a recent race.
          </p>
          <div>
            <p className={labelClass}>Start strategy</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStrategy("progressive");
                  persistState();
                }}
                aria-pressed={strategy === "progressive"}
                className={segmentedButtonClass(strategy === "progressive")}
              >
                Progressive (recommended)
              </button>
              <button
                type="button"
                onClick={() => {
                  setStrategy("even");
                  persistState();
                }}
                aria-pressed={strategy === "even"}
                className={segmentedButtonClass(strategy === "even")}
              >
                Even
              </button>
            </div>
            <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              {strategy === "progressive"
                ? "Opens a bit slower than goal pace and converges by mile 5 -- a buffer against a too-fast start, the most common way a marathon goes wrong."
                : "Holds goal pace from mile 1 -- a reasonable choice if you've already practiced even pacing in training and trust your own restraint."}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className={sectionLabelClass}>Course</p>
        <div className={`${statCardClass} space-y-4`}>
          <div className="flex flex-wrap gap-4">
            <LabeledInput
              id={`${baseId}-gain`}
              label="Total elevation gain (ft)"
              type="number"
              inputMode="decimal"
              min={0}
              value={totalGainFtInput}
              onChange={(event) => {
                setTotalGainFtInput(event.target.value);
                persistState();
              }}
              className="w-32"
            />
            <LabeledInput
              id={`${baseId}-loss`}
              label="Total elevation loss (ft)"
              type="number"
              inputMode="decimal"
              min={0}
              value={totalLossFtInput}
              onChange={(event) => {
                setTotalLossFtInput(event.target.value);
                persistState();
              }}
              className="w-32"
            />
          </div>

          <div>
            <p className={labelClass}>Notable climbs &amp; descents</p>
            <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-300">
              Only the hills big enough to actually change your pacing -- a net change of 15ft/mi or less is roughly
              5 seconds of noise and gets ignored. This can&rsquo;t discover a short, steep hill in the middle of a
              mile you haven&rsquo;t named here; for that level of precision from an actual GPS course file, see the{" "}
              <Link
                href="/marathon-pacing-calculator"
                className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
              >
                Marathon Pacing Calculator
              </Link>
              .
            </p>
            <div className="space-y-3">
              {climbs.map((climb, index) => (
                <div key={index} className="flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-3 dark:border-white/10">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateClimb(index, { direction: "climb" })}
                      aria-pressed={climb.direction === "climb"}
                      className={segmentedButtonClass(climb.direction === "climb")}
                    >
                      Climb
                    </button>
                    <button
                      type="button"
                      onClick={() => updateClimb(index, { direction: "descent" })}
                      aria-pressed={climb.direction === "descent"}
                      className={segmentedButtonClass(climb.direction === "descent")}
                    >
                      Descent
                    </button>
                  </div>
                  <div>
                    <label htmlFor={`${baseId}-climb-${index}-mile`} className={labelClass}>
                      At mile
                    </label>
                    <input
                      id={`${baseId}-climb-${index}-mile`}
                      type="number"
                      inputMode="decimal"
                      min={1}
                      max={26}
                      value={climb.atMile}
                      onChange={(event) => updateClimb(index, { atMile: Number(event.target.value) })}
                      className={`w-20 ${fieldClass}`}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${baseId}-climb-${index}-length`} className={labelClass}>
                      Length (mi)
                    </label>
                    <input
                      id={`${baseId}-climb-${index}-length`}
                      type="number"
                      inputMode="decimal"
                      min={0.1}
                      step={0.1}
                      value={climb.lengthMiles}
                      onChange={(event) => updateClimb(index, { lengthMiles: Number(event.target.value) })}
                      className={`w-20 ${fieldClass}`}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${baseId}-climb-${index}-feet`} className={labelClass}>
                      Elevation change (ft)
                    </label>
                    <input
                      id={`${baseId}-climb-${index}-feet`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={climb.feet}
                      onChange={(event) => updateClimb(index, { feet: Number(event.target.value) })}
                      className={`w-24 ${fieldClass}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeClimb(index)}
                    aria-label={`Remove climb at mile ${climb.atMile}`}
                    className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-black/5 hover:text-red-700 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={addClimb}>
              + Add a climb or descent
            </Button>
          </div>
        </div>
      </div>

      <div>
        <p className={sectionLabelClass}>Expected conditions</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setUseConditions(false);
              persistState();
            }}
            aria-pressed={!useConditions}
            className={segmentedButtonClass(!useConditions)}
          >
            Ideal
          </button>
          <button
            type="button"
            onClick={() => {
              setUseConditions(true);
              persistState();
            }}
            aria-pressed={useConditions}
            className={segmentedButtonClass(useConditions)}
          >
            Set conditions
          </button>
        </div>
        {useConditions && (
          <div className={`${statCardClass} mt-3 space-y-4`}>
            <div className="flex flex-wrap gap-4">
              <LabeledInput
                id={`${baseId}-temp`}
                label="Temperature (°F)"
                type="number"
                inputMode="decimal"
                value={tempFInput}
                onChange={(event) => {
                  setTempFInput(event.target.value);
                  persistState();
                }}
                className="w-24"
              />
              <LabeledInput
                id={`${baseId}-humidity`}
                label="Humidity (%)"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                value={humidityInput}
                onChange={(event) => {
                  setHumidityInput(event.target.value);
                  persistState();
                }}
                className="w-24"
              />
              <LabeledInput
                id={`${baseId}-wind`}
                label="Wind (mph)"
                type="number"
                inputMode="decimal"
                min={0}
                value={windMphInput}
                onChange={(event) => {
                  setWindMphInput(event.target.value);
                  persistState();
                }}
                className="w-24"
              />
              <LabeledInput
                id={`${baseId}-altitude`}
                label="Race altitude vs. training (ft)"
                type="number"
                inputMode="decimal"
                value={altitudeDiffFtInput}
                onChange={(event) => {
                  setAltitudeDiffFtInput(event.target.value);
                  persistState();
                }}
                className="w-32"
              />
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              These are estimates to help you plan, not precise time corrections -- for that level of precision, see
              the{" "}
              <Link
                href="/environmental-calculator"
                className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
              >
                Environmental Performance Calculator
              </Link>
              .
            </p>
            {conditionFlags.length > 0 && (
              <div className="space-y-2">
                {conditionFlags.map((flag, i) => (
                  <p key={i} className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                    {flag.note}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!canGeneratePlan && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Enter a valid goal marathon time to generate a plan.</p>
      )}

      {plan && (
        <>
          <div>
            <p className={sectionLabelClass}>Big picture (don&rsquo;t memorize the splits)</p>
            <div className={heroCardClass}>
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                {strategy === "progressive"
                  ? `Open relaxed, around ${formatPace(plan.miles[0].flatPaceSecPerMile)}, and let it come down to your real goal pace of ${formatPace(plan.goalPaceSecPerMile)} by mile 5.`
                  : `Settle into your goal pace of ${formatPace(plan.goalPaceSecPerMile)} from the first mile and hold it.`}{" "}
                Cruise there through the middle of the race, then shift gears for your final push starting around
                mile {plan.finishKickStartMile}
                {" -- "}that&rsquo;s where this plan asks for strength and intensity, not just steady effort.
                {hillImpact !== 0 && (
                  <>
                    {" "}
                    The hills you&rsquo;ve named here swing your pace by roughly {Math.round(Math.abs(hillImpact))}
                    {" seconds/mile on average when you hit them -- expect that, don’t fight it."}
                  </>
                )}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {checkpoints.map((checkpoint) => (
                  <div key={checkpoint.label} className={statCardClass}>
                    <p className={statLabelClass}>{checkpoint.label}</p>
                    <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
                      {formatClock(Math.round(checkpoint.elapsedSeconds))}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
                Projected finish: {formatClock(Math.round(plan.totalElapsedSeconds))}
                {" (full miles only -- the last partial 0.2mi isn’t split out separately)."}
              </p>
            </div>
          </div>

          <div>
            <p className={sectionLabelClass}>Mile-by-mile plan</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-xs tracking-wide text-zinc-600 uppercase dark:border-white/10 dark:text-zinc-300">
                    <th className="py-2 pr-3">Mile</th>
                    <th className="py-2 pr-3">Watch pace</th>
                    <th className="py-2 pr-3">Elapsed</th>
                    <th className="py-2 pr-3">Effort</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.miles.map((mile) => (
                    <tr key={mile.mile} className="border-b border-black/5 last:border-0 dark:border-white/5">
                      <td className="py-1.5 pr-3 font-semibold text-zinc-900 dark:text-white">{mile.mile}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{formatPace(mile.watchPaceSecPerMile)}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{formatClock(Math.round(mile.elapsedSeconds))}</td>
                      <td className={`py-1.5 pr-3 font-medium ${EFFORT_TONE[mile.effort]}`}>{mile.effort}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
              Watch pace already includes the grade adjustment for any climb or descent you named above. Effort is
              what that mile should feel like, not just what the watch says -- a climb mile is marked
              &ldquo;Comfortably hard&rdquo; even though the pace already slowed for it, because the point of grade
              adjustment is to keep effort level, not the number on your wrist.
            </p>

            <SaveCalculationButton
              calculatorType="race-pace-planner"
              input={{ goalTimeInput, strategy, totalGainFtInput, totalLossFtInput, climbs }}
              output={{ projectedFinish: formatClock(Math.round(plan.totalElapsedSeconds)) }}
              label={`${goalTimeInput} marathon, ${strategy} start`}
            />
          </div>

          <div>
            <p className={sectionLabelClass}>Fueling schedule</p>
            <div className={`${statCardClass} space-y-4`}>
              <div className="flex flex-wrap gap-4">
                <LabeledInput
                  id={`${baseId}-carb-rate`}
                  label="Target carb rate (g/hr)"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  value={carbRateInput}
                  onChange={(event) => {
                    setCarbRateInput(event.target.value);
                    persistState();
                  }}
                  className="w-24"
                />
                <LabeledInput
                  id={`${baseId}-gel-grams`}
                  label="Gel carb content (g)"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  value={gelGramsInput}
                  onChange={(event) => {
                    setGelGramsInput(event.target.value);
                    persistState();
                  }}
                  className="w-24"
                />
                <div>
                  <p className={labelClass}>Caffeine</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCaffeineEnabled(false);
                        persistState();
                      }}
                      aria-pressed={!caffeineEnabled}
                      className={segmentedButtonClass(!caffeineEnabled)}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCaffeineEnabled(true);
                        persistState();
                      }}
                      aria-pressed={caffeineEnabled}
                      className={segmentedButtonClass(caffeineEnabled)}
                    >
                      Yes
                    </button>
                  </div>
                </div>
              </div>

              {fuelingSchedule && (
                <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-200">
                  <p>
                    Pre-race gel: ~{fuelingSchedule.preRaceGel.minutesBeforeStart} minutes before the start.
                  </p>
                  <ul className="space-y-1.5">
                    {fuelingSchedule.gels.map((gel) => (
                      <li key={gel.atMinute}>
                        ~Mile {gel.nearMile} ({gel.atMinute} min): {gel.note}
                        {gel.optional ? " -- optional, skip if your stomach's iffy this late" : ""}
                      </li>
                    ))}
                  </ul>
                  {fuelingSchedule.mouthRinseInsteadOfFinalGel && (
                    <p>
                      In the last stretch of the race, too close to the finish for another gel to help, swish a
                      carbohydrate drink and spit it out instead -- a real, smaller benefit from the mouth sensing
                      carbs, without the gut having to process anything this late.
                    </p>
                  )}
                  {fuelingSchedule.caffeine && (
                    <p>
                      Caffeine: {fuelingSchedule.caffeine.firstDoseMg}mg 45-60 minutes before the start, then another{" "}
                      {fuelingSchedule.caffeine.secondDoseMg}mg around {fuelingSchedule.caffeine.secondDoseAtMinute}{" "}
                      minutes into the race. Nothing in the final hour -- it won&rsquo;t take effect in time to help.
                    </p>
                  )}
                  <p>
                    Hydration: drink to thirst at aid stations, not a fixed schedule -- don&rsquo;t try to fully
                    replace what you&rsquo;re sweating out, that&rsquo;s neither necessary nor realistic mid-race.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <p className={sectionLabelClass}>Race-day strategy, segment by segment</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={statCardClass}>
                <p className={statLabelClass}>Opening miles</p>
                <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-200">
                  Stay relaxed and let your pace converge toward target -- the race is long, and nothing worth
                  winning happens in the first mile.
                </p>
              </div>
              <div className={statCardClass}>
                <p className={statLabelClass}>Middle miles</p>
                <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-200">
                  Click off the miles smoothly. Spot-check your pace every couple of miles rather than staring at
                  your watch constantly -- trust the plan between checks.
                </p>
              </div>
              <div className={statCardClass}>
                <p className={statLabelClass}>Final miles</p>
                <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-200">
                  Shift from relaxation to strength and intensity. Push toward your limit without tipping into the
                  abyss -- there&rsquo;s a real difference between running hard and running yourself into the wall.
                </p>
              </div>
              <div className={statCardClass}>
                <p className={statLabelClass}>The finish</p>
                <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-200">
                  Build momentum rather than just surviving. Don&rsquo;t lose speed drifting wide through turns or
                  weaving traffic, and save a real kick for the last 400-800m.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="space-y-2">
        <details className={detailsClass}>
          <summary className={summaryClass}>
            <span
              aria-hidden="true"
              className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
            >
              ▶
            </span>
            Honest caveats
          </summary>
          <div className={detailsBodyClass}>
            <p>
              Your goal pace should reflect your actual current fitness, a range is a perfectly reasonable input,
              not a number you&rsquo;re hoping race-day magic delivers. This plan can&rsquo;t discover a hill you
              didn&rsquo;t name, and its grade adjustment is a widely-used rule of thumb, not a fitted physical
              model -- for that level of precision from a real GPS course file, see the{" "}
              <Link
                href="/marathon-pacing-calculator"
                className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
              >
                Marathon Pacing Calculator
              </Link>
              , and for precise grade-adjusted pace on its own, see the{" "}
              <Link
                href="/gap-calculator"
                className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
              >
                GAP Calculator
              </Link>
              . Most importantly: the plan bends. Something will go wrong on race day, a bathroom stop, a bad patch,
              weather that didn&rsquo;t match the forecast, and the right response is to deal with it and return to
              the plan, not to abandon it over one rough mile.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
