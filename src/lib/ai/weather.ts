import { addDays, estimateWBGT } from "@/lib/coaching-engine";

// Geocoding + forecast for the adjustForHeat tool. Same Open-Meteo APIs and
// city/region-splitting approach as the Heat Tracker (reimplemented here
// rather than imported, matching this project's existing pattern of small
// duplicated helpers across independent features) -- but oriented around a
// specific future date (a scheduled workout) rather than a live dashboard.

export type WeatherLookupResult =
  | { ok: true; tempC: number; humidityPct: number; wbgtC: number; locationLabel: string }
  | { ok: false; reason: string };

const MAX_FORECAST_DAYS = 15;

// Open-Meteo's admin1 field holds the full state name (e.g. "Arizona"), so
// a typed abbreviation needs mapping before it can be compared against it.
const US_STATE_ABBREVIATIONS: Record<string, string> = {
  al: "alabama", ak: "alaska", az: "arizona", ar: "arkansas", ca: "california",
  co: "colorado", ct: "connecticut", de: "delaware", fl: "florida", ga: "georgia",
  hi: "hawaii", id: "idaho", il: "illinois", in: "indiana", ia: "iowa",
  ks: "kansas", ky: "kentucky", la: "louisiana", me: "maine", md: "maryland",
  ma: "massachusetts", mi: "michigan", mn: "minnesota", ms: "mississippi", mo: "missouri",
  mt: "montana", ne: "nebraska", nv: "nevada", nh: "new hampshire", nj: "new jersey",
  nm: "new mexico", ny: "new york", nc: "north carolina", nd: "north dakota", oh: "ohio",
  ok: "oklahoma", or: "oregon", pa: "pennsylvania", ri: "rhode island", sc: "south carolina",
  sd: "south dakota", tn: "tennessee", tx: "texas", ut: "utah", vt: "vermont",
  va: "virginia", wa: "washington", wv: "west virginia", wi: "wisconsin", wy: "wyoming",
  dc: "district of columbia",
};

function normalizeRegion(text: string): string {
  const lower = text.trim().toLowerCase();
  return US_STATE_ABBREVIATIONS[lower] ?? lower;
}

type GeocodeResult = {
  latitude: number;
  longitude: number;
  name: string;
  admin1?: string;
  country?: string;
};

async function geocode(location: string): Promise<{ lat: number; lon: number; label: string } | null> {
  const [cityPart, regionPart] = location.split(",").map((s) => s.trim());
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityPart)}&count=10`,
  );
  if (!res.ok) return null;
  const data: { results?: GeocodeResult[] } = await res.json();
  const results = data.results ?? [];
  if (results.length === 0) return null;

  const match = regionPart
    ? (results.find((r) => r.admin1 && normalizeRegion(r.admin1) === normalizeRegion(regionPart)) ?? results[0])
    : results[0];

  return {
    lat: match.latitude,
    lon: match.longitude,
    label: [match.name, match.admin1, match.country].filter(Boolean).join(", "),
  };
}

export async function lookupForecastForDate(location: string, dateStr: string): Promise<WeatherLookupResult> {
  // Only a rough estimate, deliberately not the final word: it's computed
  // from this server's own UTC clock, but the forecast below resolves
  // "today" in the *queried location's* own local time (timezone=auto).
  // Those two clocks disagree about the current calendar date for several
  // hours every single day for any non-UTC location, in either direction
  // depending on whether the location sits east or west of UTC.
  const today = new Date().toISOString().slice(0, 10);
  const roughDaysOut = Math.round(
    (new Date(`${dateStr}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000,
  );
  if (roughDaysOut < -3) {
    return { ok: false, reason: "That date has already passed." };
  }
  if (roughDaysOut > MAX_FORECAST_DAYS + 3) {
    return { ok: false, reason: "That's too far out to forecast weather for yet -- ask again closer to the day." };
  }

  const place = await geocode(location);
  if (!place) {
    return { ok: false, reason: `Couldn't find a location matching "${location}".` };
  }

  // A small window centered on the target date, rather than forecast_days
  // starting from "today" -- robust to the clock mismatch above regardless
  // of which direction it goes, since the window pads both backward and
  // forward instead of only extending forward from an uncertain "today."
  const startDate = addDays(dateStr, -2);
  const endDate = addDays(dateStr, 2);
  const forecastRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&hourly=temperature_2m,relative_humidity_2m&start_date=${startDate}&end_date=${endDate}&timezone=auto`,
  );
  if (!forecastRes.ok) {
    return { ok: false, reason: "Couldn't fetch a forecast right now -- try again in a moment." };
  }
  const forecast: { hourly: { time: string[]; temperature_2m: number[]; relative_humidity_2m: number[] } } =
    await forecastRes.json();

  const { time, temperature_2m, relative_humidity_2m } = forecast.hourly;
  const dayIndices = time.map((t, i) => (t.startsWith(dateStr) ? i : -1)).filter((i) => i !== -1);
  if (dayIndices.length === 0) {
    return { ok: false, reason: "Forecast data didn't cover that date." };
  }

  // The day's peak temperature, not an average or a single fixed hour --
  // conservative on purpose, since a runner might be out at the hottest
  // part of the day and heat-safety guidance should assume the worst case
  // they could actually encounter, not a typical one.
  const peakIndex = dayIndices.reduce((best, i) => (temperature_2m[i] > temperature_2m[best] ? i : best));
  const tempC = temperature_2m[peakIndex];
  const humidityPct = relative_humidity_2m[peakIndex];

  return {
    ok: true,
    tempC,
    humidityPct,
    wbgtC: estimateWBGT(tempC, humidityPct),
    locationLabel: place.label,
  };
}
