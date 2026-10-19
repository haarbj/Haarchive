"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { LabeledInput } from "@/components/ui/labeled-input";
import type { CvPiecesModel } from "@/lib/cv-threshold-math";
import { fieldClass, labelClass } from "@/lib/form-styles";
import {
  AGREEMENT_THRESHOLD_SEC_PER_MILE,
  buildPaceModelComparison,
  MODEL_HREFS,
  MODEL_IDS,
  MODEL_LABELS,
  type ComparisonCell,
} from "@/lib/pace-model-comparison-math";
import { RACE_DISTANCES } from "@/lib/race-distances";
import { formatClock, parseTimeToSeconds } from "@/lib/running-format";
import { usePersistedField, usePersistedJSON } from "@/lib/use-persisted-field";
import { sectionLabelClass, statCardClass } from "@/lib/tool-styles";

// Fetched once and cached at module scope, same pattern as
// cv-threshold-calculator.tsx and marathon-pacing-calculator.tsx's own
// copies of this exact loader -- each consumer of the statistical model
// keeps its own small cache rather than sharing one, which is this
// codebase's existing convention for this file, not something introduced
// here.
const MODEL_URL = "/data/cv-threshold-pieces-v2026-09-05.json";
let modelPromise: Promise<CvPiecesModel> | null = null;
function loadModel(): Promise<CvPiecesModel> {
  if (!modelPromise) {
    modelPromise = fetch(MODEL_URL).then((res) => {
      if (!res.ok) throw new Error(`Failed to load model data (${res.status})`);
      return res.json() as Promise<CvPiecesModel>;
    });
  }
  return modelPromise;
}

const STORAGE_KEY = "haarchive-pace-model-comparison-state";
const DEFAULT_DISTANCE_KEY = "5k";
const DEFAULT_TIME = "18:00";

type PersistedState = { distanceKey: string; timeInput: string };

function formatPace(secondsPerMile: number): string {
  return `${formatClock(secondsPerMile)}/mi`;
}

function formatCell(cell: ComparisonCell): string {
  if (!cell) return "—";
  if (Math.abs(cell.fastSecPerMile - cell.slowSecPerMile) < 0.5) return formatPace(cell.fastSecPerMile);
  return `${formatClock(cell.fastSecPerMile)}–${formatPace(cell.slowSecPerMile)}`;
}

/**
 * The interactive comparison at the top of choosing-a-pace-calculator: one
 * race result in, all three pace-prediction models' training zones out,
 * side by side. Every number is computed by calling that model's own real
 * math module (pace-calculator-math.ts, tinman-calculator-math.ts,
 * cv-threshold-math.ts) -- see pace-model-comparison-math.ts for the zone
 * alignment and agreement read, and that module's own tests for the
 * zero-drift guarantee against each standalone calculator.
 */
export function PaceModelComparison() {
  const baseId = useId();
  const persisted = usePersistedJSON<PersistedState>(STORAGE_KEY);

  const [distanceKey, setDistanceKey] = usePersistedField(persisted?.distanceKey, DEFAULT_DISTANCE_KEY);
  const [timeInput, setTimeInput] = usePersistedField(persisted?.timeInput, DEFAULT_TIME);

  const [cvModel, setCvModel] = useState<CvPiecesModel | null>(null);
  const [cvModelError, setCvModelError] = useState(false);

  useEffect(() => {
    loadModel()
      .then(setCvModel)
      .catch(() => setCvModelError(true));
  }, []);

  function persistState(patch: Partial<PersistedState> = {}) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ distanceKey, timeInput, ...patch }));
    } catch {
      // Ignore unavailable storage (e.g. private browsing).
    }
  }

  const distanceOption = RACE_DISTANCES.find((d) => d.key === distanceKey);
  const raceSeconds = parseTimeToSeconds(timeInput);
  const canCompute = !!distanceOption && raceSeconds !== null && raceSeconds > 0;

  const rows = canCompute ? buildPaceModelComparison(distanceOption.meters, raceSeconds, cvModel) : [];

  return (
    <div className="mt-10 space-y-6">
      <div>
        <p className={sectionLabelClass}>Compare the three models</p>
        <div className={`${statCardClass} space-y-4`}>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
            Enter one race result and see what each of this site&rsquo;s three pace-prediction models says your
            training paces should be, side by side. The point isn&rsquo;t to pick a winner -- it&rsquo;s to make the
            disagreement itself visible, so the explanation below means something concrete.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor={`${baseId}-distance`} className={labelClass}>
                Race distance
              </label>
              <select
                id={`${baseId}-distance`}
                value={distanceKey}
                onChange={(event) => {
                  setDistanceKey(event.target.value);
                  persistState({ distanceKey: event.target.value });
                }}
                className={fieldClass}
              >
                {RACE_DISTANCES.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <LabeledInput
              id={`${baseId}-time`}
              label="Finish time"
              type="text"
              value={timeInput}
              onChange={(event) => {
                setTimeInput(event.target.value);
                persistState({ timeInput: event.target.value });
              }}
              placeholder="h:mm:ss"
              autoComplete="off"
              className="w-32"
            />
          </div>
          {!canCompute && (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Enter a distance and finish time to compare.</p>
          )}
          {cvModelError && (
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              The statistical model&rsquo;s data couldn&rsquo;t load, so that column will show &ldquo;—&rdquo; below.
            </p>
          )}
        </div>
      </div>

      {canCompute && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left dark:border-white/10">
                <th className="py-2 pr-4 font-semibold text-zinc-900 dark:text-white">Zone</th>
                {MODEL_IDS.map((id) => (
                  <th key={id} className="px-3 py-2 text-left font-semibold text-zinc-900 dark:text-white">
                    <Link
                      href={MODEL_HREFS[id]}
                      className="underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white"
                    >
                      {MODEL_LABELS[id]}
                    </Link>
                  </th>
                ))}
                <th className="py-2 pl-3 text-left font-semibold text-zinc-900 dark:text-white">Agreement</th>
              </tr>
            </thead>
            <tbody className="text-zinc-700 dark:text-zinc-200">
              {rows.map((row) => (
                <tr key={row.zone} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2.5 pr-4 font-medium text-zinc-900 dark:text-white">{row.zone}</td>
                  {MODEL_IDS.map((id) => (
                    <td key={id} className="px-3 py-2.5 tabular-nums">
                      {formatCell(row.cells[id])}
                    </td>
                  ))}
                  <td className="py-2.5 pl-3">
                    {row.agreement === "agree" && <Badge tone="success">Agreement</Badge>}
                    {row.agreement === "diverge" && (
                      <Badge tone="research">
                        {row.spreadSecPerMile !== null ? `Diverges, ~${Math.round(row.spreadSecPerMile)}s/mi apart` : "Diverges"}
                      </Badge>
                    )}
                    {row.agreement === "insufficient" && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Only one model</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
            &ldquo;Agreement&rdquo; compares each model&rsquo;s midpoint pace and marks rows within{" "}
            {AGREEMENT_THRESHOLD_SEC_PER_MILE} sec/mi of each other -- full ranges are still shown above exactly as
            each calculator reports them, never collapsed to that midpoint. A dash means that model doesn&rsquo;t
            produce a pace for that zone at all, not that it disagrees with the others.
          </p>
        </div>
      )}
    </div>
  );
}
