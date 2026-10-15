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

/**
 * Which of Open-Meteo's three sources actually produced this reading, or
 * "manual" when a caller built one from numbers a coach/athlete typed in
 * directly rather than fetching anything (see e.g. marathon-pacing-
 * calculator.tsx's buildWeatherConditions). "forecast" and "archive" are
 * both genuine observations/predictions for the exact date asked for;
 * "climatology" is a multi-year same-calendar-date average standing in
 * for a date beyond the forecast horizon (see FORECAST_HORIZON_DAYS
 * below), and every UI surface that shows conditions should say so --
 * presenting a seasonal estimate with the same confidence as a real
 * forecast would be exactly the kind of unearned precision this site's
 * own content philosophy (CLAUDE.md §5) argues against elsewhere.
 */
export type WeatherSource = "forecast" | "archive" | "climatology" | "manual";

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
  source: WeatherSource;
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

function toWeatherConditions(fields: ConditionFields, elevationM: number | null, source: WeatherSource): WeatherConditions {
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
    source,
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
  return toWeatherConditions(data.current, typeof data.elevation === "number" ? data.elevation : null, "forecast");
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

// Open-Meteo's forecast model only accepts a start_date within this many
// days of today -- verified directly against the live API (a request for
// today+16 returns HTTP 400, "start_date is out of allowed range ... to
// <today+15>"), not assumed from documentation. Beyond this window there
// is no forecast to ask for at all, which is exactly the gap this file
// previously had no third branch for: a race planned more than ~2 weeks
// out (the common case -- most marathon planning starts months ahead)
// would surface that raw 400 "out of allowed range" API message directly
// to a coach or athlete instead of a usable estimate.
const FORECAST_HORIZON_DAYS = 15;

// How many of the most recent same-calendar-date years to average for a
// seasonal estimate once a date is past the forecast horizon -- matches
// the approach johnjdavisiv-model-based tools in this space (e.g. a
// friend's open-source race-pace planner, independently arrived at the
// same number) use for exactly this gap: Open-Meteo's archive API is real
// reanalysis data, not a guess, so "what did this date usually look like
// the last few years" is a meaningfully better estimate than refusing to
// answer at all.
const CLIMATOLOGY_YEARS = 3;
const CLIMATOLOGY_MAX_LOOKBACK_YEARS = 20; // give up rather than averaging decades-old, less climate-representative years

// Calendar-day arithmetic via Date.UTC, same trick naiveMinutes/
// addSecondsToNaiveDateTime already use elsewhere in this module's sibling
// file -- treats the date as if it were UTC purely so plain day-count math
// works, never a real timezone conversion.
function daysFromToday(datePart: string): number {
  const [ty, tm, td] = todayDateString().split("-").map(Number);
  const [y, m, d] = datePart.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}

// Moves a YYYY-MM-DD date to a different year, mapping Feb 29 to Feb 28 in
// a non-leap target year (the one calendar day climatology can't align
// exactly across years) rather than producing an invalid date.
function shiftYearInDatePart(datePart: string, year: number): string {
  const [, monthStr, dayStr] = datePart.split("-");
  const month = Number(monthStr);
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const day = month === 2 && dayStr === "29" && !isLeapYear ? "28" : dayStr;
  return `${year}-${monthStr}-${day}`;
}

async function fetchOpenMeteoHourly(url: string): Promise<HourlyConditionsResponse> {
  const res = await fetch(url);
  const data: HourlyConditionsResponse = await res.json();
  if (!res.ok || !data.hourly) {
    throw new Error(data.reason ?? "Weather lookup failed for that date.");
  }
  if (data.hourly.time.length === 0) throw new Error("No weather data available for that date.");
  return data;
}

/** The archive fetch for one candidate climatology year -- null (not thrown) on any failure, so a single missing/unreachable year degrades the average rather than failing it outright. */
async function fetchArchiveHourlyOrNull(
  lat: number,
  lon: number,
  startDatePart: string,
  endDatePart: string,
): Promise<{ hourly: NonNullable<HourlyConditionsResponse["hourly"]>; elevationM: number | null } | null> {
  try {
    const params = `latitude=${lat}&longitude=${lon}&hourly=${CONDITION_PARAMS}&wind_speed_unit=ms&timezone=auto&start_date=${startDatePart}&end_date=${endDatePart}`;
    const data = await fetchOpenMeteoHourly(`https://archive-api.open-meteo.com/v1/archive?${params}`);
    return { hourly: data.hourly!, elevationM: typeof data.elevation === "number" ? data.elevation : null };
  } catch {
    return null;
  }
}

/**
 * Averages several years' hourly records index-by-index (each year was
 * fetched for the same shifted calendar start/end dates, so index i is
 * "hour i of the requested window" in every series alike) and relabels the
 * result's timestamps onto the ORIGINAL (unshifted) target date -- so the
 * output is indistinguishable, to every downstream caller, from a real
 * forecast/archive response for the date actually requested. Wind
 * direction averages circularly (a mean of 350° and 10° is 0°, not 180°);
 * every other field is a plain arithmetic mean.
 */
function averageYearSeries(
  yearSeries: NonNullable<HourlyConditionsResponse["hourly"]>[],
  originalStartDatePart: string,
): NonNullable<HourlyConditionsResponse["hourly"]> {
  const length = Math.min(...yearSeries.map((s) => s.time.length));
  const [y, m, d] = originalStartDatePart.split("-").map(Number);
  const originalStartMs = Date.UTC(y, m - 1, d);

  const time: string[] = [];
  const temperature_2m: number[] = [];
  const relative_humidity_2m: number[] = [];
  const dew_point_2m: number[] = [];
  const cloud_cover: number[] = [];
  const surface_pressure: number[] = [];
  const wind_speed_10m: number[] = [];
  const wind_direction_10m: number[] = [];
  const wind_gusts_10m: number[] = [];

  for (let i = 0; i < length; i++) {
    const hourOffsetMs = i * 3_600_000;
    const stamp = new Date(originalStartMs + hourOffsetMs);
    time.push(
      `${stamp.getUTCFullYear()}-${String(stamp.getUTCMonth() + 1).padStart(2, "0")}-${String(stamp.getUTCDate()).padStart(2, "0")}T${String(stamp.getUTCHours()).padStart(2, "0")}:00`,
    );
    const mean = (select: (s: ConditionFields) => number) =>
      yearSeries.reduce((sum, s) => sum + select(hourlyFieldsAt(s, i)), 0) / yearSeries.length;
    temperature_2m.push(mean((f) => f.temperature_2m));
    relative_humidity_2m.push(mean((f) => f.relative_humidity_2m));
    dew_point_2m.push(mean((f) => f.dew_point_2m));
    cloud_cover.push(mean((f) => f.cloud_cover));
    surface_pressure.push(mean((f) => f.surface_pressure));
    wind_speed_10m.push(mean((f) => f.wind_speed_10m));
    wind_direction_10m.push(circularMeanBearingDeg(yearSeries.map((s) => hourlyFieldsAt(s, i).wind_direction_10m)));
    wind_gusts_10m.push(Math.max(...yearSeries.map((s) => hourlyFieldsAt(s, i).wind_gusts_10m)));
  }

  return {
    time,
    temperature_2m,
    relative_humidity_2m,
    dew_point_2m,
    cloud_cover,
    surface_pressure,
    wind_speed_10m,
    wind_direction_10m,
    wind_gusts_10m,
  };
}

/**
 * A seasonal estimate for a date beyond the forecast horizon: the same
 * calendar start/end dates, averaged across the most recent
 * CLIMATOLOGY_YEARS years the archive API actually has data for (skipping
 * any year that fails rather than aborting the whole estimate -- a 2-year
 * average is still far better than no answer). Throws only if every
 * candidate year within CLIMATOLOGY_MAX_LOOKBACK_YEARS fails.
 */
async function fetchClimatologyHourly(
  lat: number,
  lon: number,
  startDatePart: string,
  endDatePart: string,
): Promise<{ hourly: NonNullable<HourlyConditionsResponse["hourly"]>; elevationM: number | null; source: WeatherSource }> {
  const targetYear = Number(startDatePart.slice(0, 4));
  const yearResults: { hourly: NonNullable<HourlyConditionsResponse["hourly"]>; elevationM: number | null }[] = [];

  for (let y = targetYear - 1; yearResults.length < CLIMATOLOGY_YEARS && targetYear - y <= CLIMATOLOGY_MAX_LOOKBACK_YEARS; y--) {
    const shiftedStart = shiftYearInDatePart(startDatePart, y);
    const shiftedEnd = shiftYearInDatePart(endDatePart, y);
    const result = await fetchArchiveHourlyOrNull(lat, lon, shiftedStart, shiftedEnd);
    if (result) yearResults.push(result);
  }

  if (yearResults.length === 0) {
    throw new Error("No historical weather data available to estimate conditions for that date.");
  }

  return {
    hourly: averageYearSeries(
      yearResults.map((r) => r.hourly),
      startDatePart,
    ),
    elevationM: yearResults[0].elevationM,
    source: "climatology",
  };
}

/**
 * Shared fetch behind fetchConditionsAtTime and fetchConditionsWindow --
 * all three need the same hourly-array shape, differing only in which
 * index/indices callers read out of the result afterward, and now in
 * which of three Open-Meteo sources actually has data for the requested
 * date: the historical archive for past dates, the forecast model within
 * its real ~15-day window, or a multi-year climatology average beyond
 * that (see FORECAST_HORIZON_DAYS above for why the third branch exists).
 */
async function fetchHourlyConditions(
  lat: number,
  lon: number,
  startDatePart: string,
  endDatePart: string,
): Promise<{ hourly: NonNullable<HourlyConditionsResponse["hourly"]>; elevationM: number | null; source: WeatherSource }> {
  const isPast = startDatePart < todayDateString();
  if (isPast) {
    const params = `latitude=${lat}&longitude=${lon}&hourly=${CONDITION_PARAMS}&wind_speed_unit=ms&timezone=auto&start_date=${startDatePart}&end_date=${endDatePart}`;
    const data = await fetchOpenMeteoHourly(`https://archive-api.open-meteo.com/v1/archive?${params}`);
    return { hourly: data.hourly!, elevationM: typeof data.elevation === "number" ? data.elevation : null, source: "archive" };
  }

  if (daysFromToday(startDatePart) > FORECAST_HORIZON_DAYS) {
    return fetchClimatologyHourly(lat, lon, startDatePart, endDatePart);
  }

  const params = `latitude=${lat}&longitude=${lon}&hourly=${CONDITION_PARAMS}&wind_speed_unit=ms&timezone=auto&start_date=${startDatePart}&end_date=${endDatePart}`;
  const data = await fetchOpenMeteoHourly(`https://api.open-meteo.com/v1/forecast?${params}`);
  return { hourly: data.hourly!, elevationM: typeof data.elevation === "number" ? data.elevation : null, source: "forecast" };
}

/**
 * Weather at a specific date and time -- past, future, or far enough
 * ahead to need a seasonal estimate -- matching fetchWindAtTime's
 * semantics exactly: `localDateTime` is a naive "YYYY-MM-DDTHH:mm"
 * wall-clock reading in the queried location's own timezone. See
 * fetchHourlyConditions for which of the three Open-Meteo sources
 * actually answers a given date.
 */
export async function fetchConditionsAtTime(lat: number, lon: number, localDateTime: string): Promise<WeatherConditions> {
  const [datePart] = localDateTime.split("T");
  const { hourly, elevationM, source } = await fetchHourlyConditions(lat, lon, datePart, datePart);

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

  return toWeatherConditions(hourlyFieldsAt(hourly, bestIndex), elevationM, source);
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
  const { hourly, elevationM, source } = await fetchHourlyConditions(lat, lon, startDatePart, endDatePart);

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

  return indices.map((i) => toWeatherConditions(hourlyFieldsAt(hourly, i), elevationM, source));
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
    // Every point in a window comes from one fetchHourlyConditions call, so
    // they all share the same source already -- no averaging needed.
    source: points[0].source,
  };
}
