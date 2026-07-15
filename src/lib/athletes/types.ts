import type { CrossLink, SignatureWorkout } from "@/lib/coaches/types";

// Re-exported so athlete-page.tsx and athlete data files have one import
// source for both -- Signature Training and Famous Training Sessions are
// deliberately the same shape (name, description, optional Workout Library
// link) as a coach's own signatureWorkouts, not a parallel type.
export type { SignatureWorkout, CrossLink };

export type PersonalBest = {
  event: string;
  time: string;
};

// A single Olympic/World Championship-level result -- kept distinct from
// PersonalBest since a medal and a fast time are different kinds of fact
// (one's a placing, one's a number) and a reader looking for either wants
// them separated, not merged into one ambiguous line.
export type MajorResult = {
  competition: string;
  result: string;
};

// One stint under one coach, ordered chronologically -- the Coaches
// Timeline renders this list top to bottom with no extra sorting logic.
// `coachSlug` is only set when that coach (or coaching system, e.g.
// "norwegian-system") has its own Coaching Library page -- mirrors
// GenealogyLink's own slug convention, never a guessed slug for a coach
// this site doesn't document. An athlete with one lifelong coach still
// just has a one-item history, not a special case of it.
export type CoachStint = {
  label: string;
  coachName: string;
  coachSlug?: string;
  years?: string;
  // What actually changed about this athlete's training once this stint
  // began -- omitted (not invented) for a stint with no well-documented
  // shift, e.g. the only coach an athlete ever had.
  whatChanged?: string;
};

export type MentalQuoteTheme =
  | "race mindset"
  | "training mindset"
  | "handling pressure"
  | "consistency"
  | "motivation"
  | "identity";

// A real, attributable quote, never invented or paraphrased into a quote
// the athlete didn't actually say -- omit this section entirely for an
// athlete without confidently-sourced quotes rather than fabricate one.
export type MentalQuote = {
  quote: string;
  context?: string;
  theme: MentalQuoteTheme;
};

export type Athlete = {
  slug: string;
  name: string;
  country: string;
  primaryEvents: string;
  personalBests: PersonalBest[];
  majorResults: MajorResult[];
  // Set only once this specific athlete has personally supplied (or
  // otherwise confirmed rights to) a photo -- mirrors Coach.portraitUrl,
  // never assumed. Omitted defaults to CoachAvatar's plain monogram via the
  // same component athlete cards reuse.
  portraitUrl?: string;
  oneLiner: string;
  // The whole point of this page per the site's own goal: not a biography,
  // but how a coaching philosophy actually showed up in this athlete's
  // training, and how it evolved across coaching changes. 2-4 paragraphs.
  philosophyNarrative: string[];
  coachHistory: CoachStint[];
  // The recurring structural elements of how this athlete trained --
  // weekly mileage, long run philosophy, threshold work, track sessions,
  // strength/altitude/cross-training/recovery where documented. Distinct
  // from famousSessions (named, iconic one-off workouts) even though both
  // reuse the same SignatureWorkout shape and both link into Workout
  // Library the same way.
  signatureTraining: SignatureWorkout[];
  famousSessions: SignatureWorkout[];
  // Keys into PHYSIOLOGY_TOPICS (physiology-topics.ts) -- same canonical
  // map coaches use, so a physiology link only ever needs fixing in one
  // place regardless of whether it's reached from a coach or an athlete.
  physiologicalEmphasis: string[];
  // A short narrative description of this athlete's mental approach --
  // always present. `mentalQuotes` is a separate, optional supplement used
  // only where a specific quote's exact wording is confidently sourced;
  // omitted (not paraphrased into a fake quote) otherwise.
  mentalApproachSummary: string[];
  mentalQuotes: MentalQuote[];
  // Educational, not celebrity-focused -- general recovery principles this
  // athlete is well-documented as actually practicing, tied back to why
  // they matter, not a gossipy list of habits.
  recoveryNotes: string[];
  // Optional -- omitted entirely rather than speculated on for the many
  // athletes whose specific gear choices aren't well documented.
  equipmentNotes?: string[];
  crossLinks: CrossLink[];
};
