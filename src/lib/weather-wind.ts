// Current wind conditions from Open-Meteo -- same free, no-key API
// heat-tracker.tsx already uses for temperature/humidity, just requesting
// its "current" block instead of the hourly series.

export type CurrentWind = {
  speedMS: number;
  // Meteorological convention: the compass direction the wind is blowing
  // FROM (0 = north, 90 = east, ...) -- not the direction it's heading.
  fromBearingDeg: number;
  gustsMS: number;
};

type CurrentWindResponse = {
  current: {
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
  };
};

export async function fetchCurrentWind(lat: number, lon: number): Promise<CurrentWind> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=ms&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Wind lookup failed.");
  const data: CurrentWindResponse = await res.json();
  return {
    speedMS: data.current.wind_speed_10m,
    fromBearingDeg: data.current.wind_direction_10m,
    gustsMS: data.current.wind_gusts_10m,
  };
}

type HourlyWindResponse = {
  hourly?: {
    time: string[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    wind_gusts_10m: number[];
  };
  reason?: string;
};

// Minutes since an arbitrary fixed reference, from a naive "YYYY-MM-DDTHH:mm"
// string -- used only to measure relative distance between two such
// strings, never converted through any real timezone. Deliberately not
// built from the JS Date constructor: parsing a timezone-less string with
// `new Date()` implicitly assumes the *browser's* local timezone, which
// would silently corrupt this comparison whenever the queried location is
// in a different timezone than the person running the calculator.
export function naiveMinutes(localDateTime: string): number {
  const [datePart, timePart = "00:00"] = localDateTime.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const days = Date.UTC(y, m - 1, d) / 86_400_000;
  return days * 1440 + hh * 60 + mm;
}

export function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Wind at a specific date and time -- past or future -- rather than only
 * "right now". `localDateTime` is exactly the value of an
 * `<input type="datetime-local">` (e.g. "2026-07-20T07:30"): a naive,
 * timezone-free wall-clock reading. That's deliberate -- a runner picking
 * "7am Saturday" for a race in a specific city means 7am *there*, not 7am
 * translated through their own browser's timezone, so this matches
 * against Open-Meteo's own hourly timestamps (also naive, in the queried
 * location's local time via timezone=auto) as plain wall-clock values,
 * never as real UTC instants.
 *
 * Dates far enough in the past use the historical archive API; anything
 * else uses the standard forecast API, which also covers a short recent
 * history and up to ~16 days ahead.
 */
export async function fetchWindAtTime(lat: number, lon: number, localDateTime: string): Promise<CurrentWind> {
  const [datePart] = localDateTime.split("T");
  const isPast = datePart < todayDateString();
  const params = `latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=ms&timezone=auto&start_date=${datePart}&end_date=${datePart}`;
  const url = isPast
    ? `https://archive-api.open-meteo.com/v1/archive?${params}`
    : `https://api.open-meteo.com/v1/forecast?${params}`;

  const res = await fetch(url);
  const data: HourlyWindResponse = await res.json();
  if (!res.ok || !data.hourly) {
    throw new Error(data.reason ?? "Wind lookup failed for that date.");
  }

  const { time, wind_speed_10m, wind_direction_10m, wind_gusts_10m } = data.hourly;
  if (time.length === 0) throw new Error("No wind data available for that date.");

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

  return {
    speedMS: wind_speed_10m[bestIndex],
    fromBearingDeg: wind_direction_10m[bestIndex],
    gustsMS: wind_gusts_10m[bestIndex],
  };
}
