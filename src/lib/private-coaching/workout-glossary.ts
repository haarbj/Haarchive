// "Why this workout": a plain-language explanation of each kind of
// session a coached athlete gets assigned, shown on the workout detail
// page and browsable as a whole on /coaching/learn/workout-types.
//
// Original copy in a coaching voice, written for this platform. Nothing
// here is transcribed from a book or another published plan, and no entry
// cites a study or a finding (CLAUDE.md §5/§15).
//
// WHY THIS MATCHES ON day_label RATHER THAN A TAXONOMY COLUMN
//
// Private coaching has no workout-kind enum, deliberately: day_label is
// free text with a datalist of suggestions, and its own migration
// (20260826070000_private_coaching_day_vocabulary.sql) explicitly forbids
// coupling it to the legacy public.workout_type enum. So a glossary entry
// is resolved the same way day-type-visuals.ts resolves a color: a
// normalized lookup over the labels a coach actually types, with an
// unrecognized label resolving to nothing rather than being forced into
// the nearest match.
//
// The one addition over a plain label lookup is pace context. The same
// "Intervals" label means genuinely different sessions at 100% of 5K pace,
// at 110% of marathon pace and at 100% of marathon pace, and those
// differences are the entire point of the phase progression, so they have
// to survive into the UI. A rule can therefore require a pace-percent
// basis and a percentage window alongside its labels, and the
// pace-conditioned rules are evaluated before the bare-label ones.

import type { PaceReferenceKey } from "./pace-reference";
import { splitDayLabel } from "./day-type-visuals";

export type GlossaryPhase = "general" | "supportive" | "specific" | "advanced" | "any";

export type WorkoutGlossaryEntry = {
  id: string;
  name: string;
  // Two or three sentences: what this session actually is.
  whatItIs: string;
  // What it targets and how to run it well.
  howToExecute: string;
  // Which of the four components of marathon fitness it builds, and the
  // physiology underneath that. Every entry has one, so an athlete can
  // always connect today's session to the thing it's for.
  whatItBuilds: string;
  phase: GlossaryPhase;
  // Advanced sessions a coach assigns deliberately, never something to
  // add on your own initiative. The eligibility rules that decide who can
  // be given these are a separate piece of work and are not enforced
  // here; this flag only drives the "your coach assigns this" note.
  coachAssignOnly?: boolean;
};

