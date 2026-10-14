// Part E: the adjustment playbook. The rulebook the adaptation helper
// (plan-health.ts) hands a coach when a plan has to change.
//
// Coach-only, pure, advisory. Every function returns guidance to read, not
// an action to take: nothing here edits a plan, moves a workout, or blocks
// anything. The coach has context this module cannot see, so the playbook's
// job is to make the relevant rule easy to find and to be honest about
// when the rule does not apply.
//
// All copy original. The shape of the advice differs by phase on purpose,
// because the cost of the same missed session is genuinely different in
// general training (where load accumulates and one day is noise) than in
// the specific phase (where a handful of sessions carry the whole race).

import { targetsPaceBand, type PlanHealthWorkout } from "@/lib/private-coaching/plan-health";

export type PhaseFamily = "general" | "supportive" | "specific" | "unknown";

/**
 * Which family a coach-typed phase name belongs to. Tolerant in the same
 * way phase-explainers.ts's own matching is, and returns "unknown" rather
 * than guessing: a phase called "Sharpening" gets the generic rule, not
 * the specific-phase one.
 */
export function phaseFamily(phaseKey: string | null | undefined): PhaseFamily {
  if (!phaseKey) return "unknown";
  const value = phaseKey.toLowerCase();
  if (value.includes("general")) return "general";
  if (value.includes("supportive")) return "supportive";
  if (value.includes("specific")) return "specific";
  return "unknown";
}

export type PlaybookGuidance = {
  key: string;
  title: string;
  detail: string;
  /** Short imperatives. Options, in the order usually worth trying. */
  actions: string[];
};

// ---------------------------------------------------------------------------
// Item 11: a missed workout
// ---------------------------------------------------------------------------

/**
 * Is this the kind of general-phase session whose absence actually matters?
 *
 * The long moderate and strong runs are the exception to "a missed general
 * workout is noise": they are the progression that the rest of the phase is
 * built around, and skipping one quietly flattens the ramp. Detected from
 * what the prescription says -- a run against a percentage of 5K pace in
 * the strong/moderate band, or an explicitly big session -- never inferred
 * from distance alone.
 */
export function isGeneralPhaseKeySession(workout: PlanHealthWorkout): boolean {
  if (workout.isOptional) return false;
  // 75-92% of 5K pace is the long-moderate and strong-run territory in
  // this methodology; faster than that is interval work, which IS
  // genuinely skippable in general training.
  return targetsPaceBand(workout, "5k", 75, 92);
}

export function missedWorkoutGuidance(input: {
  phaseKey: string | null;
  workout: PlanHealthWorkout;
}): PlaybookGuidance {
  const family = phaseFamily(input.phaseKey);

  if (family === "general") {
    if (isGeneralPhaseKeySession(input.workout)) {
      return {
        key: "missed:general:key-session",
        title: "Reschedule this one rather than skipping it",
        detail:
          "A single missed general-phase workout is usually nothing, but the long moderate and strong runs are the exception. They are the progression the rest of the phase is built on, and dropping one quietly flattens the ramp that later phases lean on.",
        actions: [
          "Move it to the next available day that still leaves easy days around it.",
          "If there is no room, step the progression back: repeat the previous week's version rather than jumping to the next one.",
          "Do not make it up by adding it on top of an already-full week.",
        ],
      };
    }
    return {
      key: "missed:general:ordinary",
      title: "Safe to skip",
      detail:
        "In general training the phase works by accumulating load over weeks, so one missed session is noise. Making it up tends to cost more than the session was worth, because it eats the easy running that lets the next real workout land.",
      actions: ["Skip it and carry on with the week as written.", "Leave the weekly mileage short rather than cramming it back in."],
    };
  }

  if (family === "supportive" || family === "specific") {
    return {
      key: `missed:${family}`,
      title: "Keep the progression in order",
      detail:
        "The supportive and specific phases are a progression, not a set of interchangeable sessions: each one is sized against the one before it. The rule is never to jump ahead to catch up. Running the session that was due next week, this week, means running a session the athlete has not been prepared for.",
      actions: [
        "Pick the progression up where it left off, even if that shifts everything later by a week.",
        "To regain a week, drop a midweek session and compress three weeks of long fast work into two rather than skipping a step.",
        "If the race date cannot move, shorten from the end instead of accelerating the middle.",
      ],
    };
  }

  return {
    key: "missed:unknown",
    title: "Depends what this session was for",
    detail:
      "This phase does not map onto the general, supportive or specific pattern, so there is no standard rule to apply. The question worth asking is whether this session was a step in a progression or a repeatable piece of load.",
    actions: [
      "If it was a step in a progression, reschedule it and keep the order.",
      "If it was general load, skip it.",
    ],
  };
}

