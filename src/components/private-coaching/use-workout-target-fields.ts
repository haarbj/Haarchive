"use client";

import { useState } from "react";

import { MILE_METERS } from "@/lib/race-distances";
import { parseTimeToSeconds } from "@/lib/running-format";
import {
  metersToMilesInput,
  secondsToMinutesInput,
  secondsToPaceInput,
  autoCompleteWorkoutTargets,
  validateDistanceRange,
  validateDurationRange,
  validatePaceRange,
  validateHrRange,
  validateRpeRange,
  type WorkoutTargetRanges,
} from "@/lib/private-coaching/workout-distance";
import type { PaceReferenceKey } from "@/lib/private-coaching/pace-reference";

export type WorkoutTargetFieldsInitial = {
  plannedDistanceM: number | null;
  plannedDistanceMaxM: number | null;
  plannedDurationS: number | null;
  plannedDurationMaxS: number | null;
  plannedPaceSPerMi: number | null;
  plannedPaceMaxSPerMi: number | null;
  // Mutually exclusive with plannedPaceSPerMi/MaxSPerMi -- exactly one of
  // "a literal pace" or "a named reference" is ever set (see the
  // pace_reference migration's own CHECK constraint). "Fixed pace" vs.
  // "Reference" is a real mode switch in the UI, not two independent
  // fields that happen to coexist.
  plannedPaceReference: PaceReferenceKey | null;
  // Mutually exclusive with plannedDistanceM/MaxM AND plannedDurationS/MaxS
  // together -- a percent replaces BOTH distance and duration at once
  // (see the volume_percent migration's own CHECK constraint), since which
  // one it resolves to depends on that week's own target_volume_unit, not
  // a per-field choice. "Fixed" vs. "% of week" is a real mode switch, same
  // shape as pace's reference toggle above.
  plannedVolumePercent: number | null;
  plannedHrBpm: number | null;
  plannedHrMaxBpm: number | null;
  plannedRpe: number | null;
  plannedRpeMax: number | null;
};

export type WorkoutTargetPayload = WorkoutTargetFieldsInitial;