export const WORKOUT_GLOSSARY: WorkoutGlossaryEntry[] = [
  // ---- General phase ------------------------------------------------
  {
    id: "easy-running",
    name: "Easy and very easy running",
    phase: "any",
    whatItIs:
      "The bulk of your week, run at a pace you could hold while talking in full sentences. Very easy and recovery days sit a notch below that again, and exist to let a hard session be absorbed rather than to add anything of their own.",
    howToExecute:
      "Run by feel, not by pace. If you are wondering whether you are going slowly enough, you probably are not. Easy days after a big workout should feel markedly slower than usual, and that is the session working rather than a problem.",
    whatItBuilds:
      "Mitochondrial density, capillary networks and cardiac structure, plus the tendon and bone toughness that lets you keep training at all. This is the groundwork resilience is later built on.",
  },
  {
    id: "strong-run",
    name: "Strong run",
    phase: "general",
    whatItIs:
      "A continuous run at a strong but clearly controlled effort, well backed off from half marathon pace. Fast but relaxed is the whole description.",
    howToExecute:
      "The test is how you feel at the end: you should finish believing you could comfortably run another mile or two at the same pace with no real fatigue piling up in your legs. If the last mile is a fight, it was too fast.",
    whatItBuilds:
      "Oxidative capacity in the muscle fibers that do the work at these speeds, and the efficiency that comes from spending real time running smoothly at a strong pace.",
  },
  {
    id: "cruise-intervals",
    name: "Cruise intervals",
    phase: "general",
    whatItIs:
      "Repeats run just on the sustainable side of your maximal steady state, broken up by short, easy recoveries. The point is to accumulate time at a high aerobic intensity without ever tipping over into a pace that unravels.",
    howToExecute:
      "Hold the same pace across every repeat. The recoveries should feel like pressing pause rather than like recovering from something: short, easy, and just long enough to keep the next repeat honest.",
    whatItBuilds:
      "Your maximal steady state directly. Raising that ceiling sometimes requires working slightly above it, which is what makes the repeat structure useful rather than just running continuously.",
  },
  {
    id: "progression-run",
    name: "Kenyan-style progression run",
    phase: "general",
    whatItIs:
      "A run that starts extremely easy and finishes fast but relaxed, progressing gradually the whole way through rather than flipping into a hard effort at the end.",
    howToExecute:
      "Start slower than feels necessary and resist checking the watch. You want to finish exhilarated, not exhausted. Progressing too eagerly and having to slow down later is a normal part of learning these, and the learning is part of the point: this is the session that teaches you what your own pacing feels like from the inside.",
    whatItBuilds:
      "Economy as a skill, plus oxidative capacity across a wide band of paces. A single progression run touches most of the intensity ladder in one continuous effort.",
  },
  {
    id: "strides",
    name: "Strides",
    phase: "any",
    whatItIs:
      "Short, smooth accelerations of roughly 20 seconds, usually tacked onto the end of an easy run. They are emphatically not sprints.",
    howToExecute:
      "Build up smoothly, run relaxed and tall at a quick pace, and shut it down before anything starts straining. Take a full, unhurried recovery between them. If you are breathing hard afterwards, you ran them too hard.",
    whatItBuilds:
      "Running economy and neuromuscular coordination. Your body self-optimizes toward smooth, efficient movement when it gets regular practice at speed, which is why these cost so little and matter so much.",
  },
  {
    id: "mid-run-pickups",
    name: "Mid-run pickups",
    phase: "general",
    whatItIs:
      "Brief surges of 30 to 60 seconds inserted into an otherwise easy run, with easy running between them.",
    howToExecute:
      "Get 10 to 15 minutes of easy warm-up in before the first one. Keep them smooth and controlled rather than hard, and let the easy running between them actually be easy.",
    whatItBuilds:
      "Economy and fast-twitch fiber recruitment inside an aerobic run, without the recovery cost of a full workout.",
  },
  {
    id: "long-easy",
    name: "Long easy run",
    phase: "general",
    whatItIs:
      "Strictly easy time on feet. No progression, no pickups, no quality of any kind hidden in it.",
    howToExecute:
      "Run it by duration rather than distance, especially on trails or hills where the terrain decides your pace for you. The effort stays easy the whole way, including the last 20 minutes when it would be easy to drift faster.",
    whatItBuilds:
      "Mitochondrial density, capillary development and structural durability, and the beginnings of glycogen-depletion resistance that resilience later depends on.",
  },
  {
    id: "long-moderate",
    name: "Long moderate run",
    phase: "general",
    whatItIs:
      "A long run at a moderate rather than easy effort, often over rolling terrain. Harder than a long easy run, and nowhere near a marathon-specific session.",
    howToExecute:
      "Run the effort, not the splits, and let the hills do what they do to your pace. Climbs will slow you down and that is fine; what matters is that the effort stays moderate and even throughout.",
    whatItBuilds:
      "Oxidative capacity and, through the repeated eccentric loading of rolling terrain, muscle-damage resistance. That resistance is one of the three roots of marathon resilience.",
  },
  {
    id: "intervals-95-5k",
    name: "Intervals at 95% of 5K pace",
    phase: "general",
    whatItIs:
      "Repeats at a pace just past your maximal steady state, usually with short float or jog recoveries. Hard aerobic work rather than a sprint session.",
    howToExecute:
      "Even pacing across every repeat matters more than making the first one fast. Keep the recoveries honest: a float recovery that stays above your easy pace is doing real work, not just passing time.",
    whatItBuilds:
      "Lactate shuttling and your maximal steady state. The shuttle proteins that clear and reuse lactate live in slow-twitch fibers, and the way to train them is to work the gradient repeatedly rather than to chase the burn.",
  },
  {
    id: "intervals-100-5k",
    name: "Intervals at 100% of 5K pace",
    phase: "general",
    whatItIs:
      "Repeats at current 5K pace, with recoveries long enough that each one can be run properly. The most intense aerobic session in the general phase.",
    howToExecute:
      "Repeats of two minutes or longer, totaling at least 15 minutes of work, are what make this productive. A session that is too difficult to complete at the prescribed pace is usually telling you the 5K estimate behind it is optimistic, which is useful information.",
    whatItBuilds:
      "VO2max: blood volume, cardiac output, capillary density and mitochondrial respiratory power. This is the session that raises the ceiling everything else is a fraction of.",
  },
  {
    id: "doubles",
    name: "Doubles",
    phase: "any",
    whatItIs:
      "The day's mileage split into two runs instead of one. Same volume, delivered in two smaller doses.",
    howToExecute:
      "Keep both runs easy unless the plan says otherwise, and leave real time between them. The second run will usually feel better than you expect.",
    whatItBuilds:
      "Mitochondrial density and cardiac structure with meaningfully less mechanical and metabolic stress than a single long run of the same distance. This is how volume gets added when a longer single run would cost too much.",
  },
  {
    id: "low-key-race",
    name: "Low-key race",
    phase: "general",
    whatItIs:
      "A 5K, 8K or 10K run as training rather than as a goal race. It stands in for a workout at 95 to 100 percent of 5K pace, and a longer race can stand in for a long run with quality in it.",
    howToExecute:
      "Race it honestly but treat it as a session, not a test of your season. Cut the following week's midweek volume by 20 to 30 percent to pay for it.",
    whatItBuilds:
      "The same things the workout it replaces would, plus practice at the parts of racing that no workout trains: a crowded start, pacing without a plan to lean on, and competing.",
  },

  // ---- Supportive phase ---------------------------------------------
  {
    id: "long-fast-90",
    name: "Long fast run at 90% of marathon pace",
    phase: "supportive",
    whatItIs:
      "A long run with a large block of it at roughly 90 percent of marathon pace. This is the single best marathon preparation session there is, and the phase is built around it.",
    howToExecute:
      "It is deceptively comfortable early and genuinely hard late, so the discipline is holding the early pace down to the prescribed one. Over the phase, progress by extending the fast portion and then by nudging the pace toward 95 percent, not by doing both at once.",
    whatItBuilds:
      "Resilience, directly: glycogen-depletion resistance, muscle-damage resistance and central-fatigue resistance all at once. Resilience is the missing ingredient for runners who race a strong 5K and then fade badly over the last six miles of a marathon.",
  },
  {
    id: "long-fast-stepwise",
    name: "Stepwise long fast run",
    phase: "supportive",
    whatItIs:
      "A long fast run whose intensity steps up as it goes, with the fastest running in the final portion.",
    howToExecute:
      "Run the early steps at the prescribed pace rather than ahead of it, and earn the last step. The structure is also a hedge: if your marathon fitness estimate is optimistic, you find out in the middle of the session with room to adjust instead of blowing up in the first 20 minutes.",
    whatItBuilds:
      "The same resilience the flat version builds, with extra emphasis on running well on tired legs, which is the specific skill the last hour of a marathon demands.",
  },
  {
    id: "alternating-km-105",
    name: "Alternating kilometers at 105% of marathon pace",
    phase: "supportive",
    whatItIs:
      "Repeats at roughly 105 percent of marathon pace alternating with recovery kilometers that are themselves run at a real pace rather than jogged.",
    howToExecute:
      "Control both halves. The temptation is to run the fast kilometers too fast and then limp through the recoveries, which turns a sustainable session into an unsustainable one. The recoveries are part of the workout.",
    whatItBuilds:
      "Lactate shuttling and resilience. The fast recoveries are the ingredient that makes this different from ordinary intervals: clearing and reusing lactate while still running quickly is the trainable skill here.",
  },
  {
    id: "fast-continuous-105",
    name: "Fast continuous run at 105% of marathon pace",
    phase: "supportive",
    whatItIs:
      "An uninterrupted run at roughly 105 percent of marathon pace. No repeats, no recoveries, nowhere to hide.",
    howToExecute:
      "Settle into the pace early and hold it. This session doubles as a reality check on your fitness estimate: being gassed in the first third means the estimate is optimistic, and the right response is to revise the estimate rather than to tough out the rest.",
    whatItBuilds:
      "Your maximal steady state, and economy at a pace close enough to marathon pace that the efficiency gains transfer directly.",
  },
  {
    id: "long-repeats-110",
    name: "Long repeats at 110% of marathon pace",
    phase: "supportive",
    whatItIs:
      "Extended repeats at roughly 110 percent of marathon pace, the fastest sustained running in the supportive phase.",
    howToExecute:
      "Progress by extending the length of each repeat over the phase rather than by adding speed. Runners with an endurance-leaning background often do better dialing this to 107 or 108 percent and holding the longer rep distance.",
    whatItBuilds:
      "VO2max and maximal steady state together, which is what keeps the top end from eroding while the rest of the phase specializes downward toward marathon pace.",
  },

  // ---- Specific phase -----------------------------------------------
  {
    id: "long-fast-95",
    name: "Long fast run at 95% of marathon pace",
    phase: "specific",
    whatItIs:
      "Typically 18 to 20 miles with a large block at roughly 95 percent of marathon pace. Among the hardest sessions in the entire cycle.",
    howToExecute:
      "Run it on terrain that resembles your race, fuel it at 50 to 60 grams of carbohydrate per hour, keep the middle miles controlled, and finish strong. Never run it all out. A session this big only pays off if you can absorb it afterwards.",
    whatItBuilds:
      "Resilience at close to race pace, plus a full rehearsal of fueling and terrain. This is where the gap between your sustainable pace and your marathon pace actually closes.",
  },
  {
    id: "alternating-km-100",
    name: "Alternating kilometers at 100% of marathon pace",
    phase: "specific",
    whatItIs:
      "The bread-and-butter marathon-pace session: blocks at goal marathon pace alternating with steady recovery kilometers.",
    howToExecute:
      "The progression holds the total volume constant while lengthening the blocks, for example eight sets of two kilometers plus one, then six sets of three plus one, then five sets of four plus one. It should be challenging but not exhausting. Visualizing the race while you run it is genuinely useful here, because the pace is the one you will be holding on the day.",
    whatItBuilds:
      "Resilience and economy exactly at race pace. It is also the honesty mechanism of the whole cycle: you cannot fake this session, so an optimistic marathon pace estimate gets exposed here rather than at mile 18.",
  },
  {
    id: "fast-continuous-100",
    name: "Fast continuous run at 100% of marathon pace",
    phase: "specific",
    whatItIs:
      "Around 15 miles continuous at 98 to 100 percent of marathon pace, usually about a month out from the race.",
    howToExecute:
      "Pick an uninterrupted route on race-like terrain so the pace is never broken by stoplights or turns. Treat the result as information: holding it comfortably is a real confidence marker, and struggling badly is your fitness estimate asking to be revised while there is still time to use the answer.",
    whatItBuilds:
      "Resilience and economy at race pace, and a trustworthy basis for the race plan itself.",
  },

  // ---- Advanced, coach-assigned -------------------------------------
  {
    id: "double-threshold",
    name: "Double-threshold session",
    phase: "advanced",
    coachAssignOnly: true,
    whatItIs:
      "Two high-end aerobic sessions in the same day, both above your first lactate threshold and usually below your maximal steady state. It accumulates a large volume of fast aerobic running for a comparatively small amount of stress.",
    howToExecute:
      "Both sessions have to stay under control. The reason this works is that neither one is hard enough on its own to compromise the other, so running the morning session too fast defeats the entire purpose.",
    whatItBuilds:
      "Maximal steady state and muscle-fiber oxidative capacity. This is marathon-supportive work rather than marathon-specific work, and it belongs in a supportive block rather than close to the race.",
  },
  {
    id: "special-block",
    name: "Special block",
    phase: "advanced",
    coachAssignOnly: true,
    whatItIs:
      "A morning and an afternoon session on the same day, both high volume and both marathon-focused, run between 90 and 110 percent of marathon pace. A single day that delivers a very large, very novel stimulus.",
    howToExecute:
      "Treat it as the centerpiece of its week and clear real recovery on both sides. Two or three of these in an entire buildup is the ceiling, not a starting point.",
    whatItBuilds:
      "Resilience, more aggressively than any single session can. The cost is proportional, which is why the frequency is capped rather than progressed.",
  },
  {
    id: "depletion-workout",
    name: "Depletion workout",
    phase: "advanced",
    coachAssignOnly: true,
    whatItIs:
      "A session run with no carbohydrate beforehand and none during it, usually in the morning on an empty stomach. The stimulus comes from asking the body to work with its fuel stores already low.",
    howToExecute:
      "Keep it controlled and keep it rare. This is never appropriate for an athlete with a history of disordered eating or low energy availability, and that exclusion is not negotiable or something to work around.",
    whatItBuilds:
      "Glycogen-depletion resistance, one of the three roots of resilience. It does not replace fueling practice, it sits alongside it.",
  },
  {
    id: "hill-sprints",
    name: "Hill sprints",
    phase: "advanced",
    coachAssignOnly: true,
    whatItIs:
      "Maximal efforts of about 10 seconds up a grade of 5 percent or more, taken with long recoveries, usually after an easy run.",
    howToExecute:
      "Full recovery between each one, and stop while they still feel powerful rather than grinding out a target number. The hill is what keeps the muscle lengths short and the soreness minimal.",
    whatItBuilds:
      "Running economy and force production, effectively running-specific plyometrics with far less soreness than flat sprinting or jumping would cost.",
  },
];

