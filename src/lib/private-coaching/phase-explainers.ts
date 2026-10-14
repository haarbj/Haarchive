// The standard "why this phase" explanations a coached athlete reads on
// their own training roadmap. Original copy in a coaching voice, written
// for this platform: nothing here is transcribed from a book or any other
// published plan, and nothing cites a study or a finding (see CLAUDE.md
// §5/§15).
//
// These are DEFAULTS, not the stored value. A coach can author their own
// explainer per program phase, and whatever they wrote is copied onto the
// athlete's own phase row at assignment time; resolvePhaseExplainer below
// only falls back to the copy here when no explainer was ever authored,
// which is what lets the standard three-phase progression explain itself
// with zero coach effort while still being fully overridable.
//
// Kept in version control rather than seeded into the database by a
// migration so the copy is reviewable in a diff and testable, the same
// reasoning behind coaching-engine/coaching-copy.ts.
//
// Plain text, with blank lines separating paragraphs -- the renderer
// (components/private-coaching/phase-explainer.tsx) splits on those. No
// markdown: there's no markdown renderer in this project's dependencies
// and this content doesn't need one.

export type DefaultPhaseKey = "general" | "supportive" | "specific";

const GENERAL = `This phase builds the raw material everything later in the cycle gets made from. Four capabilities are under construction at once: your aerobic ceiling, the fraction of that ceiling you can hold without fatigue running away from you, how efficiently you convert oxygen into forward motion, and the structural toughness of the tendons, bones and muscle that have to absorb thousands of foot strikes a week. General training leans hardest on the first and third of those. The intervals raise the ceiling. The volume and the relaxed, repeated miles sharpen the efficiency.

It helps to know where this sits in the whole arc. Marathon pace is the product of those capabilities, not the sum of them, which means a small gain in each one multiplies into a surprisingly large gain in what you can hold for 26.2 miles. General raises the ceiling and the efficiency. The supportive phase that follows lifts the sustainable fraction and polishes economy at speeds close to marathon pace. The specific phase builds resilience, closing the gap between the pace you could hold for an hour and the pace you can hold for a marathon. None of those can be built well out of order, which is why this phase comes first even though it looks the least like a marathon.

Workout paces here are prescribed as a percentage of your current 5K pace. Your 5K pace is the single most useful index of where your fitness actually is right now, and expressing a workout as a percentage of it means the same prescription lands in the right physiological territory for a 16 minute runner and a 28 minute runner alike. It should be your current pace, not a personal best from two years ago and not what you hope to run in the fall.

Early in a cycle, effort outranks precision. Heat, wind, hills, poor sleep and heavy legs all make a given pace cost more than it should, and chasing the number through those conditions turns a controlled session into a hard one. Nail the effort the workout is asking for and let the pace be whatever it is that day. If the paces feel consistently wrong in the same direction over a couple of weeks, that is information about your fitness estimate, not a reason to grind harder.

Volume climbs through this phase. Expect roughly 10 to 20 percent more per week while things are going well, with a down week every third or fourth week at 20 to 30 percent below the week before it. Your peak weekly mileage for the whole cycle should arrive by the end of this phase, not later, because the phases that follow trade volume for specificity and are no place to also be learning to carry more miles.

You will start some runs tired and finish some runs sore. That is not a sign the plan is going wrong. A training stimulus has to actually disturb something to produce an adaptation, and in a phase built on accumulating volume, a background hum of fatigue is normal and often necessary. What matters is the trend: fatigue that lifts after a down week is the system working, fatigue that keeps deepening through one is worth a conversation.

Low-key racing fits well here. A 5K, 8K or 10K can stand in for a workout at 95 to 100 percent of 5K pace, and a longer race can replace a long run with quality in it. Treat it as training rather than a test, and cut the following week's midweek volume by 20 to 30 percent to pay for it.`;