function parseMiles(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.round(n * MILE_METERS) : null;
}
function parseMinutes(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.round(n * 60) : null;
}
function parsePaceClock(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  return parseTimeToSeconds(trimmed);
}
function parseWholeNumber(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// Distance, duration, and pace stay mathematically consistent as a coach
// types (see workout-distance.ts's autoCompleteWorkoutTargets), and heart
// rate / RPE ride alongside them as independent target ranges -- shared
// between QuickCreatePanel, the full WorkoutForm, and workout templates
// (coaching/templates/template-form.tsx) so this state, its live
// auto-fill, and its validation exist exactly once rather than drifting
// between forms the way distance/duration's own state briefly did before
// this hook existed. Lives alongside DayVocabularyFields/ExtrasEditor in
// src/components/private-coaching/ for the same reason.
export function useWorkoutTargetFields(existing?: Partial<WorkoutTargetFieldsInitial>) {
  const [distanceInput, setDistanceInputRaw] = useState(metersToMilesInput(existing?.plannedDistanceM ?? null));
  const [distanceMaxInput, setDistanceMaxInputRaw] = useState(metersToMilesInput(existing?.plannedDistanceMaxM ?? null));
  const [durationInput, setDurationInputRaw] = useState(secondsToMinutesInput(existing?.plannedDurationS ?? null));
  const [durationMaxInput, setDurationMaxInputRaw] = useState(secondsToMinutesInput(existing?.plannedDurationMaxS ?? null));
  const [paceInput, setPaceInputRaw] = useState(secondsToPaceInput(existing?.plannedPaceSPerMi ?? null));
  const [paceMaxInput, setPaceMaxInputRaw] = useState(secondsToPaceInput(existing?.plannedPaceMaxSPerMi ?? null));
  const [paceReference, setPaceReference] = useState<PaceReferenceKey | null>(existing?.plannedPaceReference ?? null);
  const [volumePercentInput, setVolumePercentInputRaw] = useState(
    existing?.plannedVolumePercent != null ? String(existing.plannedVolumePercent) : "",
  );
  const [hrInput, setHrInput] = useState(existing?.plannedHrBpm != null ? String(existing.plannedHrBpm) : "");
  const [hrMaxInput, setHrMaxInput] = useState(existing?.plannedHrMaxBpm != null ? String(existing.plannedHrMaxBpm) : "");
  const [rpeInput, setRpeInput] = useState(existing?.plannedRpe != null ? String(existing.plannedRpe) : "");
  const [rpeMaxInput, setRpeMaxInput] = useState(existing?.plannedRpeMax != null ? String(existing.plannedRpeMax) : "");

  // Applying a template (see quick-create-panel.tsx/workout-form.tsx/
  // template-form.tsx's applyTemplate) has to overwrite every field of an
  // already-mounted form, not just seed it once at first render the way
  // `existing` does -- plain useState only ever reads its initial value
  // once, so this is the imperative escape hatch. Any field omitted from
  // `values` is left untouched (a template with no pace range shouldn't
  // blank out a pace the coach already typed in by hand).
  function resetTo(values: Partial<WorkoutTargetFieldsInitial>) {
    if ("plannedDistanceM" in values) setDistanceInputRaw(metersToMilesInput(values.plannedDistanceM ?? null));
    if ("plannedDistanceMaxM" in values) setDistanceMaxInputRaw(metersToMilesInput(values.plannedDistanceMaxM ?? null));
    if ("plannedDurationS" in values) setDurationInputRaw(secondsToMinutesInput(values.plannedDurationS ?? null));
    if ("plannedDurationMaxS" in values) setDurationMaxInputRaw(secondsToMinutesInput(values.plannedDurationMaxS ?? null));
    if ("plannedPaceSPerMi" in values) setPaceInputRaw(secondsToPaceInput(values.plannedPaceSPerMi ?? null));
    if ("plannedPaceMaxSPerMi" in values) setPaceMaxInputRaw(secondsToPaceInput(values.plannedPaceMaxSPerMi ?? null));
    if ("plannedPaceReference" in values) setPaceReference(values.plannedPaceReference ?? null);
    if ("plannedVolumePercent" in values) setVolumePercentInputRaw(values.plannedVolumePercent != null ? String(values.plannedVolumePercent) : "");
    if ("plannedHrBpm" in values) setHrInput(values.plannedHrBpm != null ? String(values.plannedHrBpm) : "");
    if ("plannedHrMaxBpm" in values) setHrMaxInput(values.plannedHrMaxBpm != null ? String(values.plannedHrMaxBpm) : "");
    if ("plannedRpe" in values) setRpeInput(values.plannedRpe != null ? String(values.plannedRpe) : "");
    if ("plannedRpeMax" in values) setRpeMaxInput(values.plannedRpeMax != null ? String(values.plannedRpeMax) : "");
  }

  function buildRanges(overrides: Partial<WorkoutTargetRanges>): WorkoutTargetRanges {
    return {
      distanceMinM: parseMiles(distanceInput),
      distanceMaxM: parseMiles(distanceMaxInput),
      durationMinS: parseMinutes(durationInput),
      durationMaxS: parseMinutes(durationMaxInput),
      paceMinSPerMi: parsePaceClock(paceInput),
      paceMaxSPerMi: parsePaceClock(paceMaxInput),
      ...overrides,
    };
  }

  // Only ever writes to whichever ONE of the other two field groups the
  // derivation actually changed -- never the field the coach is actively
  // typing in, so a live keystroke is never fought or reformatted out from
  // under them. Never writes into pace at all while a reference is active
  // -- distance+duration cross-filling a literal number in behind a
  // reference the coach explicitly chose would silently reintroduce a
  // stale/fixed pace the moment they toggled back to "Fixed pace."
  function applyAutoComplete(field: "distance" | "duration" | "pace", ranges: WorkoutTargetRanges) {
    const result = autoCompleteWorkoutTargets(field, ranges);
    if (field !== "distance" && (result.distanceMinM !== ranges.distanceMinM || result.distanceMaxM !== ranges.distanceMaxM)) {
      setDistanceInputRaw(metersToMilesInput(result.distanceMinM));
      setDistanceMaxInputRaw(metersToMilesInput(result.distanceMaxM));
    }
    if (field !== "duration" && (result.durationMinS !== ranges.durationMinS || result.durationMaxS !== ranges.durationMaxS)) {
      setDurationInputRaw(secondsToMinutesInput(result.durationMinS));
      setDurationMaxInputRaw(secondsToMinutesInput(result.durationMaxS));
    }
    if (
      field !== "pace" &&
      paceReference == null &&
      (result.paceMinSPerMi !== ranges.paceMinSPerMi || result.paceMaxSPerMi !== ranges.paceMaxSPerMi)
    ) {
      setPaceInputRaw(secondsToPaceInput(result.paceMinSPerMi));
      setPaceMaxInputRaw(secondsToPaceInput(result.paceMaxSPerMi));
    }
  }

  function onDistanceMinChange(value: string) {
    setDistanceInputRaw(value);
    if (!value.trim()) setDistanceMaxInputRaw("");
    // Editing distance/duration directly is the coach opting back into a
    // fixed figure -- clears an active volume percent back to null rather
    // than leaving a stale percent that would silently win again on save
    // (mirrors the DB's own exclusivity constraint).
    if (volumePercentInput) setVolumePercentInputRaw("");
    applyAutoComplete(
      "distance",
      buildRanges({ distanceMinM: parseMiles(value), distanceMaxM: value.trim() ? parseMiles(distanceMaxInput) : null }),
    );
  }
  function onDistanceMaxChange(value: string) {
    setDistanceMaxInputRaw(value);
    if (volumePercentInput) setVolumePercentInputRaw("");
    applyAutoComplete("distance", buildRanges({ distanceMaxM: parseMiles(value) }));
  }
  function onDurationMinChange(value: string) {
    setDurationInputRaw(value);
    if (!value.trim()) setDurationMaxInputRaw("");
    if (volumePercentInput) setVolumePercentInputRaw("");
    applyAutoComplete(
      "duration",
      buildRanges({ durationMinS: parseMinutes(value), durationMaxS: value.trim() ? parseMinutes(durationMaxInput) : null }),
    );
  }
  function onDurationMaxChange(value: string) {
    setDurationMaxInputRaw(value);
    if (volumePercentInput) setVolumePercentInputRaw("");
    applyAutoComplete("duration", buildRanges({ durationMaxS: parseMinutes(value) }));
  }
  // Switching TO a percent clears whatever literal distance/duration was
  // typed -- the percent becomes the sole source of truth for volume
  // (mirrors the DB's own exclusivity constraint, and pace's identical
  // onPaceReferenceChange above). Pace/HR/RPE are untouched -- a %-of-week
  // day can still carry a fixed or referenced pace, that's independent.
  function onVolumePercentChange(value: string) {
    setVolumePercentInputRaw(value);
    if (value.trim()) {
      setDistanceInputRaw("");
      setDistanceMaxInputRaw("");
      setDurationInputRaw("");
      setDurationMaxInputRaw("");
    }
  }
  function onPaceMinChange(value: string) {
    setPaceInputRaw(value);
    if (!value.trim()) setPaceMaxInputRaw("");
    setPaceReference(null);
    applyAutoComplete(
      "pace",
      buildRanges({ paceMinSPerMi: parsePaceClock(value), paceMaxSPerMi: value.trim() ? parsePaceClock(paceMaxInput) : null }),
    );
  }
  function onPaceMaxChange(value: string) {
    setPaceMaxInputRaw(value);
    setPaceReference(null);
    applyAutoComplete("pace", buildRanges({ paceMaxSPerMi: parsePaceClock(value) }));
  }
  // Switching TO a reference clears whatever literal pace was typed --
  // the reference becomes the sole source of truth (mirrors the DB's own
  // exclusivity constraint). Switching back to "Fixed pace" (value: null)
  // leaves the (already-cleared) pace inputs for the coach to fill in
  // fresh, never resurrecting a stale number.
  function onPaceReferenceChange(value: PaceReferenceKey | null) {
    setPaceReference(value);
    if (value) {
      setPaceInputRaw("");
      setPaceMaxInputRaw("");
    }
  }
  function onHrMinChange(value: string) {
    setHrInput(value);
    if (!value.trim()) setHrMaxInput("");
  }
  function onHrMaxChange(value: string) {
    setHrMaxInput(value);
  }
  function onRpeMinChange(value: string) {
    setRpeInput(value);
    if (!value.trim()) setRpeMaxInput("");
  }
  function onRpeMaxChange(value: string) {
    setRpeMaxInput(value);
  }

  function getPayload(): { ok: true; data: WorkoutTargetPayload } | { ok: false; error: string } {
    // Whenever a volume percent is active, the literal distance/duration
    // fields are always null in the payload regardless of what's buffered
    // in the inputs (they're kept empty by onVolumePercentChange already,
    // but this is the defense-in-depth backstop the DB's own exclusivity
    // CHECK constraint expects -- never rely solely on the UI having
    // hidden the fields, same reasoning as pace's own backstop below).
    const plannedVolumePercent = volumePercentInput.trim() ? parseWholeNumber(volumePercentInput) : null;
    if (volumePercentInput.trim() && (plannedVolumePercent === null || plannedVolumePercent <= 0)) {
      return { ok: false, error: "Enter volume as a percent of the week, e.g. 20." };
    }

    const plannedDistanceM = plannedVolumePercent ? null : parseMiles(distanceInput);
    if (!plannedVolumePercent && distanceInput.trim() && (plannedDistanceM === null || plannedDistanceM <= 0)) {
      return { ok: false, error: "Enter distance as a number." };
    }
    const plannedDistanceMaxM = plannedVolumePercent ? null : distanceMaxInput.trim() ? parseMiles(distanceMaxInput) : null;
    if (!plannedVolumePercent && distanceMaxInput.trim() && plannedDistanceMaxM === null) {
      return { ok: false, error: "Enter the max distance as a number." };
    }
    const distanceCheck = validateDistanceRange(plannedDistanceM, plannedDistanceMaxM);
    if (!distanceCheck.valid) return { ok: false, error: distanceCheck.error };

    const plannedDurationS = plannedVolumePercent ? null : parseMinutes(durationInput);
    if (!plannedVolumePercent && durationInput.trim() && (plannedDurationS === null || plannedDurationS <= 0)) {
      return { ok: false, error: "Enter duration in minutes as a number." };
    }
    const plannedDurationMaxS = plannedVolumePercent ? null : durationMaxInput.trim() ? parseMinutes(durationMaxInput) : null;
    if (!plannedVolumePercent && durationMaxInput.trim() && plannedDurationMaxS === null) {
      return { ok: false, error: "Enter the max duration as a number." };
    }
    const durationCheck = validateDurationRange(plannedDurationS, plannedDurationMaxS);
    if (!durationCheck.valid) return { ok: false, error: durationCheck.error };

    // Whenever a reference is active, the literal fields are always null in
    // the payload regardless of what's buffered in paceInput/paceMaxInput
    // (they're kept empty by onPaceReferenceChange already, but this is
    // the defense-in-depth backstop the DB's own exclusivity CHECK
    // constraint expects -- never rely solely on the UI having hidden the
    // fields).
    const plannedPaceSPerMi = paceReference ? null : paceInput.trim() ? parsePaceClock(paceInput) : null;
    if (!paceReference && paceInput.trim() && plannedPaceSPerMi === null) {
      return { ok: false, error: "Enter pace as mm:ss per mile." };
    }
    const plannedPaceMaxSPerMi = paceReference ? null : paceMaxInput.trim() ? parsePaceClock(paceMaxInput) : null;
    if (!paceReference && paceMaxInput.trim() && plannedPaceMaxSPerMi === null) {
      return { ok: false, error: "Enter the max pace as mm:ss per mile." };
    }
    const paceCheck = validatePaceRange(plannedPaceSPerMi, plannedPaceMaxSPerMi);
    if (!paceCheck.valid) return { ok: false, error: paceCheck.error };

    const plannedHrBpm = parseWholeNumber(hrInput);
    if (hrInput.trim() && (plannedHrBpm === null || plannedHrBpm <= 0)) {
      return { ok: false, error: "Enter heart rate as a number." };
    }
    const plannedHrMaxBpm = hrMaxInput.trim() ? parseWholeNumber(hrMaxInput) : null;
    if (hrMaxInput.trim() && plannedHrMaxBpm === null) return { ok: false, error: "Enter the max heart rate as a number." };
    const hrCheck = validateHrRange(plannedHrBpm, plannedHrMaxBpm);
    if (!hrCheck.valid) return { ok: false, error: hrCheck.error };

    const plannedRpe = parseWholeNumber(rpeInput);
    if (rpeInput.trim() && plannedRpe === null) return { ok: false, error: "Enter RPE as a number from 1-10." };
    const plannedRpeMax = rpeMaxInput.trim() ? parseWholeNumber(rpeMaxInput) : null;
    if (rpeMaxInput.trim() && plannedRpeMax === null) {
      return { ok: false, error: "Enter the max RPE as a number from 1-10." };
    }
    const rpeCheck = validateRpeRange(plannedRpe, plannedRpeMax);
    if (!rpeCheck.valid) return { ok: false, error: rpeCheck.error };

    return {
      ok: true,
      data: {
        plannedDistanceM,
        plannedDistanceMaxM,
        plannedDurationS,
        plannedDurationMaxS,
        plannedPaceSPerMi,
        plannedPaceMaxSPerMi,
        plannedPaceReference: paceReference,
        plannedVolumePercent,
        plannedHrBpm,
        plannedHrMaxBpm,
        plannedRpe,
        plannedRpeMax,
      },
    };
  }

  return {
    fieldProps: {
      distanceMinInput: distanceInput,
      onDistanceMinChange,
      distanceMaxInput,
      onDistanceMaxChange,
      durationMinInput: durationInput,
      onDurationMinChange,
      durationMaxInput,
      onDurationMaxChange,
      paceMinInput: paceInput,
      onPaceMinChange,
      paceMaxInput,
      onPaceMaxChange,
      paceReference,
      onPaceReferenceChange,
      volumePercentInput,
      onVolumePercentChange,
      hrMinInput: hrInput,
      onHrMinChange,
      hrMaxInput,
      onHrMaxChange,
      rpeMinInput: rpeInput,
      onRpeMinChange,
      rpeMaxInput,
      onRpeMaxChange,
    },
    getPayload,
    resetTo,
  };
}
