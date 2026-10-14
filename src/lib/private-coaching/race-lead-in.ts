// Part A item 2: the standard two-week lead-in to race day.
//
// WHY THIS IS A SEEDED PROGRAM AND NOT CONSTANTS IN THIS FILE. The default
// shape below is seeded into a real, coach-owned two-week Program
// ("Standard race lead-in", framework_key 'race-lead-in', see
// scripts/seed-race-lead-in.ts), which the coach then edits in the
// ordinary Programs UI like any other template. The structure here is the
// DEFAULT used to create that template once, not the thing the apply
// action reads at run time: applyRaceLeadIn loads the coach's current
// template from the database, so an edit to it changes every future
// lead-in. Hardcoding the taper would mean a coach who disagrees with one
// session has to re-edit fourteen days on every athlete, forever.
//
// All coaching copy here is original. The structure it follows is: one
// last full-size session at marathon pace about two weeks out, several
// genuinely easy days to absorb it, one reduced-volume tune-up at
// slightly faster than marathon pace eight to eleven days out, then short
// easy running with one or two light regenerative sessions into the race.
//
// Paces are expressed as percentages of marathon pace, matching the
// frameworks' own convention, and are left as prose in the day's
// prescription for the same reason the framework seeds are (see
// framework-seed.ts): a day that states its own warm-up and cool-down
// cannot carry a single day-level pace percent without lying about the
// warm-up.

import {
  parseDifficulty,
  type FrameworkSeedPlan,
  type SeedDay,
} from "@/lib/private-coaching/framework-seed";

/** The program's single phase, and the stable key the apply action finds this template by. */
export const LEAD_IN_PHASE_KEY = "Lead-in";
export const RACE_LEAD_IN_FRAMEWORK_KEY = "race-lead-in";

/** A default lead-in day, keyed by how many days before the race it falls. */
export type RaceLeadInDay = {
  /** 13 = thirteen days before the race; 0 = race day itself. */
  daysBeforeRace: number;
  dayLabel: string;
  prescription: string;
  /** Verbatim difficulty rating, same convention as the seeded frameworks. */
  difficulty: string | null;
  isRaceDay: boolean;
};

export const RACE_LEAD_IN_LENGTH_DAYS = 14;

/**
 * The default fourteen days. Deliberately expressed as offsets from race
 * day rather than as weekdays: the lead-in is anchored to the race, and a
 * race can fall on any day of the week.
 */
