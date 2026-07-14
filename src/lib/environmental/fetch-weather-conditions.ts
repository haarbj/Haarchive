// Full weather conditions (temperature, humidity, dew point, cloud cover,
// pressure, wind) from Open-Meteo for the Environmental Performance
// Calculator's automatic mode -- one combined call rather than reusing
// weather-wind.ts's wind-only fetch plus a separate temperature fetch, so
// every field describes the exact same hour instead of two independently-
// matched "closest hour" lookups that could disagree.
//
// Shares weather-wind.ts's naiveMinutes/todayDateString helpers: the same
// deliberately-timezone-naive matching applies here for the same reason --
// a race's local start time should be matched as a wall-clock reading in
// the race's own timezone, never reinterpreted through the browser's.

import { naiveMinutes, todayDateString } from "@/lib/weather-wind";

export type WeatherConditions = {
  tempC: number;
  relativeHumidityPct: number;
  dewPointC: number;
  cloudCoverPct: number;
  pressureHPa: number;
  windSpeedMS: number;
  // Meteorological convention: the compass direction the wind is blowing FROM.
  windFromBearingDeg: number;
  windGustsMS: number;
};

const CONDITION_PARAMS =
  "temperature_2m,relative_humidity_2m,dew_point_2m,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m";

type ConditionFields = {
  temperature_2m: number;
  relative_humidity_2m: number;
  dew_point_2m: number;
  cloud_cover: number;
  surface_pressure: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  wind_gusts_10m: number;
};

function toWeatherConditions(fields: ConditionFields): WeatherConditions {
  return {
    tempC: fields.temperature_2m,
    relativeHumidityPct: fields.relative_humidity_2m,
    dewPointC: fields.dew_point_2m,
    cloudCoverPct: fields.cloud_cover,
    pressureHPa: fields.surface_pressure,
    windSpeedMS: fields.wind_speed_10m,
    windFromBearingDeg: fields.wind_direction_10m,
    windGustsMS: fields.wind_gusts_10m,
  };
}

type CurrentConditionsResponse = {
  current: ConditionFields;
};

/**
 * The UTC offset (seconds) Open-Meteo resolves for a location via
 * `timezone=auto` -- used to convert a route file's genuine UTC start
 * time into the naive local wall-clock reading fetchConditionsAtTime
 * expects, without adding a whole separate timezone-lookup dependency.
 * Returns null on any failure so callers can fall back gracefully.
 */
export async function fetchUtcOffsetSeconds(lat: number, lon: number): Promise<number | null> {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`);
    if (!res.ok) return null;
    const data: { utc_offset_seconds?: number } = await res.json();
    return typeof data.utc_offset_seconds === "number" ? data.utc_offset_seconds : null;
  } catch {
    return null;
  }
}

export async function fetchCurrentConditions(lat: number, lon: number): Promise<WeatherConditions> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=${CONDITION_PARAMS}&wind_speed_unit=ms&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather lookup failed.");
  const data: CurrentConditionsResponse = await res.json();
  return toWeatherConditions(data.current);
}

type HourlyConditionsResponse = {
  hourly?: { time: string[] } & { [K in keyof ConditionFields]: number[] };
  reason?: string;
};

/**
 * Weather at a specific date and time -- past or future -- matching
 * fetchWindAtTime's semantics exactly: `localDateTime` is a naive
 * "YYYY-MM-DDTHH:mm" wall-clock reading in the queried location's own
 * timezone, and dates far enough in the past use the historical archive
 * API while anything else uses the standard forecast API.
 */
export async function fetchConditionsAtTime(lat: number, lon: number, localDateTime: string): Promise<WeatherConditions> {
  const [datePart] = localDateTime.split("T");
  const isPast = datePart < todayDateString();
  const params = `latitude=${lat}&longitude=${lon}&hourly=${CONDITION_PARAMS}&wind_speed_unit=ms&timezone=auto&start_date=${datePart}&end_date=${datePart}`;
  const url = isPast
    ? `https://archive-api.open-meteo.com/v1/archive?${params}`
    : `https://api.open-meteo.com/v1/forecast?${params}`;

  const res = await fetch(url);
  const data: HourlyConditionsResponse = await res.json();
  if (!res.ok || !data.hourly) {
    throw new Error(data.reason ?? "Weather lookup failed for that date.");
  }

  const { time } = data.hourly;
  if (time.length === 0) throw new Error("No weather data available for that date.");

  const targetMinutes = naiveMinutes(localDateTime);
  let bestIndex = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < time.length; i++) {
    const diff = Math.abs(naiveMinutes(time[i]) - targetMinutes);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }

  return toWeatherConditions({
    temperature_2m: data.hourly.temperature_2m[bestIndex],
    relative_humidity_2m: data.hourly.relative_humidity_2m[bestIndex],
    dew_point_2m: data.hourly.dew_point_2m[bestIndex],
    cloud_cover: data.hourly.cloud_cover[bestIndex],
    surface_pressure: data.hourly.surface_pressure[bestIndex],
    wind_speed_10m: data.hourly.wind_speed_10m[bestIndex],
    wind_direction_10m: data.hourly.wind_direction_10m[bestIndex],
    wind_gusts_10m: data.hourly.wind_gusts_10m[bestIndex],
  });
}
