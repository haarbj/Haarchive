"use client";

import { useEffect } from "react";
import Link from "next/link";

import { ContentCallout } from "@/components/content-callout";
import { Button } from "@/components/ui/button";
import { fieldClass, labelClass } from "@/lib/form-styles";
import {
  formatPaceOutput,
  parsePaceInput,
  PACE_UNIT_LABEL,
  PACE_UNIT_METERS,
  type PaceUnit,
} from "@/lib/pace-percent-math";
import {
  altitudeAdjustPaceSeconds,
  computeZoneBounds,
  isValidPercentRow,
  type PaceZoneRow,
} from "@/lib/private-coaching/pace-zone-table-math";
import { metersFor } from "@/lib/race-distances";
import { usePersistedField, usePersistedJSON } from "@/lib/use-persisted-field";
import {
  detailsBodyClass,
  detailsClass,
  sectionLabelClass,
  segmentedButtonClass,
  statCardClass,
  summaryClass,
} from "@/lib/tool-styles";

export type ReferenceBasis = "5k" | "marathon";

const BASIS_LABEL: Record<ReferenceBasis, string> = { "5k": "5K Pace", marathon: "Marathon Pace" };
const PACE_UNITS: PaceUnit[] = ["mi", "km"];
const HIGH_ALTITUDE_FT = 8000;
const STORAGE_KEY = "haarchive-athlete-pace-zone-table-state";

// fieldClass's own px-4 is sized for a normal-width text field -- on a
// number input this narrow (2-3 digits, "open" placeholder), that padding
// plus the browser's native spin-button gutter left almost no room for the
// digits themselves, clipping them (e.g. "50" rendering as "5("). Written
// out separately rather than layering overrides onto fieldClass, since a
// later utility class in the same string isn't guaranteed to win over an
// earlier one from a shared constant -- Tailwind's cascade order is by
// stylesheet position, not class-list order.
const percentInputClass =
  "w-20 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-center text-base text-zinc-900 transition focus:ring-2 focus:ring-zinc-900 focus:outline-none [color-scheme:light_dark] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:focus:ring-white";

// The standing zone table every athlete sees automatically -- a full
// very-easy-through-mile-race spectrum, not just the four-zone starting
// example from this feature's original spec. Still fully editable/
// addable/removable per athlete, not a fixed set.
//
// Tracked per basis (see DEFAULT_ROWS_BY_BASIS/rows below), not as one
// shared table: a "70% of marathon pace" zone and a "70% of 5K pace" zone
// are genuinely different workouts, not the same percentage read against
// a different number. This file previously had exactly one DEFAULT_ROWS
// array, reused unchanged for both bases -- switching the Basis toggle
// changed which reference pace the SAME 5K-tuned percentages were read
// against, but never swapped in marathon-appropriate percentages, so a
// marathon-basis table looked identical in shape to the 5K one and was
// quietly wrong (a real reported bug, not a cosmetic gap).
const DEFAULT_ROWS_5K: PaceZoneRow[] = [
  { label: "Very easy", minPercent: null, maxPercent: 50 },
  { label: "Easy", minPercent: 50, maxPercent: 60 },
  { label: "Moderate", minPercent: 60, maxPercent: 75 },
  { label: "Steady", minPercent: 75, maxPercent: 80 },
  { label: "Strong/MP", minPercent: 80, maxPercent: 85 },
  { label: "HM Effort", minPercent: 88, maxPercent: 90 },
  { label: "LT2 (Thresh)", minPercent: 90, maxPercent: 92 },
  { label: "8K-10K", minPercent: 95, maxPercent: null },
  { label: "5K effort / fast", minPercent: 100, maxPercent: null },
  { label: "3K/2M/Very fast", minPercent: 105, maxPercent: null },
  { label: "1500m / mile", minPercent: 110, maxPercent: null },
];

