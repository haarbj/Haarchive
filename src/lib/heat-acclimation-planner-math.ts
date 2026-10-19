// A day-by-day heat-acclimation protocol leading up to a race, built from
// this site's own already-published heat-acclimation guidance rather than
// a second, independently-chosen set of numbers: heat-tracker.tsx's own
// "Heat acclimation" explanatory copy and the "Heat Acclimatization"
// subsection of the Workout Library (sections.ts) both already state the
// same core facts -- roughly 60-90 min/day of heat exposure, meaningful
// adaptation in as few as 4 consecutive days, full/complete adaptation in
// about 2 weeks, and a legitimate (but supplementary, not substitute)
// passive-heat option via sauna or a hot bath. Neither existing page states
// an explicit race-week TAPER rule (how many days to pull back heat
// exposure before race day) or a day-by-day progression schedule -- those
// two pieces are this module's own addition, taken from the general
// Armstrong/ACSM-style consensus the product brief names (taper 2-3 days
// out; adaptation persists for roughly two weeks after the last exposure,
// per the site's own decay language, so a short taper doesn't cost the
// adaptation itself).
//
// Nothing here claims more precision than the source guidance supports --
// see the tool's own "Where this comes from" copy for the same honesty
// the site's existing heat content already models.

import { addDays, diffDays } from "@/lib/coaching-engine/date-utils";
import { todayDateString } from "@/lib/weather-wind";

export type HeatTrainingStatus = "none" | "some" | "already";

// Where a runner starts matters: someone already training in heat
// regularly only needs a short maintenance block (the site's own "Heat
// acclimation" copy: "maintaining long-term just takes heat exposure at
// least twice a week"), while someone starting from nothing needs the
// full build described above. Minutes are each status's own starting
// session length; days are how long a protocol starting from that status
// actually needs before race-week taper.
const STATUS_STARTING_MINUTES: Record<HeatTrainingStatus, number> = { none: 20, some: 30, already: 60 };
const STATUS_PROTOCOL_DAYS: Record<HeatTrainingStatus, number> = { none: 14, some: 10, already: 7 };

export const TARGET_SESSION_MAX_MINUTES = 90; // site-stated ceiling -- "60-90 minutes a day"

// Race-week pullback: this module's own addition (see header) -- the
// consensus is that adaptation itself persists for roughly the two weeks
// after the last real exposure the site's own decay guidance already
// describes, so a short taper trades a little topping-up for arriving
// recovered, not acclimation itself.
export const TAPER_DAYS = 2;

export type HeatSessionDay = {
  date: string;
  dayLabel: string;
  kind: "heat-session" | "taper" | "race-day";
  /** Minutes of deliberate heat exposure -- 0 for a taper or race day. */
  durationMinutes: number;
  effortNote: string;
  hydrationNote: string;
};

export type HeatAcclimationPlan = {
  raceDate: string;
  daysUntilRace: number;
  status: HeatTrainingStatus;
  /** How many heat-exposure days this status's protocol actually needs before taper -- the full, uncompressed figure. */
  neededProtocolDays: number;
  /** True when there wasn't enough runway to fit neededProtocolDays + TAPER_DAYS before the race, so the protocol below is squeezed into whatever's left. */
  isCompressed: boolean;
  /** Set when there's more runway than the protocol needs -- the date the protocol should actually start; everything before it is "keep training normally." Null when the protocol starts today (no gap, or compressed). */
  maintainUntilDate: string | null;
  /** One entry per day from the protocol's actual start date through race day, inclusive. */
  days: HeatSessionDay[];
};

const EFFORT_NOTE = "Easy / conversational effort only -- the heat itself is the training stimulus, not pace. Don't chase a pace number in these sessions.";
const HYDRATION_NOTE = "Drink to thirst, not on a fixed schedule -- forcing fluids beyond thirst doesn't help and can be its own risk. Add electrolytes on your longer or sweatier sessions.";
const TAPER_HYDRATION_NOTE = "Keep hydrating normally, but this is a rest day from deliberate heat exposure -- the adaptation you've built holds for about two weeks without upkeep, so a short pullback here doesn't cost it.";