const ENTRY_BY_ID = new Map(WORKOUT_GLOSSARY.map((entry) => [entry.id, entry]));

export function getGlossaryEntryById(id: string): WorkoutGlossaryEntry | null {
  return ENTRY_BY_ID.get(id) ?? null;
}

export type GlossaryPaceContext = {
  basis: PaceReferenceKey | null;
  min: number | null;
  max: number | null;
};

// A rule matches when the workout's normalized day_label base is one of
// `labels` AND, if the rule names a `basis`, the workout's own pace-percent
// basis matches and its percentage falls inside [percentMin, percentMax].
// Pace-conditioned rules come first in the array and win over bare-label
// rules for the same label, which is what lets one "Intervals" label
// resolve to four different sessions.
type MatchRule = {
  entryId: string;
  labels: string[];
  basis?: PaceReferenceKey;
  percentMin?: number;
  percentMax?: number;
};

const INTERVAL_LABELS = ["intervals", "interval", "vo₂", "vo2", "reps", "repeats", "long repeats"];
const STEADY_LABELS = ["steady state", "steady", "tempo", "threshold", "fast continuous", "fast continuous run"];
const LONG_LABELS = ["lr", "long run", "mlr", "medium long run", "long fast run"];

const MATCH_RULES: MatchRule[] = [
  // Pace-conditioned rules, most specific first.
  { entryId: "intervals-100-5k", labels: INTERVAL_LABELS, basis: "5k", percentMin: 97.5 },
  { entryId: "intervals-95-5k", labels: INTERVAL_LABELS, basis: "5k", percentMin: 92, percentMax: 97.5 },
  { entryId: "long-repeats-110", labels: INTERVAL_LABELS, basis: "marathon", percentMin: 106.5 },
  { entryId: "alternating-km-105", labels: INTERVAL_LABELS, basis: "marathon", percentMin: 102.5, percentMax: 106.5 },
  { entryId: "alternating-km-100", labels: INTERVAL_LABELS, basis: "marathon", percentMax: 102.5 },
  { entryId: "cruise-intervals", labels: STEADY_LABELS, basis: "5k", percentMin: 87.5 },
  { entryId: "strong-run", labels: STEADY_LABELS, basis: "5k", percentMax: 87.5 },
  { entryId: "fast-continuous-105", labels: STEADY_LABELS, basis: "marathon", percentMin: 102.5 },
  { entryId: "fast-continuous-100", labels: STEADY_LABELS, basis: "marathon", percentMax: 102.5 },
  { entryId: "long-fast-95", labels: LONG_LABELS, basis: "marathon", percentMin: 92.5 },
  { entryId: "long-fast-90", labels: LONG_LABELS, basis: "marathon", percentMax: 92.5 },

  // Bare-label rules.
  { entryId: "progression-run", labels: ["kenyan progression", "progression", "progression run"] },
  { entryId: "strides", labels: ["strides"] },
  { entryId: "mid-run-pickups", labels: ["pickups", "mid-run pickups", "fartlek"] },
  { entryId: "long-moderate", labels: ["mlr", "medium long run", "long moderate"] },
  { entryId: "long-easy", labels: ["lr", "long run", "long easy"] },
  { entryId: "doubles", labels: ["double", "doubles", "am/pm"] },
  { entryId: "low-key-race", labels: ["race", "low-key race"] },
  { entryId: "easy-running", labels: ["easy", "very easy", "recovery", "shakeout"] },
  { entryId: "double-threshold", labels: ["double threshold", "double-threshold"] },
  { entryId: "special-block", labels: ["special block"] },
  { entryId: "depletion-workout", labels: ["depletion", "depletion run", "depletion workout"] },
  { entryId: "hill-sprints", labels: ["hill sprints", "hill sprint"] },
];

