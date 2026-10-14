// A fast-scan color accent for the calendar's day_label vocabulary --
// decorative only, never the sole signal (the label text itself always
// renders regardless of color; see WorkoutCard). Groups related day types
// under the same accent purely for visual recognition, not to encode a
// good/bad or easy/hard judgment -- e.g. Easy and Shakeout share an accent
// because they're both light days, not because the color itself means
// "good." Deliberately never uses the site's error/red accent here, since
// that token is reserved for actual problems (pain reported, a failed
// action) elsewhere in the app, and would misread as "something's wrong"
// on an ordinary hard-effort day.
export type DayTypeAccent = "tip" | "warning" | "research" | "success" | "forest" | "navy" | "neutral";

// Keyed by both the full name a coach picks from SUGGESTED_DAY_LABELS
// (below) and its abbreviation (still a valid, freely-typeable value, and
// what any row saved before the datalist spelled these out in full
// already contains) -- both forms must resolve to the same accent.
const DAY_TYPE_ACCENTS: Record<string, DayTypeAccent> = {
  easy: "forest",
  shakeout: "forest",
  recovery: "success",
  xt: "success",
  "cross training": "success",
  strength: "success",
  "long run": "navy",
  lr: "navy",
  mlr: "navy",
  "medium long run": "navy",
  threshold: "warning",
  tempo: "warning",
  intervals: "research",
  "vo₂": "research",
  vo2: "research",
  fartlek: "tip",
  progression: "tip",
};

// Suggested vocabulary for the day_label <datalist> -- spelled out in
// full ("Medium Long Run," "Cross Training") since this is what a coach
// sees while choosing or editing one; the calendar's own compact views
// abbreviate it back down for display, see abbreviateDayLabel below.
// Still just a suggestion; a coach can type anything (including the
// abbreviation directly), which falls back to "neutral" in
// DAY_TYPE_ACCENTS above rather than forcing a match.
export const SUGGESTED_DAY_LABELS = [
  "Easy",
  "Recovery",
  "Long Run",
  "Medium Long Run",
  "Threshold",
  "Tempo",
  "Intervals",
  "VO₂",
  "Fartlek",
  "Progression",
  "Shakeout",
  "Cross Training",
  "Strength",
];

// A day_label can carry a parenthetical detail composed onto it -- today
// only XT does this (see SUGGESTED_XT_TYPES/DayVocabularyFields: "XT"
// alone doesn't say what a coach actually wants an athlete to do, so
// picking a modality composes it into "XT (Bike)"), but the parse is
// generic rather than XT-specific in case another label wants the same
// treatment later. Splitting it back out is what lets both the color
// lookup below and the modality picker keep working once a workout's
// day_label is already "XT (Bike)," not just plain "XT."
export function splitDayLabel(label: string): { base: string; detail: string } {
  const match = label.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (match) return { base: match[1].trim(), detail: match[2].trim() };
  return { base: label.trim(), detail: "" };
}

export const SUGGESTED_XT_TYPES = ["Pool", "Bike", "Elliptical", "Rowing", "Swim", "Erg"];

// "Is this label's base the cross-training day type" -- true for either
// the full suggested name or the bare abbreviation a coach may have typed
// directly (or that predates the datalist spelling it out in full).
// Shared by DayVocabularyFields (whether to show the modality picker at
// all) and the workout detail page (whether to prompt the athlete for
// activity type -- see isBareXt below) so the two can't drift apart on
// what counts as "an XT day."
export function isXtLabel(base: string): boolean {
  const b = base.toLowerCase();
  return b === "xt" || b === "cross training";
}

// A coach who scheduled a bare XT day (no modality of their own already
// picked) never said which -- pool, bike, and elliptical are entirely
// different sessions, so the athlete is the one who actually knows what
// they did. A coach who DID pick one ("Cross Training (Bike)") doesn't
// need the athlete to repeat it.
export function isBareXt(dayLabel: string | null): boolean {
  if (!dayLabel) return false;
  const { base, detail } = splitDayLabel(dayLabel);
  return isXtLabel(base) && !detail;
}

export function getDayTypeAccent(dayLabel: string | null): DayTypeAccent {
  if (!dayLabel) return "neutral";
  const { base } = splitDayLabel(dayLabel);
  return DAY_TYPE_ACCENTS[base.toLowerCase()] ?? "neutral";
}

// The full name a coach picked ("Medium Long Run," "Cross Training") is
// what gets stored and what the edit form shows back -- but Month View's
// dense grid needs "MLR"/"XT" instead. This is display-only: it never
// touches the stored value, so re-opening a workout for edit still shows
// exactly what the coach originally chose. Case-insensitive, and
// preserves any parenthetical detail via splitDayLabel (e.g. "Cross
// Training (Bike)" -> "XT (Bike)"). A label that's already abbreviated,
// or one outside this list entirely, passes through unchanged.
const DAY_LABEL_ABBREVIATIONS: Record<string, string> = {
  "long run": "LR",
  "medium long run": "MLR",
  "cross training": "XT",
};

export function abbreviateDayLabel(label: string): string {
  const { base, detail } = splitDayLabel(label);
  const abbreviation = DAY_LABEL_ABBREVIATIONS[base.toLowerCase()];
  if (!abbreviation) return label;
  return detail ? `${abbreviation} (${detail})` : abbreviation;
}

export const DAY_TYPE_BORDER_CLASSES: Record<DayTypeAccent, string> = {
  tip: "border-l-accent-tip",
  warning: "border-l-accent-warning",
  research: "border-l-accent-research",
  success: "border-l-accent-success",
  forest: "border-l-accent-forest",
  navy: "border-l-accent-navy",
  neutral: "border-l-zinc-300 dark:border-l-zinc-700",
};