// Same 11 zone labels, marathon-pace-appropriate percentages -- these
// ranges run higher than the 5K table's (e.g. "Easy" is 70-80% MP here,
// not 50-60%) because marathon pace itself is a much easier effort than
// 5K pace, so the same named zone sits at a higher percentage of the
// (slower) reference.
const DEFAULT_ROWS_MARATHON: PaceZoneRow[] = [
  { label: "Very easy", minPercent: null, maxPercent: 70 },
  { label: "Easy", minPercent: 70, maxPercent: 80 },
  { label: "Moderate", minPercent: 82, maxPercent: 90 },
  { label: "Steady", minPercent: 90, maxPercent: 95 },
  { label: "Strong/MP", minPercent: 95, maxPercent: 100 },
  { label: "HM Effort", minPercent: 103, maxPercent: 105 },
  { label: "LT2 (Thresh)", minPercent: 105, maxPercent: 107 },
  { label: "8K-10K", minPercent: 110, maxPercent: null },
  { label: "5K effort / fast", minPercent: 115, maxPercent: null },
  { label: "3K/2M/Very fast", minPercent: 120, maxPercent: null },
  { label: "1500m / mile", minPercent: 125, maxPercent: null },
];

const DEFAULT_ROWS_BY_BASIS: Record<ReferenceBasis, PaceZoneRow[]> = {
  "5k": DEFAULT_ROWS_5K,
  marathon: DEFAULT_ROWS_MARATHON,
};

// Guards against a real migration hazard: a returning athlete's
// localStorage may still hold the OLD shape (rows as one flat
// PaceZoneRow[], from before each basis got its own table) -- `??` alone
// (usePersistedField's own fallback) can't tell "wrong shape" from
// "present and valid," so a raw array would flow straight through, and
// then rows["5k"]/rows.marathon would read a stale index/property off an
// array instead of a real per-basis row list. Falls back to fresh
// defaults whenever the stored value isn't recognizably the new shape,
// rather than attempting to guess a mapping from the old one.
function isRowsByBasis(value: unknown): value is Record<ReferenceBasis, PaceZoneRow[]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record["5k"]) && Array.isArray(record.marathon);
}

// Workout Paces starts empty -- one-off exact percentages for a specific
// session (e.g. "102/100/98% of 5K" for today's cutdown), kept separate
// from the standing Zones table above rather than mixed into it.
const DEFAULT_WORKOUT_ROWS: PaceZoneRow[] = [];

export type SuggestedReferencePace = {
  basis: ReferenceBasis;
  /** Formatted mm:ss, in miles. */
  paceText: string;
  /** e.g. "Peachtree 10K · Jul 4, 2026" */
  sourceLabel: string;
};

type PersistedState = {
  basis: ReferenceBasis;
  paceUnit: PaceUnit;
  referencePaceInput: string;
  altitudeEnabled: boolean;
  altitudeInput: string;
  rows: Record<ReferenceBasis, PaceZoneRow[]>;
  workoutRows: PaceZoneRow[];
  showMethodology: boolean;
};