export const RACE_LEAD_IN_DEFAULT: RaceLeadInDay[] = [
  {
    daysBeforeRace: 13,
    dayLabel: "Marathon pace",
    prescription:
      "1.5 mi progressive warm-up + 4 strides / 10 mi at 100% MP / 1 mi easy cool-down. The last full-size marathon-pace session of the buildup. Run it on race-specific terrain, in the shoes you will race in, with the fueling plan you intend to use, and finish feeling like you held something back.",
    difficulty: "8.5/10",
    isRaceDay: false,
  },
  {
    daysBeforeRace: 12,
    dayLabel: "Very easy",
    prescription: "6-8 mi very easy. Pace is irrelevant today. If it feels slow, it is working.",
    difficulty: null,
    isRaceDay: false,
  },
  {
    daysBeforeRace: 11,
    dayLabel: "Easy",
    prescription: "5-7 mi easy.",
    difficulty: null,
    isRaceDay: false,
  },
  {
    daysBeforeRace: 10,
    dayLabel: "Easy",
    prescription: "6-8 mi easy with 5 x 25 sec strides.",
    difficulty: null,
    isRaceDay: false,
  },
  {
    daysBeforeRace: 9,
    dayLabel: "Very easy",
    prescription: "5-7 mi very easy. Last easy day before the tune-up, so keep it genuinely easy.",
    difficulty: null,
    isRaceDay: false,
  },
  {
    daysBeforeRace: 8,
    dayLabel: "Tune-up",
    prescription:
      "1.5 mi progressive warm-up + 4 strides / 8 x (1 km at 105% MP, 1 km at 94-96% MP) / 1 mi easy cool-down. Much less volume than the same session carried mid-buildup, and the float kilometres are faster than usual on purpose. The point is to feel like you are recovering on the floats rather than hanging on, which is the clearest sign the taper is doing its job. Adjust the rep count down if difficulty climbs past 8/10.",
    difficulty: "7.5/10",
    isRaceDay: false,
  },
  {
    daysBeforeRace: 7,
    dayLabel: "Very easy",
    prescription: "5-7 mi very easy.",
    difficulty: null,
    isRaceDay: false,
  },
  {
    daysBeforeRace: 6,
    dayLabel: "Easy",
    prescription: "6-8 mi easy.",
    difficulty: null,
    isRaceDay: false,
  },
  {
    daysBeforeRace: 5,
    dayLabel: "Easy",
    prescription: "5-7 mi easy with 5 x 25 sec strides.",
    difficulty: null,
    isRaceDay: false,
  },
  {
    daysBeforeRace: 4,
    dayLabel: "Regenerative",
    prescription:
      "2 mi progressive warm-up + 4 strides / 5-6 x 3 min at 105-107% MP with 45 sec jog / 1.5 mi easy cool-down. A deliberately short, controlled session to remind the legs what fast feels like. Stop while it still feels easy. If the pace range feels harder than the number suggests, that is normal this close to a race and is not a sign anything is wrong.",
    difficulty: "6/10",
    isRaceDay: false,
  },
  {
    daysBeforeRace: 3,
    dayLabel: "Easy",
    prescription: "4-5 mi easy with 5 x 25 sec strides.",
    difficulty: null,
    isRaceDay: false,
  },
  {
    daysBeforeRace: 2,
    dayLabel: "Very easy",
    prescription: "4-5 mi very easy.",
    difficulty: null,
    isRaceDay: false,
  },
  {
    daysBeforeRace: 1,
    dayLabel: "Shakeout",
    prescription: "3-4 mi easy with 4 x 20 sec strides. Stay off your feet the rest of the day as much as you reasonably can.",
    difficulty: null,
    isRaceDay: false,
  },
  {
    daysBeforeRace: 0,
    dayLabel: "Race",
    prescription: "1.5 mi progressive warm-up + 4 strides / Marathon race.",
    difficulty: "10/10",
    isRaceDay: true,
  },
];

/**
 * The real calendar date each lead-in day falls on, for a race on
 * `raceDate` (ISO yyyy-mm-dd). Returned oldest first.
 *
 * Date arithmetic is done in UTC on purpose, the same way week.ts and
 * program-generation.ts already do it throughout this codebase: these are
 * calendar dates, not instants, and doing the subtraction in local time
 * puts a day either side of a DST boundary onto the wrong date.
 */
