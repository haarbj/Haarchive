"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";

import { CourseElevationChart } from "@/components/course-elevation-chart";
import { RouteImportPanel } from "@/components/route-import-panel";
import { Button } from "@/components/ui/button";
import { LabeledInput } from "@/components/ui/labeled-input";
import { compareCourses, courseProfileFromAnalysis, courseProfileFromManualEntry, type CourseProfile } from "@/lib/course-comparator/compare";
import { analyzeCourse, type CourseAnalysis } from "@/lib/marathon-pacing/course-analysis";
import { fieldClass, labelClass } from "@/lib/form-styles";
import type { CourseInput, RaceClimb } from "@/lib/race-pace-planner/pace-plan";
import { formatClock } from "@/lib/running-format";
import type { ParsedRoute } from "@/lib/route-import/types";
import type { RouteSummary } from "@/lib/route-import/route-summary";
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
import { usePersistedField, usePersistedJSON } from "@/lib/use-persisted-field";

const STORAGE_KEY = "haarchive-course-comparator-state";
const DEFAULT_CLIMB: RaceClimb = { atMile: 10, lengthMiles: 1, feet: 150, direction: "climb" };

type CourseMode = "gps" | "manual";

type ManualCourseState = {
  courseDistanceMilesInput: string;
  totalGainFtInput: string;
  totalLossFtInput: string;
  climbs: RaceClimb[];
};

const DEFAULT_MANUAL: ManualCourseState = {
  courseDistanceMilesInput: "26.2",
  totalGainFtInput: "0",
  totalLossFtInput: "0",
  climbs: [],
};

type GpsSideState = {
  label: string | null;
  summary: RouteSummary | null;
  analysis: CourseAnalysis | null;
  notice: string | null;
};

const EMPTY_GPS: GpsSideState = { label: null, summary: null, analysis: null, notice: null };

type PersistedState = {
  goalDistanceMilesInput: string;
  labelAInput: string;
  labelBInput: string;
  modeA: CourseMode;
  modeB: CourseMode;
  manualA: ManualCourseState;
  manualB: ManualCourseState;
};

function formatNetGrade(netFt: number): string {
  const rounded = Math.round(netFt);
  if (rounded === 0) return "flat";
  return `${rounded > 0 ? "+" : ""}${rounded}ft`;
}

function buildProfile(mode: CourseMode, manual: ManualCourseState, gps: GpsSideState): CourseProfile | null {
  if (mode === "gps") {
    return gps.analysis ? courseProfileFromAnalysis(gps.analysis) : null;
  }
  const lengthMiles = Number(manual.courseDistanceMilesInput);
  const totalGainFt = Number(manual.totalGainFtInput);
  const totalLossFt = Number(manual.totalLossFtInput);
  if (!Number.isFinite(lengthMiles) || lengthMiles <= 0) return null;
  if (!Number.isFinite(totalGainFt) || !Number.isFinite(totalLossFt)) return null;
  const course: CourseInput = { totalGainFt: Math.max(0, totalGainFt), totalLossFt: Math.max(0, totalLossFt), climbs: manual.climbs };
  return courseProfileFromManualEntry(course, lengthMiles);
}