// ---------------------------------------------------------------------------
// Item 12: rearranging within the week
// ---------------------------------------------------------------------------

export function rearrangeGuidance(phaseKey: string | null): PlaybookGuidance {
  const family = phaseFamily(phaseKey);

  if (family === "supportive" || family === "specific") {
    return {
      key: `rearrange:${family}`,
      title: "Move the session and its recovery days together",
      detail:
        "By this point a key session is not a single day, it is a block: the session plus the two or three genuinely easy days that let the athlete absorb it. Sliding the session onto a new day and leaving the easy days where they were usually just relocates the problem, because the session lands with less recovery behind it or in front of the next one.",
      actions: [
        "Move the session and the easy days after it as one block.",
        "Check what now sits two days either side of its new date.",
        "If the block will not fit, moving a different, easier day is almost always the cheaper change.",
      ],
    };
  }

  return {
    key: "rearrange:general",
    title: "Reasonably free to move things around",
    detail:
      "General-phase weeks are more forgiving: the sessions are smaller relative to the athlete's capacity and the week is less dependent on precise spacing. Keep a hard day away from another hard day and the rest is flexible.",
    actions: ["Swap days freely, keeping an easy day between two workouts.", "Keep the long run where it fits the athlete's week, not where the template put it."],
  };
}

// ---------------------------------------------------------------------------
// Item 13: a race replacing a workout
// ---------------------------------------------------------------------------

export type RaceReplacementTarget = {
  /** What kind of session this race stands in for. */
  description: string;
  basis: "5k" | "marathon";
  bandMin: number;
  bandMax: number;
};

/**
 * What a race of a given distance stands in for.
 *
 * Bounds are in metres and deliberately generous at the edges, because a
 * "10K" is often 9.9 or 10.1 km on a real course and an athlete entering
 * "a 10 miler" should not fall through the gaps. Anything longer than a
 * half marathon returns null: at that point the race is not replacing a
 * session, it is an event the plan has to be rebuilt around, which is a
 * conversation and not a substitution.
 */
export function raceReplacementTarget(raceDistanceM: number): RaceReplacementTarget | null {
  if (raceDistanceM <= 0) return null;
  if (raceDistanceM < 6500) {
    return { description: "a session at 100% of 5K pace", basis: "5k", bandMin: 98, bandMax: 102 };
  }
  if (raceDistanceM < 12000) {
    return { description: "a session at 95% of 5K pace", basis: "5k", bandMin: 93, bandMax: 97 };
  }
  if (raceDistanceM <= 21500) {
    return {
      description: "a long session at 80-90% of 5K pace, or one at 105% of marathon pace",
      basis: "5k",
      bandMin: 80,
      bandMax: 90,
    };
  }
  return null;
}

export type RaceReplacementSuggestion = {
  target: RaceReplacementTarget | null;
  /** Sessions near the race date that this race could stand in for, best match first. */
  candidates: PlanHealthWorkout[];
  guidance: PlaybookGuidance;
};

/** How far either side of the race to look for the session it replaces. */
export const RACE_REPLACEMENT_WINDOW_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;
function dayGap(a: string, b: string): number {
  return Math.abs(Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY_MS));
}