export function raceLeadInDates<T extends { daysBeforeRace: number }>(
  raceDate: string,
  days: T[],
): { date: string; day: T }[] {
  const race = new Date(`${raceDate}T00:00:00Z`);
  if (Number.isNaN(race.getTime())) throw new Error(`Invalid race date: ${JSON.stringify(raceDate)}`);

  return days
    .map((day) => {
      const date = new Date(race.getTime());
      date.setUTCDate(date.getUTCDate() - day.daysBeforeRace);
      return { date: date.toISOString().slice(0, 10), day };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Where a lead-in day sits in a two-week template keyed by (week, day of
 * week), so the default can be stored as ordinary program_days rows. Week
 * 1 is the first seven days of the lead-in, week 2 the second, and day of
 * week is 1..7 within that, NOT a real weekday: a race can land on any
 * day, so the template's "day 7 of week 2" simply means race day.
 */
export function leadInTemplateSlot(daysBeforeRace: number): { weekNumber: number; dayOfWeek: number } {
  if (daysBeforeRace < 0 || daysBeforeRace >= RACE_LEAD_IN_LENGTH_DAYS) {
    throw new Error(`Lead-in day out of range: ${daysBeforeRace}`);
  }
  const index = RACE_LEAD_IN_LENGTH_DAYS - 1 - daysBeforeRace; // 0 = first day
  return { weekNumber: Math.floor(index / 7) + 1, dayOfWeek: (index % 7) + 1 };
}

/**
 * The inverse of leadInTemplateSlot: how many days before the race a
 * template slot falls on. Used when applying a stored template, whose
 * rows are keyed by (week, day of week), onto real dates.
 */
export function daysBeforeRaceForSlot(weekNumber: number, dayOfWeek: number): number {
  if (weekNumber < 1 || weekNumber > RACE_LEAD_IN_LENGTH_DAYS / 7 || dayOfWeek < 1 || dayOfWeek > 7) {
    throw new Error(`Lead-in slot out of range: week ${weekNumber}, day ${dayOfWeek}`);
  }
  const index = (weekNumber - 1) * 7 + (dayOfWeek - 1);
  return RACE_LEAD_IN_LENGTH_DAYS - 1 - index;
}

/**
 * The default lead-in as a seedable Program, so it lands in the coach's own
 * library as an ordinary two-week template they can edit. Reuses
 * FrameworkSeedPlan rather than inventing a second seeding path.
 *
 * No volume variants: a two-week lead-in prescribes no weekly mileage
 * total, and inventing one would put a number on screen the template never
 * claimed. With no variants, assignment keeps deriving week totals from the
 * authored days exactly as it does for any hand-built program.
 */
export function buildRaceLeadInSeed(): FrameworkSeedPlan {
  const days: SeedDay[] = RACE_LEAD_IN_DEFAULT.map((day) => {
    const slot = leadInTemplateSlot(day.daysBeforeRace);
    const difficulty = parseDifficulty(day.difficulty);
    return {
      phaseKey: LEAD_IN_PHASE_KEY,
      weekNumber: slot.weekNumber,
      dayOfWeek: slot.dayOfWeek,
      sessionSlot: null,
      notes: day.prescription,
      isOptional: false,
      alternativeText: null,
      difficultyLabel: difficulty.label,
      plannedRpe: difficulty.rpeMin,
      plannedRpeMax: difficulty.rpeMax,
      // Race day IS the event here, which is the whole point of a lead-in:
      // it lets the template be anchored to a real race date.
      isEventDay: day.isRaceDay,
    };
  });

  return {
    program: {
      frameworkKey: RACE_LEAD_IN_FRAMEWORK_KEY,
      name: "Standard race lead-in",
      description:
        "The final two weeks into a goal marathon. One last full-size session at marathon pace about two weeks out, several genuinely easy days to absorb it, one reduced-volume tune-up slightly faster than marathon pace in the second week, then short easy running with a light regenerative session into race day.\n\nEdit this template to change the standard. Applying it to an athlete copies these days onto the fourteen days ending on their race date as editable drafts, so a per-athlete change never has to become a change to the template.",
      eventDistance: "marathon",
      sourceReference: "Haarchive coaching platform default, authored for the race-anchored planning tools.",
      typicalGoalTimes: null,
      recommendedFor: "Any athlete finishing a marathon buildup, as the last two weeks before the race.",
      initialMileageMin: null,
      initialMileageMax: null,
      peakMileageMin: null,
      peakMileageMax: null,
      glossaryTerms: null,
    },
    phases: [
      {
        phaseKey: LEAD_IN_PHASE_KEY,
        position: 1,
        durationWeeksMin: 2,
        durationWeeksMax: 2,
        notes:
          "Two weeks, anchored to race day rather than to a weekday: the template's last day is the race, whatever day of the week that falls on.",
        absoluteWeeks: [1, 2],
      },
    ],
    durationVariantName: "2-Week",
    volumeVariants: [],
    phaseWeeks: [
      {
        phaseKey: LEAD_IN_PHASE_KEY,
        weekNumber: 1,
        notes:
          "The last real training of the buildup. The marathon-pace session early in the week is the final chance to rehearse race pace, fueling and gear at full size; everything after it exists to absorb it.",
        reviseFitnessEstimate: false,
        convertFitnessEstimateToMp: false,
      },
      {
        phaseKey: LEAD_IN_PHASE_KEY,
        weekNumber: 2,
        notes:
          "Race week. Deliberately uneventful. The tune-up and the regenerative session are there to keep the legs sharp, not to add fitness, and nothing this week should feel hard.",
        reviseFitnessEstimate: false,
        convertFitnessEstimateToMp: false,
      },
    ],
    phaseWeekVolumes: [],
    days,
  };
}