function sessionDurationForDay(dayIndex: number, buildDays: number, startMinutes: number, targetMinutes: number): number {
  if (dayIndex >= buildDays) return targetMinutes;
  const progress = buildDays > 0 ? dayIndex / buildDays : 1;
  return Math.round(startMinutes + (targetMinutes - startMinutes) * progress);
}

export function buildHeatAcclimationPlan(
  raceDate: string,
  status: HeatTrainingStatus,
  availableMinutesPerDay: number,
  today: string = todayDateString(),
): HeatAcclimationPlan {
  const daysUntilRace = diffDays(today, raceDate);
  const neededProtocolDays = STATUS_PROTOCOL_DAYS[status];
  const startMinutes = Math.min(STATUS_STARTING_MINUTES[status], availableMinutesPerDay);
  // The site's own "60-90 minutes a day" band, capped by however much time
  // is actually available -- never forces 60 if there genuinely isn't time
  // for it.
  const targetMinutes = Math.min(TARGET_SESSION_MAX_MINUTES, availableMinutesPerDay);

  const neededRunway = neededProtocolDays + TAPER_DAYS;
  const isCompressed = daysUntilRace < neededRunway;

  // Uncompressed: the protocol starts exactly early enough to finish its
  // taper right before race day, with "keep training normally" for
  // whatever's left before that. Compressed: there's no room for that, so
  // every available day goes to heat exposure first, with only a small
  // taper (at most half of the days available, capped at TAPER_DAYS)
  // carved out of what's left -- never so much taper that there's no
  // protocol left to run. Zero or negative days (race is today or has
  // already passed) gets neither.
  let protocolDaysToUse: number;
  let taperDaysToUse: number;
  if (daysUntilRace <= 0) {
    protocolDaysToUse = 0;
    taperDaysToUse = 0;
  } else if (isCompressed) {
    taperDaysToUse = Math.min(TAPER_DAYS, Math.floor(daysUntilRace / 2));
    protocolDaysToUse = daysUntilRace - taperDaysToUse;
  } else {
    protocolDaysToUse = neededProtocolDays;
    taperDaysToUse = TAPER_DAYS;
  }

  const protocolStartDate = isCompressed ? today : addDays(raceDate, -(neededProtocolDays + TAPER_DAYS));
  const maintainUntilDate = !isCompressed && protocolStartDate > today ? protocolStartDate : null;

  const buildDays = Math.max(1, Math.min(7, Math.ceil(protocolDaysToUse / 2)));

  const days: HeatSessionDay[] = [];
  let cursor = protocolStartDate;

  for (let i = 0; i < protocolDaysToUse; i++) {
    const durationMinutes = sessionDurationForDay(i, buildDays, startMinutes, targetMinutes);
    days.push({
      date: cursor,
      dayLabel: cursor === today ? "Today" : weekdayAndDate(cursor),
      kind: "heat-session",
      durationMinutes,
      effortNote: EFFORT_NOTE,
      hydrationNote: HYDRATION_NOTE,
    });
    cursor = addDays(cursor, 1);
  }

  for (let i = 0; i < taperDaysToUse; i++) {
    days.push({
      date: cursor,
      dayLabel: cursor === today ? "Today" : weekdayAndDate(cursor),
      kind: "taper",
      durationMinutes: 0,
      effortNote: "Normal easy training is fine -- just no deliberate heat sessions.",
      hydrationNote: TAPER_HYDRATION_NOTE,
    });
    cursor = addDays(cursor, 1);
  }

  days.push({
    date: raceDate,
    dayLabel: "Race day",
    kind: "race-day",
    durationMinutes: 0,
    effortNote: "Race effort, not training effort -- the protocol's job was to get you here.",
    hydrationNote: "Your own race hydration plan, rehearsed in training -- not a new strategy for today.",
  });

  return { raceDate, daysUntilRace, status, neededProtocolDays, isCompressed, maintainUntilDate, days };
}

function weekdayAndDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const monthDay = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${weekday} ${monthDay}`;
}
