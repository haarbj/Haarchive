// Deliberately qualitative race-day conditions guidance -- notes and
// recommendations, not a precise time correction. The site already has two
// tools that DO model heat/humidity/wind/altitude precisely (the
// Environmental Performance Calculator's heat/humidity/wind/elevation
// engines, and the Heat Tracker's ACSM-aligned WBGT flag zones); this
// module intentionally doesn't reimplement either of those in miniature.
// It answers a narrower question ("should this change how I open the
// race, or flag something to plan around") rather than "what's my
// equivalent time," and says so in its own copy rather than silently
// producing a second, less rigorous version of a number those tools
// already compute precisely.

const HEAT_FLAG_TEMP_F = 60; // above this, the conservative-opening recommendation kicks in
const HIGH_HEAT_TEMP_F = 70; // above this, humidity's amplifying effect is called out specifically
const HIGH_HUMIDITY_PCT = 60;
const ALTITUDE_FLAG_DIFF_FT = 1500;
const EFFORT_BASED_OPENING_MILES = "the first 5-8 miles";

export type ConditionsInput = {
  tempF: number;
  humidityPct: number;
  windMph: number;
  /** Race-day altitude minus the altitude the runner actually trains at, in feet. Can be negative (racing lower than training). */
  altitudeDiffFt: number;
};

export type ConditionsFlag = {
  tone: "heat" | "humidity" | "wind" | "altitude";
  note: string;
};

export function evaluateConditions(input: ConditionsInput): ConditionsFlag[] {
  const flags: ConditionsFlag[] = [];

  if (input.tempF > HEAT_FLAG_TEMP_F) {
    const humidityNote =
      input.humidityPct > HIGH_HUMIDITY_PCT && input.tempF > HIGH_HEAT_TEMP_F
        ? " High humidity on top of that heat amplifies the effect well beyond what either one would do alone -- sweat evaporation, your main cooling mechanism, stops working as well."
        : "";
    flags.push({
      tone: "heat",
      note: `${input.tempF}°F is warm enough to measurably impair marathon performance. Run a conservative progressive start, by feel rather than the watch, for ${EFFORT_BASED_OPENING_MILES} -- then reassess.${humidityNote}`,
    });
  } else if (input.humidityPct > HIGH_HUMIDITY_PCT) {
    flags.push({
      tone: "humidity",
      note: `${input.humidityPct}% humidity alone, at this temperature, is a smaller factor -- but keep an eye on how you're cooling and back off early if it feels harder than the pace suggests it should.`,
    });
  }

  if (input.windMph >= 15) {
    flags.push({
      tone: "wind",
      note: `${Math.round(input.windMph)}mph wind is strong enough to notice, especially on an exposed or out-and-back course -- expect headwind stretches to cost real effort and tailwind stretches to feel like a gift you shouldn't bank on holding.`,
    });
  } else if (input.windMph >= 8) {
    flags.push({
      tone: "wind",
      note: `A light-to-moderate ${Math.round(input.windMph)}mph breeze -- a minor factor most of the race, worth tucking in behind other runners on any exposed section.`,
    });
  }

  if (Math.abs(input.altitudeDiffFt) > ALTITUDE_FLAG_DIFF_FT) {
    flags.push({
      tone: "altitude",
      note:
        input.altitudeDiffFt > 0
          ? `Racing ${Math.round(input.altitudeDiffFt).toLocaleString()}ft higher than you train is enough to meaningfully reduce available aerobic capacity -- expect your goal effort to feel harder than it does at home, especially early.`
          : `Racing ${Math.round(Math.abs(input.altitudeDiffFt)).toLocaleString()}ft lower than you train is a real advantage -- don't be surprised if your goal effort feels easier than expected, especially early.`,
    });
  }

  return flags;
}
