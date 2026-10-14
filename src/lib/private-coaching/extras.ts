// Structured "extras" attached to a session -- strides, drills, mobility
// work, plyos, strength, or a coach's own free-typed kind (hill sprints,
// mental techniques, self-care, hips, core, anything else). Deliberately
// does NOT include warm-up/cool-down jog itself: that already exists as a
// real stepType in the structured-steps model (see steps.ts) -- it's a
// continuous run defined by a duration/distance/HR target, nothing else,
// exactly like the site's own Workout Library content describes it
// ("10-15 minutes of easy running with heart rate kept under the same
// 180-minus-age ceiling"). What belongs here instead is the itemized,
// non-continuous-running work that often comes with it: that same section
// immediately follows the warmup jog with "short drills (A-skips, B-skips,
// high knees, butt kicks, carioca in both directions, Frankensteins,
// backwards running)" -- a named list, not a pace/duration target. That's
// the actual line between a step and an extra: a step is continuous
// running with a target; an extra is discrete, non-continuous-running work
// attached to the session.
export type WorkoutExtraInput = {
  kind: string; // suggested via <datalist> (SUGGESTED_EXTRA_KINDS), but free text -- never a closed enum
  overview: string | null; // e.g. "Do each drill 50m" -- always available, regardless of kind
  count: number | null; // "how many" -- reps/sets
  distanceM: number | null; // per-rep/set distance, e.g. 20m strides
  durationS: number | null; // per-rep/set duration, alternative to distance
  items: string[]; // named sub-items, e.g. ["A skips x2", "B skips", "High knees"]
};

export const SUGGESTED_EXTRA_KINDS = ["Strides", "Drills", "Mobility", "Plyos", "Strength"];

export function emptyExtra(kind = ""): WorkoutExtraInput {
  return { kind, overview: null, count: null, distanceM: null, durationS: null, items: [] };
}

// Not every extra kind needs the same fields. Grounded in how the site's
// own Workout Library content actually describes each of these:
//   - Strides ("Strides: Fast and Relaxed, Never a Sprint") are reps x
//     distance-or-duration ("8x100m", or hill strides' "10-20 reps of
//     20-25 seconds") -- no named item list, that's not how a coach
//     writes strides.
//   - Drills, Mobility, Plyos, and Strength are all a named list of
//     discrete movements ("A-skips, B-skips, high knees...", "5 forward
//     lunges per leg...") -- an overview line plus items, not a single
//     rep/distance/duration figure for the whole thing.
//   - Everything else a coach might attach to a session -- hill sprints,
//     mental techniques, self-care, hips, core, anything not in the
//     suggested list -- generally only needs a note (overview is always
//     shown, independent of this shape). Defaulting an unrecognized kind
//     to ALL the structured fields was the actual arbitrary-feeling
//     behavior: it showed reps/distance/duration/items for something like
//     "Mental Techniques" that plainly doesn't need any of them. The
//     minimal shape below is the default for anything unrecognized; the
//     coach can still reveal the full field set on demand (see
//     ExtrasEditor's own "+ Add detail" toggle) for the cases that do
//     need it, like reps for hill sprints -- it's just never automatic.
export type ExtraFieldShape = {
  showCount: boolean;
  showDistance: boolean;
  showDuration: boolean;
  showItems: boolean;
};

const ITEMIZED_SHAPE: ExtraFieldShape = { showCount: false, showDistance: false, showDuration: false, showItems: true };
const REP_BASED_SHAPE: ExtraFieldShape = { showCount: true, showDistance: true, showDuration: true, showItems: false };
const MINIMAL_SHAPE: ExtraFieldShape = { showCount: false, showDistance: false, showDuration: false, showItems: false };
export const ALL_FIELDS_SHAPE: ExtraFieldShape = { showCount: true, showDistance: true, showDuration: true, showItems: true };

const EXTRA_KIND_SHAPES: Record<string, ExtraFieldShape> = {
  strides: REP_BASED_SHAPE,
  drills: ITEMIZED_SHAPE,
  mobility: ITEMIZED_SHAPE,
  plyos: ITEMIZED_SHAPE,
  strength: ITEMIZED_SHAPE,
};

export function isSuggestedExtraKind(kind: string): boolean {
  return kind.trim().toLowerCase() in EXTRA_KIND_SHAPES;
}

export function getExtraFieldShape(kind: string): ExtraFieldShape {
  return EXTRA_KIND_SHAPES[kind.trim().toLowerCase()] ?? MINIMAL_SHAPE;
}