// Athlete-only, single-coach-scoped self-service tool (see
// coaching/pace-zones/page.tsx for the isCoachedAthlete gate): turns one
// reference pace (5K or marathon) into a table of named percent-of-pace
// effort zones, and -- if the athlete enters their home altitude -- a
// second table of the same zones re-expressed as real paces to run there.
// Both tables are pure arithmetic over this codebase's existing John Davis
// (Running Writings) ports; see pace-zone-table-math.ts's own header for
// exactly which functions are reused and why.
export function AthletePaceZoneTable({ suggestions }: { suggestions: SuggestedReferencePace[] }) {
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [basis, setBasis] = usePersistedField<ReferenceBasis>(persisted?.basis, "5k");
  const [paceUnit, setPaceUnit] = usePersistedField<PaceUnit>(persisted?.paceUnit, "mi");
  const [referencePaceInput, setReferencePaceInput] = usePersistedField(persisted?.referencePaceInput, "");
  const [altitudeEnabled, setAltitudeEnabled] = usePersistedField(persisted?.altitudeEnabled, false);
  const [altitudeInput, setAltitudeInput] = usePersistedField(persisted?.altitudeInput, "");
  const [rowsByBasis, setRowsByBasis] = usePersistedField<Record<ReferenceBasis, PaceZoneRow[]>>(
    isRowsByBasis(persisted?.rows) ? persisted.rows : undefined,
    DEFAULT_ROWS_BY_BASIS,
  );
  const rows = rowsByBasis[basis];
  function setRows(update: PaceZoneRow[] | ((prev: PaceZoneRow[]) => PaceZoneRow[])) {
    setRowsByBasis((prev) => ({
      ...prev,
      [basis]: typeof update === "function" ? update(prev[basis]) : update,
    }));
  }
  const [workoutRows, setWorkoutRows] = usePersistedField<PaceZoneRow[]>(persisted?.workoutRows, DEFAULT_WORKOUT_ROWS);
  const [showMethodology, setShowMethodology] = usePersistedField(persisted?.showMethodology, false);

  useEffect(() => {
    try {
      const state: PersistedState = {
        basis,
        paceUnit,
        referencePaceInput,
        altitudeEnabled,
        altitudeInput,
        rows: rowsByBasis,
        workoutRows,
        showMethodology,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }, [basis, paceUnit, referencePaceInput, altitudeEnabled, altitudeInput, rowsByBasis, workoutRows, showMethodology]);

  function updateRow(index: number, patch: Partial<PaceZoneRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }
  function addRow() {
    setRows((prev) => [...prev, { label: "New zone", minPercent: null, maxPercent: null }]);
  }
  // Workout Paces rows are always exact (maxPercent stays null) -- a
  // one-off percentage for a specific session, not a standing zone, so
  // there's no range to enter here, just a label and one percent.
  function updateWorkoutRowLabel(index: number, label: string) {
    setWorkoutRows((prev) => prev.map((row, i) => (i === index ? { ...row, label } : row)));
  }
  function updateWorkoutRowPercent(index: number, percent: number | null) {
    setWorkoutRows((prev) => prev.map((row, i) => (i === index ? { ...row, minPercent: percent, maxPercent: null } : row)));
  }
  function removeWorkoutRow(index: number) {
    setWorkoutRows((prev) => prev.filter((_, i) => i !== index));
  }
  function addWorkoutRow() {
    setWorkoutRows((prev) => [...prev, { label: `Workout pace ${prev.length + 1}`, minPercent: 100, maxPercent: null }]);
  }
  function applySuggestion(suggestion: SuggestedReferencePace) {
    setBasis(suggestion.basis);
    setPaceUnit("mi");
    setReferencePaceInput(suggestion.paceText);
  }

  const referenceSeconds = parsePaceInput(referencePaceInput, paceUnit);
  const altitudeFeet = Number(altitudeInput);
  const altitudeValid = altitudeEnabled && altitudeInput.trim() !== "" && Number.isFinite(altitudeFeet) && altitudeFeet >= 0;
  const showHighAltitudeWarning = altitudeValid && altitudeFeet > HIGH_ALTITUDE_FT;

  const basisMeters = metersFor(basis);
  const paceUnitMeters = PACE_UNIT_METERS[paceUnit];

  const matchingSuggestion = suggestions.find((s) => s.basis === basis);

  // Shared by both the Zones and Workout Paces tables -- same reference
  // pace, same altitude settings, same bounds/formatting logic, just
  // rendered into two visually separate tables below.
  function describeRow(row: PaceZoneRow) {
    const valid = isValidPercentRow(row);
    const bounds = referenceSeconds !== null && valid ? computeZoneBounds(referenceSeconds, row) : null;

    const paceText = bounds
      ? bounds.isExact
        ? formatPaceOutput(bounds.fastSeconds!, paceUnit)
        : bounds.fastSeconds !== null && bounds.slowSeconds !== null
          ? `${formatPaceOutput(bounds.fastSeconds, paceUnit)}–${formatPaceOutput(bounds.slowSeconds, paceUnit)}`
          : bounds.fastSeconds !== null
            ? `${formatPaceOutput(bounds.fastSeconds, paceUnit)} or slower`
            : null
      : null;

    const altitudeText =
      bounds && altitudeValid
        ? (() => {
            if (bounds.isExact) {
              const exactAlt = altitudeAdjustPaceSeconds(bounds.fastSeconds!, paceUnitMeters, basisMeters, altitudeFeet);
              return formatPaceOutput(exactAlt, paceUnit);
            }
            const fastAlt =
              bounds.fastSeconds !== null
                ? altitudeAdjustPaceSeconds(bounds.fastSeconds, paceUnitMeters, basisMeters, altitudeFeet)
                : null;
            const slowAlt =
              bounds.slowSeconds !== null
                ? altitudeAdjustPaceSeconds(bounds.slowSeconds, paceUnitMeters, basisMeters, altitudeFeet)
                : null;
            if (fastAlt !== null && slowAlt !== null) {
              return `${formatPaceOutput(fastAlt, paceUnit)}–${formatPaceOutput(slowAlt, paceUnit)}`;
            }
            if (fastAlt !== null) return `${formatPaceOutput(fastAlt, paceUnit)} or slower`;
            return null;
          })()
        : null;

    return { valid, paceText, altitudeText };
  }

  return (
    <div className="mt-10 space-y-10">
      <div>
        <p className={sectionLabelClass}>Reference pace</p>
        <div className={`${statCardClass} flex flex-wrap gap-6`}>
          <div className="min-w-[220px]">
            <p className={labelClass}>Basis</p>
            <div className="flex gap-2">
              {(["5k", "marathon"] as ReferenceBasis[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBasis(key)}
                  aria-pressed={basis === key}
                  className={segmentedButtonClass(basis === key)}
                >
                  {BASIS_LABEL[key]}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0">
            <label className={labelClass} htmlFor="reference-pace-input">
              Your current estimated {BASIS_LABEL[basis].toLowerCase()}
            </label>
            <div className="flex gap-2">
              <input
                id="reference-pace-input"
                type="text"
                value={referencePaceInput}
                onChange={(event) => setReferencePaceInput(event.target.value)}
                placeholder="mm:ss"
                autoComplete="off"
                className={`w-28 ${fieldClass}`}
              />
              <select
                aria-label="Pace unit"
                value={paceUnit}
                onChange={(event) => setPaceUnit(event.target.value as PaceUnit)}
                className={fieldClass}
              >
                {PACE_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {PACE_UNIT_LABEL[unit]}
                  </option>
                ))}
              </select>
            </div>
            {referencePaceInput.trim() !== "" && referenceSeconds === null && (
              <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">Enter as mm:ss, e.g. 5:24.</p>
            )}
            {matchingSuggestion && (
              <button
                type="button"
                onClick={() => applySuggestion(matchingSuggestion)}
                className="mt-1.5 text-xs font-semibold text-zinc-700 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-zinc-200 dark:decoration-white/30 dark:hover:decoration-white"
              >
                Use your predicted {BASIS_LABEL[basis].toLowerCase()} from {matchingSuggestion.sourceLabel} (
                {matchingSuggestion.paceText}/mi)
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        <p className={sectionLabelClass}>Home altitude (optional)</p>
        <div className={`${statCardClass} flex flex-wrap items-end gap-6`}>
          <div className="min-w-[220px]">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAltitudeEnabled(false)}
                aria-pressed={!altitudeEnabled}
                className={segmentedButtonClass(!altitudeEnabled)}
              >
                Sea level / not set
              </button>
              <button
                type="button"
                onClick={() => setAltitudeEnabled(true)}
                aria-pressed={altitudeEnabled}
                className={segmentedButtonClass(altitudeEnabled)}
              >
                I train at altitude
              </button>
            </div>
          </div>
          {altitudeEnabled && (
            <div>
              <label className={labelClass} htmlFor="altitude-input">
                Altitude where you live/train (ft)
              </label>
              <input
                id="altitude-input"
                type="number"
                inputMode="numeric"
                min={0}
                value={altitudeInput}
                onChange={(event) => setAltitudeInput(event.target.value)}
                placeholder="e.g. 7000"
                className={`w-32 ${fieldClass} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
              />
            </div>
          )}
        </div>
        {altitudeEnabled && (
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
            The zone paces below assume your entered {BASIS_LABEL[basis].toLowerCase()} reflects sea-level fitness.
            The altitude table shows the real pace to run at your altitude for the same effort, not a race-day
            conversion for a specific race.
          </p>
        )}
        {showHighAltitudeWarning && (
          <div className="mt-3">
            <ContentCallout
              variant="mistake"
              title="High altitude"
              text="Altitudes above 8,000ft are rare in the data this model was fit on. Results at this altitude may be less accurate."
            />
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className={`${sectionLabelClass} mb-0`}>Zones</p>
          <Button type="button" onClick={addRow} variant="outline" size="sm">
            Add zone
          </Button>
        </div>
        <p className="mb-3 text-xs text-zinc-600 dark:text-zinc-300">
          Fill in just Low % for an exact pace (e.g. 95% for Marathon Pace) instead of a range.
        </p>

        {rows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No zones yet -- add one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10">
                  <th className="py-2 pr-3 text-left font-semibold text-zinc-900 dark:text-white">Zone</th>
                  <th className="px-3 py-2 text-center font-semibold text-zinc-900 dark:text-white">Low %</th>
                  <th className="px-3 py-2 text-center font-semibold text-zinc-900 dark:text-white">High %</th>
                  <th className="px-3 py-2 text-right font-semibold text-zinc-900 dark:text-white">
                    Pace ({PACE_UNIT_LABEL[paceUnit]})
                  </th>
                  {altitudeValid && (
                    <th className="py-2 pl-3 text-right font-semibold text-zinc-900 dark:text-white">
                      At altitude ({PACE_UNIT_LABEL[paceUnit]})
                    </th>
                  )}
                  <th className="py-2 pl-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const { valid, paceText, altitudeText } = describeRow(row);

                  return (
                    <tr key={index} className="border-b border-black/5 last:border-0 dark:border-white/5">
                      <td className="py-1.5 pr-3">
                        <input
                          type="text"
                          value={row.label}
                          onChange={(event) => updateRow(index, { label: event.target.value })}
                          className={`w-44 ${fieldClass} py-1.5`}
                          aria-label="Zone label"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={1}
                          max={300}
                          value={row.minPercent ?? ""}
                          onChange={(event) =>
                            updateRow(index, { minPercent: event.target.value === "" ? null : Number(event.target.value) })
                          }
                          placeholder="open"
                          className={percentInputClass}
                          aria-label="Low percent"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={1}
                          max={300}
                          value={row.maxPercent ?? ""}
                          onChange={(event) =>
                            updateRow(index, { maxPercent: event.target.value === "" ? null : Number(event.target.value) })
                          }
                          placeholder="exact"
                          className={percentInputClass}
                          aria-label="High percent (leave blank for an exact pace at the low %)"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-zinc-900 dark:text-white">
                        {referenceSeconds === null ? (
                          <span className="text-zinc-400 dark:text-zinc-600">--</span>
                        ) : !valid ? (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {row.minPercent === null && row.maxPercent === null ? "Set a % bound" : "Low % can't exceed high %"}
                          </span>
                        ) : (
                          paceText
                        )}
                      </td>
                      {altitudeValid && (
                        <td className="py-1.5 pl-3 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                          {altitudeText ?? <span className="text-zinc-400 dark:text-zinc-600">--</span>}
                        </td>
                      )}
                      <td className="py-1.5 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="text-xs font-semibold text-zinc-500 hover:text-red-700 dark:text-zinc-400 dark:hover:text-red-400"
                          aria-label={`Remove ${row.label || "zone"}`}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {referenceSeconds === null && referencePaceInput.trim() !== "" && (
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
            Enter a valid reference pace above to see zone paces.
          </p>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className={`${sectionLabelClass} mb-0`}>Workout paces</p>
          <Button type="button" onClick={addWorkoutRow} variant="outline" size="sm">
            Add workout pace
          </Button>
        </div>
        <p className="mb-3 text-xs text-zinc-600 dark:text-zinc-300">
          One-off exact percentages for a specific session -- e.g. 102%, 100%, and 98% of {BASIS_LABEL[basis]} for
          today&rsquo;s cutdown -- kept separate from your standing zones above rather than mixed into them. Uses the
          same reference pace and altitude settings.
        </p>

        {workoutRows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No workout paces yet -- add one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10">
                  <th className="py-2 pr-3 text-left font-semibold text-zinc-900 dark:text-white">Label</th>
                  <th className="px-3 py-2 text-center font-semibold text-zinc-900 dark:text-white">%</th>
                  <th className="px-3 py-2 text-right font-semibold text-zinc-900 dark:text-white">
                    Pace ({PACE_UNIT_LABEL[paceUnit]})
                  </th>
                  {altitudeValid && (
                    <th className="py-2 pl-3 text-right font-semibold text-zinc-900 dark:text-white">
                      At altitude ({PACE_UNIT_LABEL[paceUnit]})
                    </th>
                  )}
                  <th className="py-2 pl-3" />
                </tr>
              </thead>
              <tbody>
                {workoutRows.map((row, index) => {
                  const { valid, paceText, altitudeText } = describeRow(row);

                  return (
                    <tr key={index} className="border-b border-black/5 last:border-0 dark:border-white/5">
                      <td className="py-1.5 pr-3">
                        <input
                          type="text"
                          value={row.label}
                          onChange={(event) => updateWorkoutRowLabel(index, event.target.value)}
                          className={`w-44 ${fieldClass} py-1.5`}
                          aria-label="Workout pace label"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={1}
                          max={300}
                          value={row.minPercent ?? ""}
                          onChange={(event) =>
                            updateWorkoutRowPercent(index, event.target.value === "" ? null : Number(event.target.value))
                          }
                          className={percentInputClass}
                          aria-label="Percent"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-zinc-900 dark:text-white">
                        {referenceSeconds === null ? (
                          <span className="text-zinc-400 dark:text-zinc-600">--</span>
                        ) : !valid ? (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">Set a %</span>
                        ) : (
                          paceText
                        )}
                      </td>
                      {altitudeValid && (
                        <td className="py-1.5 pl-3 text-right tabular-nums text-zinc-700 dark:text-zinc-200">
                          {altitudeText ?? <span className="text-zinc-400 dark:text-zinc-600">--</span>}
                        </td>
                      )}
                      <td className="py-1.5 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeWorkoutRow(index)}
                          className="text-xs font-semibold text-zinc-500 hover:text-red-700 dark:text-zinc-400 dark:hover:text-red-400"
                          aria-label={`Remove ${row.label || "workout pace"}`}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowMethodology((value) => !value)}
          aria-expanded={showMethodology}
          className="flex items-center gap-2 py-1 text-lg font-semibold text-zinc-900 dark:text-white"
        >
          Behind this tool: formulas and assumptions
          <span aria-hidden="true" className="text-sm font-normal">
            {showMethodology ? "↑" : "↓"}
          </span>
        </button>
        {showMethodology && (
          <div className="mt-4 max-w-[64ch] space-y-2">
            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                Percent-of-pace math
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Each zone&rsquo;s percent range is converted using the same percent-of-pace formula as the{" "}
                  <Link
                    href="/pace-percent-calculator"
                    className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
                  >
                    Pace Percent Calculator
                  </Link>{" "}
                  (Renato Canova&rsquo;s convention, adapted from John Davis&rsquo;s pace-percents calculator): a
                  higher percent is a faster pace, and each 10% step is a fixed number of seconds/mile regardless of
                  your reference pace. A zone&rsquo;s low % produces its slower pace edge and its high % produces
                  its faster edge. Filling in only low % (high % left blank) gives one exact pace at that percent,
                  e.g. 95% with high % blank for Marathon Pace -- the natural way to enter a single target instead
                  of a range. Filling in only high % (low % left blank, as in the &ldquo;Very easy&rdquo; example)
                  keeps the original open-ended meaning: that side of the range stays open.
                </p>
              </div>
            </details>

            <details className={detailsClass}>
              <summary className={summaryClass}>
                <span
                  aria-hidden="true"
                  className="inline-block text-[10px] text-zinc-500 transition-transform group-open:rotate-90 dark:text-zinc-400"
                >
                  ▶
                </span>
                Altitude table
              </summary>
              <div className={detailsBodyClass}>
                <p>
                  Uses the same model as the second, independently-derived model shown in the{" "}
                  <Link
                    href="/altitude-calculator"
                    className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
                  >
                    Altitude Calculator&rsquo;s
                  </Link>{" "}
                  Performance mode (also from John Davis / Running Writings), applied to each zone&rsquo;s pace
                  boundary the same way that calculator&rsquo;s own &ldquo;Pace&rdquo; entry mode treats a single
                  pace: as a full
                  performance over the reference distance (5K or marathon), converted from sea level to your home
                  altitude, then converted back to a pace. This answers &ldquo;what should I actually run at my
                  altitude for the same effort,&rdquo; not &ldquo;how would a sea-level race translate on race
                  day&rdquo; -- a different question this table isn&rsquo;t trying to answer.
                </p>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