// A race-day planner answers "how should I pace this," this tool answers
// a narrower upstream question: "which of these two courses is actually
// harder, and by how much." It deliberately reuses the Race Pace
// Planner's exact grade heuristic (pace-plan.ts's netGradeFtForMile/
// gradeAdjustSecPerMile, the same 15ft/mi noise floor) rather than a new
// model -- see compare.ts's own header comment. Each side independently
// accepts a GPS route (GPX/TCX/FIT or Strava, elevation extracted
// automatically) or manual entry (total gain/loss plus named climbs),
// mirroring Race Pace Planner's own two input modes. No weather, wind, or
// altitude adjustment here on purpose -- that's the Environmental
// Performance Calculator's job, linked below rather than duplicated.
export function CourseComparator() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [goalDistanceMilesInput, setGoalDistanceMilesInput] = usePersistedField(persisted?.goalDistanceMilesInput, "26.2");
  const [labelAInput, setLabelAInput] = usePersistedField(persisted?.labelAInput, "Course A");
  const [labelBInput, setLabelBInput] = usePersistedField(persisted?.labelBInput, "Course B");
  const [modeA, setModeA] = usePersistedField<CourseMode>(persisted?.modeA, "manual");
  const [modeB, setModeB] = usePersistedField<CourseMode>(persisted?.modeB, "manual");
  const [manualA, setManualA] = usePersistedField<ManualCourseState>(persisted?.manualA, DEFAULT_MANUAL);
  const [manualB, setManualB] = usePersistedField<ManualCourseState>(persisted?.manualB, DEFAULT_MANUAL);

  // GPS route state is deliberately not persisted, same precedent as the
  // Environmental Calculator and the Race Pace Planner -- re-importing a
  // file is quick, and a route's full point data is too large to
  // round-trip through localStorage.
  const [gpsA, setGpsA] = useState<GpsSideState>(EMPTY_GPS);
  const [gpsB, setGpsB] = useState<GpsSideState>(EMPTY_GPS);

  function persistState(patch: Partial<PersistedState> = {}) {
    try {
      const state: PersistedState = {
        goalDistanceMilesInput,
        labelAInput,
        labelBInput,
        modeA,
        modeB,
        manualA,
        manualB,
        ...patch,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }

  function handleRouteLoadedFor(side: "A" | "B") {
    const setGps = side === "A" ? setGpsA : setGpsB;
    const setMode = side === "A" ? setModeA : setModeB;
    return (summary: RouteSummary, label: string, route: ParsedRoute) => {
      try {
        const analysis = analyzeCourse(route);
        setGps({ label, summary, analysis, notice: null });
      } catch (error) {
        // Too few usable GPS/elevation points to analyze -- fall back to
        // manual entry for THIS side only, with a notice. The other
        // side's own state is a completely separate hook, so it's
        // unaffected either way.
        setGps(EMPTY_GPS);
        setMode("manual");
        persistState({ [side === "A" ? "modeA" : "modeB"]: "manual" });
        setGps({
          label: null,
          summary: null,
          analysis: null,
          notice: `Couldn't read the elevation from ${label} (${error instanceof Error ? error.message : "unknown error"}) -- switched to manual entry for this course instead.`,
        });
      }
    };
  }

  const profileA = buildProfile(modeA, manualA, gpsA);
  const profileB = buildProfile(modeB, manualB, gpsB);

  const goalDistanceMilesRaw = Number(goalDistanceMilesInput);
  const goalDistanceValid = Number.isFinite(goalDistanceMilesRaw) && goalDistanceMilesRaw > 0;

  const comparison =
    profileA && profileB && goalDistanceValid
      ? compareCourses(profileA, labelAInput.trim() || "Course A", profileB, labelBInput.trim() || "Course B", goalDistanceMilesRaw)
      : null;

  return (
    <div className="mt-10 space-y-10">
      <div>
        <p className={sectionLabelClass}>Goal distance</p>
        <div className={`${statCardClass} space-y-2`}>
          <LabeledInput
            id={`${baseId}-goal-distance`}
            label="Project the time difference over (mi)"
            type="number"
            inputMode="decimal"
            min={0.1}
            step={0.1}
            value={goalDistanceMilesInput}
            onChange={(event) => {
              setGoalDistanceMilesInput(event.target.value);
              persistState({ goalDistanceMilesInput: event.target.value });
            }}
            className="w-28"
          />
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            Defaults to a marathon (26.2mi) -- change this if you&rsquo;re comparing two courses for a different
            race distance. This only scales the total-time estimate below; each course&rsquo;s own profile uses its
            real length.
          </p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <CourseSidePanel
          idPrefix={`${baseId}-a`}
          label={labelAInput}
          onLabelChange={(next) => {
            setLabelAInput(next);
            persistState({ labelAInput: next });
          }}
          mode={modeA}
          onModeChange={(next) => {
            setModeA(next);
            persistState({ modeA: next });
          }}
          manual={manualA}
          onManualChange={(patch) => {
            const next = { ...manualA, ...patch };
            setManualA(next);
            persistState({ manualA: next });
          }}
          gps={gpsA}
          onRouteLoaded={handleRouteLoadedFor("A")}
        />
        <CourseSidePanel
          idPrefix={`${baseId}-b`}
          label={labelBInput}
          onLabelChange={(next) => {
            setLabelBInput(next);
            persistState({ labelBInput: next });
          }}
          mode={modeB}
          onModeChange={(next) => {
            setModeB(next);
            persistState({ modeB: next });
          }}
          manual={manualB}
          onManualChange={(patch) => {
            const next = { ...manualB, ...patch };
            setManualB(next);
            persistState({ manualB: next });
          }}
          gps={gpsB}
          onRouteLoaded={handleRouteLoadedFor("B")}
        />
      </div>

      {!profileA && !profileB && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Enter or import both courses above to compare them.</p>
      )}

      {(profileA || profileB) && (
        <div>
          <p className={sectionLabelClass}>Elevation profiles</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {profileA ? (
              <CourseStatsPanel label={labelAInput || "Course A"} profile={profileA} colorClassName="text-sky-700 dark:text-sky-400" />
            ) : (
              <EmptyCoursePrompt label={labelBInput || "Course B"} />
            )}
            {profileB ? (
              <CourseStatsPanel label={labelBInput || "Course B"} profile={profileB} colorClassName="text-amber-700 dark:text-amber-500" />
            ) : (
              <EmptyCoursePrompt label={labelAInput || "Course A"} />
            )}
          </div>
        </div>
      )}

      {comparison && (
        <div>
          <p className={sectionLabelClass}>Verdict</p>
          <div className={heroCardClass}>
            <p className={statLabelClass}>Grade-adjusted difficulty delta</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
              {Math.round(Math.abs(comparison.deltaSecPerMile))} sec/mi
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{comparison.verdict}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className={statCardClass}>
                <p className={statLabelClass}>Over {goalDistanceMilesRaw.toFixed(1)}mi</p>
                <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">
                  {comparison.totalTimeDeltaSeconds === 0 ? "No difference" : `${formatClock(Math.round(Math.abs(comparison.totalTimeDeltaSeconds)))} difference`}
                </p>
              </div>
              <div className={statCardClass}>
                <p className={statLabelClass}>Harder course</p>
                <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">
                  {comparison.deltaSecPerMile === 0 ? "Roughly even" : comparison.deltaSecPerMile > 0 ? labelAInput || "Course A" : labelBInput || "Course B"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <details className={detailsClass}>
          <summary className={summaryClass}>
            <span aria-hidden="true" className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400">
              ▶
            </span>
            Honest caveats
          </summary>
          <div className={detailsBodyClass}>
            <p>
              This tool only compares terrain -- the same grade heuristic (and 15ft/mi noise floor) the{" "}
              <Link
                href="/race-pace-planner"
                className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
              >
                Race Pace Planner
              </Link>{" "}
              uses to build a full pacing plan. It deliberately doesn&rsquo;t factor in weather, wind, or altitude --
              for that, see the{" "}
              <Link
                href="/environmental-calculator"
                className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
              >
                Environmental Performance Calculator
              </Link>
              . In manual entry mode, this can&rsquo;t discover a hill you didn&rsquo;t name -- switch to GPS route
              mode for that level of precision from an actual course file. Once you&rsquo;ve settled on a course,
              the Race Pace Planner can build out the full mile-by-mile plan.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}

function EmptyCoursePrompt({ label }: { label: string }) {
  return (
    <div className={`${statCardClass} flex items-center justify-center text-center text-sm text-zinc-600 dark:text-zinc-300`}>
      Add a course above to compare it against {label}.
    </div>
  );
}

function CourseStatsPanel({ label, profile, colorClassName }: { label: string; profile: CourseProfile; colorClassName: string }) {
  return (
    <div className={statCardClass}>
      <p className={`${statLabelClass} ${colorClassName}`}>{label}</p>
      <div className="mt-2">
        <CourseElevationChart label={label} miles={profile.miles} colorClassName={colorClassName} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-zinc-600 dark:text-zinc-300">
        <div>
          <dt className="font-semibold text-zinc-900 dark:text-white">Distance</dt>
          <dd>{profile.lengthMiles} mi</dd>
        </div>
        <div>
          <dt className="font-semibold text-zinc-900 dark:text-white">Gain / loss</dt>
          <dd>
            {Math.round(profile.totalGainFt)}ft / {Math.round(profile.totalLossFt)}ft
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-zinc-900 dark:text-white">Net grade</dt>
          <dd>{formatNetGrade(profile.netGradeFt)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-zinc-900 dark:text-white">Hilliest mile</dt>
          <dd>{profile.hilliestMile ? `Mile ${profile.hilliestMile.mile} (${formatNetGrade(profile.hilliestMile.netGradeFt)})` : "Flat"}</dd>
        </div>
      </dl>
    </div>
  );
}

function CourseSidePanel({
  idPrefix,
  label,
  onLabelChange,
  mode,
  onModeChange,
  manual,
  onManualChange,
  gps,
  onRouteLoaded,
}: {
  idPrefix: string;
  label: string;
  onLabelChange: (next: string) => void;
  mode: CourseMode;
  onModeChange: (next: CourseMode) => void;
  manual: ManualCourseState;
  onManualChange: (patch: Partial<ManualCourseState>) => void;
  gps: GpsSideState;
  onRouteLoaded: (summary: RouteSummary, label: string, route: ParsedRoute) => void;
}) {
  function updateClimb(index: number, patch: Partial<RaceClimb>) {
    onManualChange({ climbs: manual.climbs.map((climb, i) => (i === index ? { ...climb, ...patch } : climb)) });
  }
  function addClimb() {
    onManualChange({ climbs: [...manual.climbs, { ...DEFAULT_CLIMB }] });
  }
  function removeClimb(index: number) {
    onManualChange({ climbs: manual.climbs.filter((_, i) => i !== index) });
  }

  return (
    <div>
      <LabeledInput
        id={`${idPrefix}-label`}
        label="Course name"
        type="text"
        value={label}
        onChange={(event) => onLabelChange(event.target.value)}
        autoComplete="off"
        className="mb-2 w-full"
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => onModeChange("gps")} aria-pressed={mode === "gps"} className={segmentedButtonClass(mode === "gps")}>
          GPS route
        </button>
        <button type="button" onClick={() => onModeChange("manual")} aria-pressed={mode === "manual"} className={segmentedButtonClass(mode === "manual")}>
          Manual entry
        </button>
      </div>

      {gps.notice && <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">{gps.notice}</p>}

      {mode === "gps" ? (
        <div className={`${statCardClass} mt-3 space-y-3`}>
          <RouteImportPanel onRouteLoaded={onRouteLoaded} />
          {!gps.analysis && <p className="text-xs text-zinc-600 dark:text-zinc-300">No route loaded yet for {label || "this course"}.</p>}
        </div>
      ) : (
        <div className={`${statCardClass} mt-3 space-y-4`}>
          <div className="flex flex-wrap gap-4">
            <LabeledInput
              id={`${idPrefix}-distance`}
              label="Course distance (mi)"
              type="number"
              inputMode="decimal"
              min={0.1}
              step={0.1}
              value={manual.courseDistanceMilesInput}
              onChange={(event) => onManualChange({ courseDistanceMilesInput: event.target.value })}
              className="w-28"
            />
            <LabeledInput
              id={`${idPrefix}-gain`}
              label="Total gain (ft)"
              type="number"
              inputMode="decimal"
              min={0}
              value={manual.totalGainFtInput}
              onChange={(event) => onManualChange({ totalGainFtInput: event.target.value })}
              className="w-28"
            />
            <LabeledInput
              id={`${idPrefix}-loss`}
              label="Total loss (ft)"
              type="number"
              inputMode="decimal"
              min={0}
              value={manual.totalLossFtInput}
              onChange={(event) => onManualChange({ totalLossFtInput: event.target.value })}
              className="w-28"
            />
          </div>

          <div>
            <p className={labelClass}>Notable climbs &amp; descents</p>
            <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-300">
              Only the hills big enough to actually matter -- a net change of 15ft/mi or less is treated as noise.
              Flat assumed everywhere else.
            </p>
            <div className="space-y-3">
              {manual.climbs.map((climb, index) => (
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
                    <label htmlFor={`${idPrefix}-climb-${index}-mile`} className={labelClass}>
                      At mile
                    </label>
                    <input
                      id={`${idPrefix}-climb-${index}-mile`}
                      type="number"
                      inputMode="decimal"
                      min={1}
                      value={climb.atMile}
                      onChange={(event) => updateClimb(index, { atMile: Number(event.target.value) })}
                      className={`w-20 ${fieldClass}`}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${idPrefix}-climb-${index}-length`} className={labelClass}>
                      Length (mi)
                    </label>
                    <input
                      id={`${idPrefix}-climb-${index}-length`}
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
                    <label htmlFor={`${idPrefix}-climb-${index}-feet`} className={labelClass}>
                      Elevation change (ft)
                    </label>
                    <input
                      id={`${idPrefix}-climb-${index}-feet`}
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
      )}
    </div>
  );
}