// The one percentage a rule is tested against: the midpoint of a range,
// or the single value when only one was set. A range narrow enough to
// straddle two rules' boundaries is vanishingly rare in practice and the
// midpoint resolves it the way a coach would read it.
function representativePercent(pace: GlossaryPaceContext): number | null {
  if (pace.min != null && pace.max != null) return (pace.min + pace.max) / 2;
  return pace.min ?? pace.max ?? null;
}

function ruleMatches(rule: MatchRule, label: string, pace: GlossaryPaceContext | null): boolean {
  if (!rule.labels.includes(label)) return false;
  if (!rule.basis) return true;
  if (!pace || pace.basis !== rule.basis) return false;
  const percent = representativePercent(pace);
  if (percent == null) return false;
  if (rule.percentMin != null && percent < rule.percentMin) return false;
  if (rule.percentMax != null && percent >= rule.percentMax) return false;
  return true;
}

// Returns null for anything unrecognized, including OFF/rest/cross-training
// days and any label a coach invented, so the caller renders no section at
// all rather than a wrong explanation or an error.
export function getWorkoutGlossaryEntry(
  dayLabel: string | null,
  pace?: GlossaryPaceContext | null,
): WorkoutGlossaryEntry | null {
  if (!dayLabel) return null;
  const { base } = splitDayLabel(dayLabel);
  const label = base.toLowerCase();
  if (!label) return null;
  for (const rule of MATCH_RULES) {
    if (ruleMatches(rule, label, pace ?? null)) return getGlossaryEntryById(rule.entryId);
  }
  return null;
}

export const GLOSSARY_PHASE_LABELS: Record<GlossaryPhase, string> = {
  general: "General phase",
  supportive: "Supportive phase",
  specific: "Specific phase",
  advanced: "Advanced sessions",
  any: "Any phase",
};

export const GLOSSARY_PHASE_ORDER: GlossaryPhase[] = ["any", "general", "supportive", "specific", "advanced"];
