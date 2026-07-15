// The Coaching Library's data model -- one entry per coaching philosophy,
// rendered by the shared CoachPage template (src/components/coaches/
// coach-page.tsx) so every coach gets the exact same structure (see the
// template's own comment for why that consistency matters more than
// letting any one coach's page "be creative"). The mission every field here
// serves: teaching how a coach thinks, not what workout to run -- a field
// that would only ever produce a specific number to copy (a pace, a
// mileage target) doesn't belong in this model.

export type GenomeCategory =
  | "aerobicDevelopment"
  | "threshold"
  | "vo2max"
  | "specificity"
  | "psychology"
  | "strength"
  | "biomechanics"
  | "dataDriven"
  | "individualization"
  | "volume";

// 0-100, one per GenomeCategory. Deliberately illustrative, not a claim any
// coach has personally endorsed -- see the "Reviewed by" comment on
// CoachReview below for the mechanism that would eventually let a coach
// confirm or correct their own profile.
export type CoachGenome = Record<GenomeCategory, number>;

export type PeriodizationStage = {
  label: string;
  description: string;
};

export type WeeklyDay = {
  day: string;
  session: string;
};

// Shared by both "Best For" and "Who This Does Not Fit" -- same shape,
// opposite framing, deliberately kept as one type so the two sections stay
// symmetric (an audience described in one should never contradict how it's
// described, or not described, in the other).
export type FitAudience = {
  label: string;
  description: string;
};

export type Misunderstanding = {
  myth: string;
  reality: string;
};

// Deliberately neutral: every criticism needs a real explanation and a real
// supporter response, never just a dismissal. See coach-page.tsx's own
// comment on why `strongestArgument` always renders last.
export type Criticism = {
  criticism: string;
  explanation: string;
  response: string;
};

// The narrative answer to "what would daily life under this coach actually
// feel like" -- seven required beats, not a free-form paragraph, so every
// coach's version is genuinely comparable to the others.
export type DailyLife = {
  narrative: string;
  easyDays: string;
  hardSessions: string;
  frequency: string;
  recovery: string;
  mileage: string;
  progression: string;
  // How a bad day, a missed session, or a warning sign actually gets
  // handled -- distinct from `recovery` (the general philosophy) because
  // this is specifically about the coach's response to something going
  // wrong, not the steady-state plan.
  mistakes: string;
};

export type LastingInfluenceItem = {
  label: string;
  description: string;
};

// The encyclopedia-style opening every coach page now leads with, before
// the philosophy itself -- answers why the system emerged, not just what it
// says. Every field has to be historically supportable; see each coach's
// own data comment for what it's actually grounded in. Omit a coach's
// entire historicalContext rather than guess if a field can't be honestly
// filled in (see the Coach type's own comment on `historicalContext` being
// optional for exactly this reason).
export type HistoricalContext = {
  emergedBecause: string;
  problemItSolved: string;
  priorSystems: string;
  assumptionsChallenged: string;
  laterInfluence: string;
};

// One other real coach's documented, well-known position, applied as a
// good-faith inference about how they'd likely respond to this philosophy
// -- never a fabricated quote, always traceable to that coach's own actual
// public philosophy (see their own page). `coachSlug` must be another
// Coach in this library.
export type OtherCoachCritique = {
  coachSlug: string;
  critique: string;
};

// The same fixed workout, reacted to differently by every coach who has
// one -- shared workout text across all seven coaches (see data.ts) is
// what actually makes the contrast in reasoning visible to a reader
// comparing two pages, not just a random workout per coach.
export type WorkoutReaction = {
  workout: string;
  reaction: string;
};

// A real, if necessarily approximate, read on how well-supported a
// philosophy's central claim is -- never higher than the evidence
// genuinely justifies. 5 = extensive direct research; 1 = mostly anecdotal
// success. See each coach's own data comment for the reasoning behind its
// specific rating.
export type EvidenceStrength = {
  rating: 1 | 2 | 3 | 4 | 5;
  description: string;
};

// One coach's genealogy is a list of "tiers" -- each tier a group of
// influences that fed in at roughly the same point, rendered as parallel
// nodes converging into the next tier (see GenealogyDiagram). A coach with
// one predecessor per generation still just has one-item tiers; this is the
// same shape doing double duty as a plain chain, not a special case of it.
// `slug` is only set when that person also has their own Coaching Library
// page, so the diagram can be partially clickable.
export type GenealogyLink = {
  name: string;
  slug?: string;
};
export type GenealogyTier = GenealogyLink[];