const SUPPORTIVE = `General training built you two separate abilities: running long and running fast. This phase assembles them into one. That assembly is the whole point, and it is why the work here feels different from anything in the previous phase even when the paces look familiar.

Two targets carry the phase. Marathon-supportive endurance, run at roughly 90 to 95 percent of marathon pace, asks you to run longer and faster than your long runs have been. Marathon-supportive speed, at roughly 105 to 110 percent of marathon pace, asks you to run faster for longer than your intervals have been. Between them they lift your sustainable aerobic range and your economy at speeds close to the one that will actually matter, and they begin building resilience: the ability to still be running the pace late that you were running early.

The pace basis changes here, from a percentage of 5K pace to a percentage of marathon pace. That shift needs a working estimate of your current marathon fitness, and the word to hold onto is current. Estimate the pace you could hold today for the first 16 miles of a marathon, not your goal pace and not the pace you want to be ready for. A conservative estimate makes this phase work. An optimistic one quietly turns every supportive session into a specific one.

The relationship between effort and pace inverts as well. In general training you ran the right effort and checked the pace afterwards. Here you run the right pace and check the effort afterwards, because the pace is the thing being trained and the effort is the feedback. Both directions feed the same loop: what the workout felt like at the prescribed pace updates your fitness estimate for the next one.

Because the pace is now the prescription, conditions matter more than they did. Look at the forecast and the terrain, and schedule your biggest sessions into the most favorable conditions you can find. A 95 percent marathon pace workout into a headwind on rolling hills is a different workout than the one that was written.

The weekly shape changes too. Intensity concentrates into a few key sessions rather than being spread across the week, and those sessions are big enough to need two to four genuinely easy days after them. Do not be alarmed by how slow easy pace feels in the days following a long fast run. That is the cost of the session, and paying it is how you absorb it. Weekly mileage stops climbing and redistributes instead, often into short blocks of higher volume rather than one uniformly heavy week.

Progress in this phase shows up at the end of workouts, not in the average pace. The goal is the same pace for longer: 17 miles at 90 percent instead of 15, or four by two kilometers at 110 percent instead of eight by one kilometer. If your fitness estimate is converging on a stable number and your sessions are landing consistently, the phase is working. Consistency is the signal. When a session's paces and its structure conflict, follow the structure rather than chasing percentage-perfect splits.

One tradeoff is worth naming plainly. Supportive training leans out over the base general training built, and the further past that base you venture, the less support there is underneath you. Push too far and fitness does not plateau, it collapses. This is also where long easy runs retire: once you can run long and fast, the useful recovery run is short and easy, not long and slow.`;

const SPECIFIC = `Everything in this phase points at one thing: running long and fast at marathon pace. The key workouts converge on 95 to 105 percent of marathon pace, and the range narrows as the race gets closer.

Seen from here, the whole cycle makes sense as a funnel. General built the capabilities. Supportive assembled running long and running fast into a single ability. Specific converges that ability on one pace. The marathon itself, 26.2 miles at 100 percent of marathon pace, is the last and longest workout in that sequence rather than a drastic departure from it. If race day feels like a different category of effort than these sessions, something in the estimate is off.

Weekly mileage matters less now, and that is not a concession. The volume existed to support these workouts, so if a number on the weekly total competes with arriving fresh to a key session, the number loses. Go into the big workouts rested, recover properly afterwards, and treat occasional maintenance days that look like easy days from peak week as a way to hold fitness at lower cost. Non-workout days should be extremely easy. The gains in this phase come from absorbing the specific work, not from adding to it.

Inside the workouts, pace is the focus and effort is only there to inform small adjustments to your fitness estimate. Progress looks like resilience rather than speed: your average paces may not move at all, and running further at the same pace is the improvement. It is worth exploring the 98 to 102 percent band deliberately so you learn where the boundary sits between fast and controlled and too fast to sustain, because that boundary is what the race plan gets built on.

By the end of this phase, 100 percent of marathon pace is your goal marathon pace and the basis of your pacing plan. The honesty of these sessions is the mechanism that makes that trustworthy. You cannot fake alternating kilometers at 100 percent, and an optimistic estimate gets exposed in a workout weeks out rather than at mile 18 on race day. Getting found out early is the feature, not the failure.

No racing in this phase. These are the most important sessions of the whole cycle and a race displaces one of them. A shorter race would also be lackluster right now, and not because anything is wrong: specialization for the marathon trades away some 5K, 10K and half marathon sharpness, and that trade is exactly what you have been making on purpose.

Fueling should be fully dialed by the end of this phase. Rate, brand, flavor, caffeine, all of it practiced in the long specific sessions and taken without breaking stride. Rehearse the pre-race dinner and the race morning breakfast too, on a day where getting it wrong costs you a workout instead of a race.

The taper is short and modest. Back off a bit over the final two weeks and change nothing dramatically. There is no race-day magic to unlock and nothing left to gain by overhauling the approach at the end. Show up ready to run the way you have shown up ready for every other specific session.

Stay flexible with the calendar. Swapping days, adding an easy day, or dropping a midweek workout to arrive fresh for a key session are all good decisions, not compromises. The key sessions are the phase. Everything else serves them.`;

export const DEFAULT_PHASE_EXPLAINERS: Record<DefaultPhaseKey, string> = {
  general: GENERAL,
  supportive: SUPPORTIVE,
  specific: SPECIFIC,
};

