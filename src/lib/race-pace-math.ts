// Core math behind the race pace <-> finish time converter -- adapted from
// John Davis's race-pace calculator (github.com/johnjdavisiv/race-pace,
// MIT licensed). Unlike the other pace tools in this project, there's no
// model or percentage convention underneath this one: it's plain
// distance = speed * time algebra, expressed as two one-line functions.

export function speedMSFromDistanceAndTime(distanceMeters: number, timeSeconds: number): number {
  return distanceMeters / timeSeconds;
}

export function timeSecondsFromDistanceAndSpeed(distanceMeters: number, speedMS: number): number {
  return distanceMeters / speedMS;
}

// For a custom race or split distance entered in a unit other than meters.
// Kept separate from pace-percent-math.ts's PaceUnit (mi/km/400m/200m,
// used for pace *display*) since yards is only ever relevant here, for a
// literal one-off custom distance -- nobody paces in yards, but plenty of
// older tracks and courses were measured in them.
export type CustomDistanceUnit = "m" | "yd" | "km" | "mi";

export const CUSTOM_DISTANCE_UNIT_METERS: Record<CustomDistanceUnit, number> = {
  m: 1,
  yd: 0.9144,
  km: 1000,
  mi: 1609.344,
};

export function customDistanceToMeters(value: number, unit: CustomDistanceUnit): number {
  return value * CUSTOM_DISTANCE_UNIT_METERS[unit];
}
