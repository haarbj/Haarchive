// Wet-bulb globe temperature estimate and ACSM-aligned flag-zone guidance
// -- pure, presentation-free calculations extracted out of
// heat-tracker.tsx the same way wind-physics.ts was pulled out of the
// original wind calculator, so a future combined environmental-conditions
// tool (heat + wind together) can reuse the actual physics without
// heat-tracker's chart/gauge rendering code along for the ride. Tailwind
// styling per zone stays local to heat-tracker.tsx -- that's presentation,
// not physics.

export type HeatZoneName = "green" | "yellow" | "red" | "black";

export type HeatZone = {
  name: HeatZoneName;
  maxC: number;
  flagLabel: string;
};

export const HEAT_ZONES: HeatZone[] = [
  { name: "green", maxC: 18, flagLabel: "Green flag" },
  { name: "yellow", maxC: 23, flagLabel: "Yellow flag" },
  { name: "red", maxC: 28, flagLabel: "Red flag" },
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

// Training guidance within the green flag band, per ACSM-aligned tiers.
export function heatGuidance(wbgtC: number, zoneName: HeatZoneName): { title: string; sub: string } {
  if (zoneName === "green") {
    if (wbgtC < 10) {
      return {
        title: "Ideal training conditions",
        sub: "Full go-ahead — intervals, tempo, long runs, whatever's on the plan.",
      };
    }
    if (wbgtC < 15) {
      return {
        title: "Optimal for hard efforts",
        sub: "Good day for intervals or tempo — heat won't be a limiter.",
      };
    }
    return {
      title: "Low risk",
      sub: "Hydrate well before and after — carry water mid-run only if that's already part of your routine. Intervals and tempo can go as planned.",
    };
  }
  if (zoneName === "yellow") {
    return {
      title: "Moderate risk",
      sub: "Easy mileage is fine. Ease off pace targets on intervals or tempo work and add recovery.",
    };
  }
  if (zoneName === "red") {
    return {
      title: "High risk",
      sub: "Move intervals or tempo work to a treadmill or a cooler part of the day, or run easy by effort only.",
    };
  }
  return {
    title: "Extreme risk — black flag",
    sub: "Move training indoors or postpone. Heat stroke risk is too high for outdoor work at this level.",
  };
}