// phase_type is free text a coach types (see
// 20260826070000_private_coaching_day_vocabulary.sql's reasoning, which
// applies to phase keys the same way), so matching is normalized and
// tolerant: "General", "general", "General Phase" and "Phase: General" all
// resolve to the general default, and anything unrecognized resolves to
// nothing rather than being forced into the nearest match.
function normalizePhaseKey(phaseType: string): DefaultPhaseKey | null {
  const value = phaseType.toLowerCase();
  if (value.includes("general")) return "general";
  if (value.includes("supportive")) return "supportive";
  if (value.includes("specific")) return "specific";
  return null;
}

export function defaultPhaseExplainer(phaseType: string | null): string | null {
  if (!phaseType) return null;
  const key = normalizePhaseKey(phaseType);
  return key ? DEFAULT_PHASE_EXPLAINERS[key] : null;
}

// A stored explainer always wins, including over a newer default: it's the
// athlete's own copy, written when their training was assigned, and the
// whole point of copying it at assignment time is that it doesn't change
// underneath them. The default only fills the gap where nobody ever
// authored one.
export function resolvePhaseExplainer(stored: string | null, phaseType: string | null): string | null {
  const trimmed = stored?.trim();
  if (trimmed) return trimmed;
  return defaultPhaseExplainer(phaseType);
}

// Blank-line-separated prose into real paragraphs. Single newlines inside
// a paragraph are treated as soft wrapping, not a break, so text pasted
// from an editor that hard-wraps doesn't render as one paragraph per line.
export function explainerParagraphs(explainer: string): string[] {
  return explainer
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0);
}

// ---------------------------------------------------------------------------
// Part C: the final two weeks, and "plans adapt"
// ---------------------------------------------------------------------------
//
// Both strings below are athlete-facing and follow Prompt 10's gating:
// they render only for a coached athlete looking at their own training, or
// for that athlete's coach. Original copy, same as everything above.

// Deliberately the SHAPE of the lead-in and not the prescription. An
// athlete reading this two months out should come away knowing what the
// last fortnight looks like and stop worrying about it; they should not
// come away with session details they might then hold their coach to, or
// start comparing against what they were actually given. Every specific
// number that does appear is a duration or a count of days, never a pace
// or a distance.
//
// Hedged on purpose, twice: this describes the usual shape, and the note
// says plainly that their own coach may do it differently. The standard
// two-week lead-in is a template a coach edits per athlete (see
// race-lead-in.ts), so stating it as a promise would be a claim this
// module cannot keep.
const TAPER_PREVIEW = `The last two weeks usually run to the same shape, and knowing it in advance takes most of the mystery out of race week.

About two weeks out comes one more full-size session at marathon pace. It is the last real piece of training in the cycle and the final rehearsal of pace, fueling and gear together. Then several genuinely easy days, which is the part that tends to feel wrong: you will be tapering, you will feel sluggish, and nothing is going backwards.

Somewhere in the second week there is one short tune-up slightly faster than marathon pace, at much lower volume than the same session would have carried mid-buildup. It is there to keep the legs sharp, not to add fitness. After that, short easy runs, some strides, and usually one light session that ends well before it gets difficult.

Two things are worth expecting. Easy pace may feel laborious for a few days after the last big session, and faster paces may feel harder than the number suggests, because marathon-specialized fitness makes anything far from marathon pace feel unfamiliar. Neither is a sign of a problem.

Your coach may shape this differently for you, and race week in particular often shifts around travel and the race's own day of the week. The constant is the intent: arrive rested, having rehearsed everything, with nothing new attempted.`;

/**
 * The taper preview, for the specific phase only.
 *
 * Returned separately from the phase explainer rather than appended to it,
 * for two reasons. A coach can replace the specific-phase explainer
 * entirely with their own, and that must not silently delete this; and the
 * athlete's stored explainer is a copy frozen at assignment time, so
 * folding this into it would mean athletes assigned before this shipped
 * never see it.
 */
export function taperPreview(phaseType: string | null): string | null {
  if (!phaseType) return null;
  return normalizePhaseKey(phaseType) === "specific" ? TAPER_PREVIEW : null;
}

/**
 * Part C item 6. The athlete-safe half of "don't get attached to the plan":
 * moved workouts are normal and intended, and the measure is race day
 * rather than a completion streak.
 *
 * Stops short of the coach-facing version of this idea, which includes how
 * much of a plan typically goes uncompleted. That framing is useful to a
 * coach deciding whether to retool and unhelpful to an athlete deciding
 * whether to run today.
 */
export const PLANS_ADAPT_NOTE =
  "Your coach may move workouts as training unfolds. The goal is race day, not checking every box.";
