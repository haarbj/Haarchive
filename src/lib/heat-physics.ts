// Wet-bulb globe temperature estimate and marathon-performance-calibrated
// heat/cold guidance -- pure, presentation-free calculations extracted out
// of heat-tracker.tsx the same way wind-physics.ts was pulled out of the
// original wind calculator, so a future combined environmental-conditions
// tool (heat + wind together) can reuse the actual physics without
// heat-tracker's chart/gauge rendering code along for the ride. Tailwind
// styling per zone stays local to heat-tracker.tsx -- that's presentation,
// not physics.
//
// Zone boundaries are calibrated to how ambient conditions actually affect
// marathon-distance performance (cold still trainable through with the
// right gear below ~35°F, an ideal 35-55°F band, heat starting to cost real
// time above 60°F and compounding further once humidity and direct sun are
// added), not to a flat WBGT-formula split. The WBGT estimate itself is
// still the number these bounds are applied to, since it's what actually
// folds humidity's amplifying effect into one value -- a muggy 65°F reads
// hotter here than a dry 65°F would, which is the correct physiological
// read, not a bug in the calibration.

export type HeatZoneName = "cold" | "green" | "yellow" | "red" | "black";

export type HeatZone = {
  name: HeatZoneName;
  maxC: number;
  flagLabel: string;
};

function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}

// Boundaries in °F, converted once below so the guidance copy and the
// zone table can't drift apart: cold below 35, the 35-55 ideal band,
// heat starting to cost real time above 60, humidity's amplifying effect
// becoming especially pronounced above 70, and conditions serious enough
// to move training indoors above 80.
const COLD_MAX_F = 35;
const IDEAL_MAX_F = 55;
export const HEAT_IMPAIR_START_F = 60;
export const HEAT_HUMIDITY_AMPLIFY_F = 70;
const HIGH_MAX_F = 80;

export const HEAT_ZONES: HeatZone[] = [
  { name: "cold", maxC: fToC(COLD_MAX_F), flagLabel: "Cold" },
  { name: "green", maxC: fToC(IDEAL_MAX_F), flagLabel: "Green flag" },
  { name: "yellow", maxC: fToC(HIGH_MAX_F - 10), flagLabel: "Yellow flag" },
  { name: "red", maxC: fToC(HIGH_MAX_F), flagLabel: "Red flag" },
  { name: "black", maxC: Infinity, flagLabel: "Black flag" },
];

// Australian Bureau of Meteorology outdoor WBGT approximation. Folds
// evaporative cooling (humidity) and a calibrated radiant-heat term into a
// single estimate, without needing a physical black-globe sensor.
export function estimateWBGT(tempC: number, rh: number): number {
  const vaporPressure = (rh / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  return 0.567 * tempC + 0.393 * vaporPressure + 3.94;
}

export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

export function heatZoneFor(wbgtC: number): HeatZone {
  return HEAT_ZONES.find((zone) => wbgtC < zone.maxC) ?? HEAT_ZONES[HEAT_ZONES.length - 1];
}

export type HeatGuidance = {
  title: string;
  sub: string;
  // Only populated once heat is actually costing meaningful time (yellow
  // zone above the 60°F threshold and up) -- the conservative, effort-not-
  // pace race-day note, kept as its own field so the component can render
  // it as a distinct callout rather than burying it in `sub`.
  raceTip?: string;
};

// Training/racing guidance calibrated to marathon-performance research,
// not a flat per-flag-color script: the heat zones below 60°F worth of
// WBGT read as fine-to-ideal, heat starts to matter above that, and
// humidity's effect compounds further once WBGT crosses the 70°F-
// equivalent mark. `acclimatedToHeat` (2+ weeks of training in heat)
// measurably blunts the heat-zone guidance, per the acclimation protocol
// in heat-tracker.tsx's own explanatory copy -- it does not change the
// cold-zone or ideal-zone guidance, since acclimation is a heat adaptation.
export function heatGuidance(
  wbgtC: number,
  zoneName: HeatZoneName,
  acclimatedToHeat = false,
): HeatGuidance {
  const wbgtF = cToF(wbgtC);

  if (zoneName === "cold") {
    return {
      title: "Cold, but gear covers most of it",
      sub: "Below about 35°F, cold starts to work against you, but it's the one condition proper gear largely neutralizes: a hat, gloves, and arm warmers cover most of the difference. Train and race as planned.",
    };
  }

  if (zoneName === "green") {
    return {
      title: "Ideal marathon conditions",
      sub: "This is the 35-55°F band where marathon performance is least compromised by temperature. Full go-ahead: intervals, tempo, long runs, whatever's on the plan.",
    };
  }

  if (zoneName === "yellow") {
    if (wbgtF < HEAT_IMPAIR_START_F) {
      return {
        title: "Upper edge of ideal",
        sub: "Still comfortable and not yet a limiter -- intervals and tempo can go as planned. This is the top of the 35-55°F band's margin before heat starts costing real time above 60°F.",
      };
    }
    const acclimationNote = acclimatedToHeat
      ? " You've been training in it for 2+ weeks, so expect a smaller hit than this would otherwise cost an unacclimated runner."
      : " Without recent heat training, expect this to cost more than it would once you're acclimated -- see the acclimation guidance below.";
    return {
      title: "Heat starting to cost time",
      sub: `Above 60°F, heat begins measurably slowing marathon-effort running, and faster runners feel it more than slower ones. Ease off pace targets on intervals and tempo, keep easy mileage easy, and drink to thirst rather than on a fixed schedule.${acclimationNote}`,
      raceTip:
        "Racing in this? If it's hotter than you trained for, start conservative: run the first 5-8 miles by effort rather than goal pace, and let the pace settle in once you have a real read on how the heat feels that day.",
    };
  }

  if (zoneName === "red") {
    const acclimationNote = acclimatedToHeat
      ? " Heat acclimation blunts this, but 70°F-plus WBGT is still a real limiter even for an adapted runner."
      : " Without heat acclimation, this is a significant limiter -- see the acclimation guidance below before a key session or race in conditions like this.";
    return {
      title: "High heat risk",
      sub: `Humidity's amplifying effect is strongest once WBGT crosses the 70°F mark, and direct sun adds further load on top of it. Move intervals or tempo work to shade, a treadmill, or a cooler window of the day. Hydrate to thirst, not on a fixed schedule or to fully replace sweat losses.${acclimationNote}`,
      raceTip:
        "Racing in this? Start conservative: run the first 5-8 miles by effort rather than goal pace, and treat any pace before that as provisional until you know how the heat is actually landing.",
    };
  }

  return {
    title: "Extreme risk: black flag",
    sub: "Move training indoors or postpone. Even a well-acclimated runner is working against a real heat-illness risk outdoors at this level, and acclimation doesn't move that ceiling much.",
    raceTip:
      "If you're racing and conditions are this hot, the conservative-start principle still applies, but at this level the priority is finishing safely, not hitting a pace.",
  };
}
