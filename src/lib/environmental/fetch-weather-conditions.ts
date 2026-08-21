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
//
// fetchConditionsAtTime returns ONE snapshot (the closest hour to a single
// instant); fetchConditionsWindow returns every hourly reading across a
// real known [start, start+duration] window and is used when an imported
// route's own real start time and duration are both known together (see
// use-environmental-weather.ts's applyRouteLocation) -- a run genuinely
// experiences a span of conditions, not one instant, and Open-Meteo's own
// hourly data already has this if it's actually asked for instead of
// discarded down to the single nearest point.

import { addSecondsToNaiveDateTime, naiveMinutes, todayDateString } from "@/lib/weather-wind";

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
  // Open-Meteo always returns the queried grid cell's own ground elevation
  // (meters) at the top level of the response, regardless of which
  // variables were requested -- a free byproduct of the same request this
  // module already makes, not a second API call. Feeds the Altitude
  // adjustment engine automatically for both "now" and "at this date/time"
  // lookups. Null only if the field is ever missing from the response.
  elevationM: number | null;
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

function toWeatherConditions(fields: ConditionFields, elevationM: number | null): WeatherConditions {
  return {
    tempC: fields.temperature_2m,
    relativeHumidityPct: fields.relative_humidity_2m,
    dewPointC: fields.dew_point_2m,
    cloudCoverPct: fields.cloud_cover,
    pressureHPa: fields.surface_pressure,
    windSpeedMS: fields.wind_speed_10m,
    windFromBearingDeg: fields.wind_direction_10m,
    windGustsMS: fields.wind_gusts_10m,
    elevationM,
  };
}

type CurrentConditionsResponse = {
  current: ConditionFields;
  elevation?: number;
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
  return toWeatherConditions(data.current, typeof data.elevation === "number" ? data.elevation : null);
}

type HourlyConditionsResponse = {
  hourly?: { time: string[] } & { [K in keyof ConditionFields]: number[] };
  elevation?: number;
  reason?: string;
};

function hourlyFieldsAt(hourly: NonNullable<HourlyConditionsResponse["hourly"]>, index: number): ConditionFields {
  return {
    temperature_2m: hourly.temperature_2m[index],
    relative_humidity_2m: hourly.relative_humidity_2m[index],
    dew_point_2m: hourly.dew_point_2m[index],
    cloud_cover: hourly.cloud_cover[index],
    surface_pressure: hourly.surface_pressure[index],
    wind_speed_10m: hourly.wind_speed_10m[index],
    wind_direction_10m: hourly.wind_direction_10m[index],
    wind_gusts_10m: hourly.wind_gusts_10m[index],
  };
}

/**
 * Shared fetch behind fetchConditionsAtTime and fetchConditionsWindow --
 * both need the same hourly-array request (archive API for past dates,
 * forecast API otherwise), differing only in which index/indices they
 * read out of the result afterward.
 */
async function fetchHourlyConditions(
  lat: number,
  lon: number,
  startDatePart: string,
  endDatePart: string,
): Promise<{ hourly: NonNullable<HourlyConditionsResponse["hourly"]>; elevationM: number | null }> {
  const isPast = startDatePart < todayDateString();
  const params = `latitude=${lat}&longitude=${lon}&hourly=${CONDITION_PARAMS}&wind_speed_unit=ms&timezone=auto&start_date=${startDatePart}&end_date=${endDatePart}`;
  const url = isPast
    ? `https://archive-api.open-meteo.com/v1/archive?${params}`
    : `https://api.open-meteo.com/v1/forecast?${params}`;

  const res = await fetch(url);
  const data: HourlyConditionsResponse = await res.json();
  if (!res.ok || !data.hourly) {
    throw new Error(data.reason ?? "Weather lookup failed for that date.");
  }
  if (data.hourly.time.length === 0) throw new Error("No weather data available for that date.");

  return { hourly: data.hourly, elevationM: typeof data.elevation === "number" ? data.elevation : null };
}

/**
 * Weather at a specific date and time -- past or future -- matching
 * fetchWindAtTime's semantics exactly: `localDateTime` is a naive
 * "YYYY-MM-DDTHH:mm" wall-clock reading in the queried location's own
 * timezone, and dates far enough in the past use the historical archive
 * API while anything else uses the standard forecast API.
 */
export async function fetchConditionsAtTime(lat: number, lon: number, localDateTime: string): Promise<WeatherConditions> {
  const [datePart] = localDateTime.split("T");
  const { hourly, elevationM } = await fetchHourlyConditions(lat, lon, datePart, datePart);

  const targetMinutes = naiveMinutes(localDateTime);
  let bestIndex = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < hourly.time.length; i++) {
    const diff = Math.abs(naiveMinutes(hourly.time[i]) - targetMinutes);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }

  return toWeatherConditions(hourlyFieldsAt(hourly, bestIndex), elevationM);
}

