import { MILE_METERS } from "@/lib/race-distances";

// A coach expresses a day's volume as a percent of that week's own
// training_week_plans target ("20% of the week") instead of typing a fixed
// number -- resolved live, at read time, every time it's displayed, the
// exact same live-reference philosophy as pace-reference.ts. Never baked
// into a stored number: the percent itself is the persisted value (see the
// volume_percent migration's own comment).

export type WeekTarget = {
  targetVolumeMin: number | null;
  targetVolumeMax: number | null;
  targetVolumeUnit: "miles" | "minutes" | null;
};

export type ResolvedVolume = {
  unit: "miles" | "minutes";
  minValue: number;
  maxValue: number | null;
  /** e.g. "20% of 35-40mi target" -- the "shown transparently" requirement. */
  sourceLabel: string;
};

function formatTargetLabel(min: number, max: number | null, unit: "miles" | "minutes"): string {
  const abbrev = unit === "minutes" ? "min" : "mi";
  const range = max != null && max !== min ? `${min}-${max}` : `${min}`;
  return `${range}${abbrev}`;
}

// Null week or no target set for that week -> null always (the caller
// renders "no target set for this week yet" -- never a fabricated figure).
// unit defaults to "miles" when target_volume_unit is unset, mirroring
// formatTargetVolume's own existing default (week-plan-editor.tsx).
export function resolveVolumePercent(percent: number, week: WeekTarget | null): ResolvedVolume | null {
  if (!week || week.targetVolumeMin == null) return null;
  const unit = week.targetVolumeUnit ?? "miles";
  const minValue = Math.round((percent / 100) * week.targetVolumeMin);
  const maxValue = week.targetVolumeMax != null ? Math.round((percent / 100) * week.targetVolumeMax) : null;
  const sourceLabel = `${percent}% of ${formatTargetLabel(week.targetVolumeMin, week.targetVolumeMax, unit)} target`;
  return { unit, minValue, maxValue, sourceLabel };
}

// The one place this wording lives -- mirrors formatResolvedPaceText's own
// three-state contract (pace-reference.ts):
//   - resolved omitted (undefined): athlete/week-agnostic context (a
//     template's own list view) -- renders the bare percent, never a number.
//   - explicit null: resolution was attempted for a real week and came back
//     empty (no target set for that week yet) -- shows that state honestly.
//   - a ResolvedVolume: shows the resolved figure + percent.
export function formatResolvedVolumeText(resolved: ResolvedVolume | null | undefined, percent: number): string {
  if (resolved === undefined) return `${percent}% of week`;
  if (resolved === null) return `${percent}% of week — no target set yet`;
  const abbrev = resolved.unit === "minutes" ? "min" : "mi";
  const range =
    resolved.maxValue != null && resolved.maxValue !== resolved.minValue
      ? `${resolved.minValue}-${resolved.maxValue}${abbrev}`
      : `${resolved.minValue}${abbrev}`;
  return `${range} (${percent}% of week)`;
}

export type ResolvedVolumeFields = {
  resolvedDistanceM: number | null;
  resolvedDistanceMaxM: number | null;
  resolvedDurationS: number | null;
  resolvedDurationMaxS: number | null;
  volumeSourceLabel: string | null;
};

// Converts a ResolvedVolume (in whichever unit that week's own target
// actually uses, miles or minutes) into the meters/seconds shape every
// other distance/duration figure on the calendar is already stored and
// compared in -- only one of the distance/duration pairs is ever
// populated, matching a real week's own single target_volume_unit. Shared
// by calendar-data.ts (Week/Day/Month View) and the workout detail page so
// the conversion can't drift between the two call sites.
export function resolvedVolumeToFields(resolved: ResolvedVolume | null): ResolvedVolumeFields {
  if (!resolved) {
    return { resolvedDistanceM: null, resolvedDistanceMaxM: null, resolvedDurationS: null, resolvedDurationMaxS: null, volumeSourceLabel: null };
  }
  if (resolved.unit === "minutes") {
    return {
      resolvedDistanceM: null,
      resolvedDistanceMaxM: null,
      resolvedDurationS: resolved.minValue * 60,
      resolvedDurationMaxS: resolved.maxValue != null ? resolved.maxValue * 60 : null,
      volumeSourceLabel: resolved.sourceLabel,
    };
  }
  return {
    resolvedDistanceM: Math.round(resolved.minValue * MILE_METERS),
    resolvedDistanceMaxM: resolved.maxValue != null ? Math.round(resolved.maxValue * MILE_METERS) : null,
    resolvedDurationS: null,
    resolvedDurationMaxS: null,
    volumeSourceLabel: resolved.sourceLabel,
  };
}