// `url` is only set for a source with a genuinely confirmed, stable address
// (an official coach or method website) -- never a guessed link to a
// specific article, video, or retailer page. An unset `url` still renders a
// full source card (icon, kind, description, why it's worth seeking out),
// it just has no "Visit" button, per PrimarySources' own comment on why a
// plausible-looking but unverified link is worse than none.
export type SourceKind = "book" | "paper" | "podcast" | "lecture" | "interview" | "article" | "website" | "video";

export type PrimarySource = {
  title: string;
  author?: string;
  // Where it was published/hosted (a journal name, a publisher, a podcast
  // series, a channel) -- distinct from `author`, since a paper's author
  // and the journal that ran it are two different citations a reader needs
  // to actually find the source.
  publication?: string;
  kind: SourceKind;
  description: string;
  url?: string;
};

export type NotableAthlete = {
  name: string;
  events: string;
  whyRepresentative: string;
  // Whether this athlete was directly coached by this philosophy's coach,
  // or simply trained in a way heavily influenced/associated with it (e.g.
  // "Norwegian System" has no single coach to be directly coached by).
  relationship: "coached" | "influenced";
  // Set only when this athlete also has their own Athlete Library page
  // (see lib/athletes/data.ts) -- mirrors GenealogyLink's own slug
  // convention, so a name renders as a link exactly when there's somewhere
  // real for it to go.
  slug?: string;
  // A deeper look at exactly one representative athlete per coach, not
  // every athlete -- real training details only where this site already
  // has them well-documented (see each coach's own data comment); omitted
  // rather than invented for athletes where it isn't.
  caseStudy?: {
    exampleWeek: string[];
    raceOutcome: string;
    whyItFits: string;
  };
};

// A single outcome of a DecisionQuestion -- `condition` is free text (not
// restricted to yes/no) since real coaching logic sometimes branches on
// more than a binary ("12+ weeks out" vs. "under 8 weeks out"). `steps` is
// what actually happens once that branch is taken; `followUp` lets a branch
// lead to another question instead of a final answer, matching how a real
// decision actually nests (see Tom Schwartz's "recovering well" -> "can
// absorb more" example, exactly two questions deep).
export type DecisionOutcome = {
  condition: string;
  steps: string[];
  followUp?: DecisionQuestion;
};

export type DecisionQuestion = {
  question: string;
  outcomes: DecisionOutcome[];
};

// One real coaching decision, start to finish. Most scenarios genuinely
// branch (`question` set); a few are just a fixed sequence with no real
// fork (`steps` set instead, e.g. "race is approaching" always leads to the
// same taper regardless of any condition) -- exactly one of the two should
// be set, never both.
export type DecisionScenario = {
  title: string;
  question?: DecisionQuestion;
  steps?: string[];
};

export type SignatureWorkout = {
  name: string;
  description: string;
  // Into Workout Library -- omitted (not a guessed anchor) for a workout
  // that page doesn't document yet, per that component's own comment.
  workoutLibraryHref?: string;
};

export type CrossLink = {
  label: string;
  href: string;
};

// "Related Philosophies" is never just a link -- every entry has to name
// what the two systems actually share and the one thing that genuinely
// separates them, so a reader can tell at a glance whether the difference
// matters to them.
export type RelatedPhilosophy = {
  slug: string;
  shared: string;
  difference: string;
};

// Set once a coach has actually reviewed their own page -- the architecture
// this type exists for is entirely front-loaded now (CoachPage renders a
// "Reviewed by" badge whenever this is present) so turning a coach's
// feedback into a verified badge later is a one-line data change, not a
// redesign.
export type CoachReview = {
  reviewedAt: string;
};

