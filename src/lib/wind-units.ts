// Wind-speed unit conversions and terrain-profile picker data shared by
// wind-calculator.tsx and track-wind-calculator.tsx.
import type { WindProfile } from "@/lib/wind-physics";

export type WindSpeedUnit = "mph" | "kmh" | "knots" | "ms";

export const WIND_SPEED_TO_MS: Record<WindSpeedUnit, number> = {
  mph: 0.44704,
  kmh: 1 / 3.6,
  knots: 0.514444,
  ms: 1,
};

export const WIND_SPEED_LABEL: Record<WindSpeedUnit, string> = {
  mph: "mph",
  kmh: "km/h",
  knots: "knots",
  ms: "m/s",
};

export const WIND_PROFILE_OPTIONS: { value: WindProfile; label: string; hint: string }[] = [
  { value: "urban", label: "City / forest", hint: "Tall buildings or dense trees block a lot of the wind." },
  { value: "suburban", label: "Suburbs", hint: "Typical mix of houses, trees, and open ground." },
  { value: "rural", label: "Rural / open", hint: "Open roads, fields, or a park with little shelter." },
  { value: "none", label: "None", hint: "Use this for a true ground-level reading, e.g. a track wind gauge." },
];