export function suggestRaceReplacement(input: {
  raceDistanceM: number;
  raceDate: string;
  workouts: PlanHealthWorkout[];
}): RaceReplacementSuggestion {
  const target = raceReplacementTarget(input.raceDistanceM);

  if (!target) {
    return {
      target: null,
      candidates: [],
      guidance: {
        key: "race-replacement:too-long",
        title: "Too long to swap for a session",
        detail:
          "Past the half marathon, a race is not standing in for a workout. It needs its own taper into it and its own recovery out of it, and the surrounding weeks have to be rebuilt rather than adjusted. Treat it as a second goal race in the cycle, and decide which of the two actually matters.",
        actions: [
          "Decide which race is the real goal.",
          "If it is this one, rebuild the plan around it.",
          "If it is not, consider dropping it, or running it well inside goal marathon pace as a long run.",
        ],
      },
    };
  }

  const nearby = input.workouts
    .filter((w) => !w.isOptional && dayGap(w.scheduledDate, input.raceDate) <= RACE_REPLACEMENT_WINDOW_DAYS)
    .filter((w) => targetsPaceBand(w, target.basis, target.bandMin, target.bandMax))
    .sort((a, b) => dayGap(a.scheduledDate, input.raceDate) - dayGap(b.scheduledDate, input.raceDate));

  return {
    target,
    candidates: nearby,
    guidance: {
      key: "race-replacement:swap",
      title: `This race stands in for ${target.description}`,
      detail:
        nearby.length > 0
          ? "Replace that session rather than adding the race on top of the week. The race supplies the same stimulus and rather more of it, so running both is how a good race week turns into two bad training weeks."
          : "Nothing in the days around the race looks like the session it would replace, so check the week by hand before adding it. The race still has to come out of the week's quality rather than being added to it.",
      actions: [
        "Replace the matching session; do not keep both.",
        "Put an extra easy day in before the race.",
        "Allow more recovery after it than the session it replaced would have needed, and cut the following week's midweek quality.",
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Item 14: a workout going badly
// ---------------------------------------------------------------------------

/** Consecutive poor sessions after which the estimate, not the athlete, is the likely problem. */
export const BAD_WORKOUT_STREAK_THRESHOLD = 3;

export function badWorkoutGuidance(input: {
  phaseKey: string | null;
  workout: PlanHealthWorkout;
  /** How many sessions in a row have gone poorly, including this one. */
  consecutiveBad: number;
}): PlaybookGuidance {
  if (input.consecutiveBad >= BAD_WORKOUT_STREAK_THRESHOLD) {
    return {
      key: "bad-workout:streak",
      title: `${input.consecutiveBad} poor sessions in a row points at the estimate`,
      detail:
        "One bad session is a bad day. Three in a row is usually not: the most common cause is a fitness estimate that is a little optimistic, which makes every prescribed pace slightly too fast and turns controlled sessions into hard ones. Under-recovery and under-fuelling produce the same pattern, so neither should be ruled out before the other.",
      actions: [
        "Run an estimate review before changing the training.",
        "If the estimate holds up, look at sleep, fuelling and life load rather than adding intensity.",
        "Do not respond by pushing harder; that is the one move that makes both causes worse.",
      ],
    };
  }

  const family = phaseFamily(input.phaseKey);
  const inSpecificBand = targetsPaceBand(input.workout, "marathon", 95, 105);

  if (family === "specific" && inSpecificBand) {
    return {
      key: "bad-workout:specific",
      title: "Pull the plug rather than salvaging it",
      detail:
        "A marathon-specific session at 95 to 105% of marathon pace that is going badly is not worth finishing. Grinding it out buys a worse version of the stimulus at a much higher recovery cost, and these sessions are too important to run in a state where they teach the wrong pace.",
      actions: [
        "Stop the session, jog easy, and end the day there.",
        "Take two or three genuinely easy days.",
        "Retry a similar session in one to two weeks, not the identical one: same intent, slightly different shape, so it is not a rematch.",
      ],
    };
  }

  if (family === "general") {
    return {
      key: "bad-workout:general",
      title: "Let the pace slide and keep the effort",
      detail:
        "In general training the effort is the prescription and the pace is only a way of describing it. Heat, wind, hills, poor sleep and heavy legs all make a pace cost more than it should, and chasing the number through that turns a controlled session into a hard one for no extra benefit.",
      actions: ["Hold the intended effort and accept whatever pace comes with it.", "Finish the session as written if the effort is right.", "Note the conditions on the log so the pace is not read as a fitness signal later."],
    };
  }

  return {
    key: "bad-workout:other",
    title: "Judge it on effort, then decide",
    detail:
      "If the effort is right and only the pace is off, the session is doing its job. If the effort is wrong too, there is nothing to rescue and finishing it costs more than stopping.",
    actions: ["Cut it short if the effort has run away from the target.", "Take an easy day or two before the next quality session."],
  };
}

// ---------------------------------------------------------------------------
// Item 15: shortening and extending a plan
// ---------------------------------------------------------------------------

/** Days before the race that a shortened plan must keep intact. */
export const PROTECTED_FINAL_DAYS = { min: 8, max: 10 } as const;

export function planLengthChangeGuidance(input: {
  direction: "shorten" | "extend";
  /** Phase families in plan order, with their current week counts. */
  phases: { phaseKey: string; weeks: number }[];
  weeks: number;
}): PlaybookGuidance {
  if (input.direction === "shorten") {
    return {
      key: "plan-length:shorten",
      title: `Shorten from the end, keeping the last ${PROTECTED_FINAL_DAYS.min} to ${PROTECTED_FINAL_DAYS.max} days`,
      detail: `Take the ${input.weeks} week${input.weeks === 1 ? "" : "s"} out of the middle of the plan, not the end of it. The final ${PROTECTED_FINAL_DAYS.min} to ${PROTECTED_FINAL_DAYS.max} days before the race are the lead-in, and compressing them is the one change that reliably costs a race. Everything before that is negotiable.`,
      actions: [
        "Leave the last week and a half before the race exactly as it is.",
        "Cut whole weeks out of the earliest phase that still has room.",
        "Compress the long fast work rather than deleting it: three weeks of it into two beats losing a step.",
      ],
    };
  }

  // Extend the shortest phase first: it is the one with the least
  // internal progression to disrupt, and lengthening an already-long
  // phase pushes further past the base underneath it.
  const shortest = [...input.phases].sort((a, b) => a.weeks - b.weeks)[0] ?? null;

  return {
    key: "plan-length:extend",
    title: `Add ${input.weeks} week${input.weeks === 1 ? "" : "s"} to the shortest phase`,
    detail: shortest
      ? `${shortest.phaseKey} is currently the shortest phase at ${shortest.weeks} week${shortest.weeks === 1 ? "" : "s"}, which makes it the cheapest place to add time: it has the least internal progression to disrupt, and stretching an already-long phase ventures further past the base built underneath it. Whatever you add, the new weeks need modified workouts rather than repeats, because an identical session run twice is a test rather than a progression.`
      : "Add the time to the shortest phase: it has the least internal progression to disrupt. New weeks need modified workouts rather than repeats, because an identical session run twice is a test rather than a progression.",
    actions: [
      shortest ? `Extend ${shortest.phaseKey} first.` : "Extend the shortest phase first.",
      "Write the new weeks as variations, not copies.",
      "Keep peak mileage where it was; extra weeks are for more specific work, not more volume.",
    ],
  };
}

/**
 * Normalising copy for every adjustment surface. Stated as a plain
 * expectation rather than a target, because the point is to stop a coach
 * (and through them an athlete) reading a gap in the calendar as failure.
 *
 * Coach-facing only. Part C deliberately gives athletes the softer version
 * of this idea without the number -- a completion statistic is useful to
 * someone deciding whether to retool and unhelpful to someone deciding
 * whether to run today.
 */
export const COMPLETION_NORM_NOTE =
  "Completing around 80% of scheduled workouts is typical for a healthy buildup. Adjustments are the normal way a plan meets a real life, not a sign it is going wrong.";