export type Coach = {
  slug: string;
  name: string;
  // A short parenthetical the site and readers actually use day to day
  // (e.g. "Tinman" for Tom Schwartz) -- shown next to the name, not instead
  // of it.
  shortName?: string;
  // Set only when this specific coach has personally supplied a photo for
  // confirmed use (see CoachAvatar's own comment) -- omitted for everyone
  // else, who get a plain monogram instead.
  portraitUrl?: string;
  oneLiner: string;
  // A loose, approximate span (e.g. "1950s-1980s"), not a precise date --
  // most of these coaches' active years aren't crisply bounded (some are
  // still consulting or writing decades after their most famous results).
  yearsActive: string;
  // The event range this philosophy actually targets -- drives the Coach
  // Directory's filtering (see CoachComparisonTable), so it's a short,
  // fixed tag rather than free text.
  eventFocus: "Marathon" | "1500m-10K" | "General / All Distances";
  // Approximate start (and end, if the coach is no longer active/living) --
  // drives the overlapping-eras Timeline, which needs real ranges to draw
  // bars, not the single decade-point each coach used to be pinned to.
  activeYears: { start: number; end: number | null };
  // Short (4-8 word) phrases -- populate the Coach Comparison Table on the
  // Coaching Library homepage. "Best For", "Data Driven", and
  // "Individualization" columns there are deliberately derived from
  // `bestFor[0]` and `genome` instead of living here too -- one source of
  // truth per fact, not a second copy that can drift from the real data.
  compare: {
    primaryIdea: string;
    primaryAdaptation: string;
    intensityPhilosophy: string;
    mileagePhilosophy: string;
    recoveryPhilosophy: string;
    longTermSustainability: string;
  };
  // The encyclopedia-style opening: why this philosophy emerged, what it
  // was reacting against, and what came after it -- rendered before
  // Philosophy itself (see CoachPage). Optional because it should be
  // omitted entirely rather than filled with a speculative guess for any
  // coach whose emergence isn't this well documented.
  historicalContext?: HistoricalContext;
  // 2-4 paragraphs answering one question: what does this coach believe is
  // the biggest limiter to performance?
  philosophy: string[];
  corePrinciples: string[];
  // Keys into PHYSIOLOGY_TOPICS (physiology-topics.ts) -- shared canonical
  // hrefs, not duplicated per coach, so a link only ever needs fixing in
  // one place.
  physiologicalEmphasis: string[];
  signatureWorkouts: SignatureWorkout[];
  periodization: PeriodizationStage[];
  periodizationSummary: string;
  weeklyStructure: WeeklyDay[];
  weeklyStructureNote: string;
  bestFor: FitAudience[];
  notIdealFor: FitAudience[];
  misunderstandings: Misunderstanding[];
  criticisms: Criticism[];
  // Always rendered after every criticism -- the strongest case supporters
  // make, not a rebuttal to any one criticism specifically.
  strongestArgument: string;
  // Distinct from `criticisms` (this site's own even-handed critique/
  // response pairs): specifically what a NAMED other coach in this library
  // would likely say, in their own documented voice -- the point is
  // showing genuine disagreement between real philosophies, not a second
  // copy of the same criticisms.
  otherCoachesCritique: OtherCoachCritique[];
  // How well the central claim is actually supported -- rendered near
  // Criticisms, not buried at the bottom, since it's most useful right
  // where a reader is already weighing tradeoffs. Currently unrendered
  // sitewide (see coach-page.tsx) while coaches review their own pages, so
  // it's optional rather than required -- Tom Schwartz's entry omits it
  // entirely rather than carry a stale rating no page currently shows.
  evidenceStrength?: EvidenceStrength;
  dailyLife: DailyLife;
  lastingInfluence: {
    paragraphs: string[];
    items: LastingInfluenceItem[];
  };
  influencedBy: GenealogyTier[];
  primarySources: PrimarySource[];
  notableAthletes: NotableAthlete[];
  // Real coaching decisions, not a decorative list -- most coaches get 3
  // scenarios (a day-to-day training call, a race-approach protocol, and a
  // "what's actually limiting this athlete" waterfall reflecting that
  // coach's own real priority order).
  decisionScenarios: DecisionScenario[];
  // The same fixed workout(s) (see WorkoutReaction's own comment), reacted
  // to in this coach's own voice -- a reader who visits two coach pages
  // sees the same prompt land completely differently.
  workoutReactions: WorkoutReaction[];
  relatedPhilosophies: RelatedPhilosophy[];
  keyTakeaways: string[];
  genome: CoachGenome;
  crossLinks: CrossLink[];
  review?: CoachReview;
};