/**
 * Every hourly reading Open-Meteo has for the real time window a run
 * actually covers -- `startLocalDateTime` through
 * `startLocalDateTime + durationSeconds`, both ends rounded out to the
 * full hour they fall in, so a run that starts at 7:15 and finishes at
 * 8:45 includes both the 7:00 and 8:00 readings rather than missing the
 * one it started partway through. Always returns at least one entry
 * (falling back to the single nearest hour, same as fetchConditionsAtTime,
 * if the window computation somehow yields none) -- callers are
 * responsible for deciding whether more than one point means a genuine
 * range is worth showing, not this function.
 *
 * This is the ONLY source of "the run's conditions varied" data this
 * calculator uses -- it never fabricates points between real hourly
 * readings, and a route/effort with no real duration known yet should
 * call fetchConditionsAtTime instead, not this function with a guessed
 * duration.
 */
export async function fetchConditionsWindow(
  lat: number,
  lon: number,
  startLocalDateTime: string,
  durationSeconds: number,
): Promise<WeatherConditions[]> {
  const endLocalDateTime = addSecondsToNaiveDateTime(startLocalDateTime, durationSeconds);
  const [startDatePart] = startLocalDateTime.split("T");
  const [endDatePart] = endLocalDateTime.split("T");
  const { hourly, elevationM } = await fetchHourlyConditions(lat, lon, startDatePart, endDatePart);

  // Floor both ends: the hour bucket a moment falls in is the reading that
  // actually describes it, so a run from 7:15-8:45 touches the 7:00 and
  // 8:00 readings (not also 9:00, which the run never reached).
  const startMinutes = Math.floor(naiveMinutes(startLocalDateTime) / 60) * 60;
  const endMinutes = Math.floor(naiveMinutes(endLocalDateTime) / 60) * 60;

  const indices = hourly.time
    .map((_, i) => i)
    .filter((i) => {
      const m = naiveMinutes(hourly.time[i]);
      return m >= startMinutes && m <= endMinutes;
    });

  if (indices.length === 0) {
    // Shouldn't happen given the floor/ceil above, but never return zero
    // points -- fall back to the single nearest hour.
    const targetMinutes = naiveMinutes(startLocalDateTime);
    let bestIndex = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < hourly.time.length; i++) {
      const diff = Math.abs(naiveMinutes(hourly.time[i]) - targetMinutes);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = i;
      }
    }
    indices.push(bestIndex);
  }

  return indices.map((i) => toWeatherConditions(hourlyFieldsAt(hourly, i), elevationM));
}

function circularMeanBearingDeg(bearingsDeg: number[]): number {
  let sinSum = 0;
  let cosSum = 0;
  for (const bearingDeg of bearingsDeg) {
    const rad = (bearingDeg * Math.PI) / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  }
  return ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360;
}

/**
 * Collapses a real window of hourly readings into the single
 * "representative" value the existing heat/humidity/wind engines consume
 * -- an unweighted mean across every included hourly point (hourly is
 * already Open-Meteo's own finest resolution, so there's no finer
 * sub-hour weighting this data could honestly support). Deliberately does
 * NOT change what the engines themselves do with that number -- see
 * docs/release-documentation-investigation.md-adjacent reasoning in
 * environmental-calculator.tsx's own comments on why the calibrated
 * Mantzios/Daniels models aren't re-derived per sub-segment.
 *
 * Wind gusts use the window's PEAK, not its mean -- a gust is a worst-case
 * figure by nature, and averaging it away would understate exactly the
 * information it exists to convey (still never fed into any calculation,
 * only ever displayed -- see fetch-weather-conditions.ts's own header).
 */
export function summarizeWeatherWindow(points: WeatherConditions[]): WeatherConditions {
  if (points.length === 1) return points[0];

  const mean = (select: (p: WeatherConditions) => number) => points.reduce((sum, p) => sum + select(p), 0) / points.length;

  return {
    tempC: mean((p) => p.tempC),
    relativeHumidityPct: mean((p) => p.relativeHumidityPct),
    dewPointC: mean((p) => p.dewPointC),
    cloudCoverPct: mean((p) => p.cloudCoverPct),
    pressureHPa: mean((p) => p.pressureHPa),
    windSpeedMS: mean((p) => p.windSpeedMS),
    windFromBearingDeg: circularMeanBearingDeg(points.map((p) => p.windFromBearingDeg)),
    windGustsMS: Math.max(...points.map((p) => p.windGustsMS)),
    elevationM: points[0].elevationM,
  };
}
