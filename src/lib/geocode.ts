// Location lookup shared by any tool that needs "type a city, get a
// lat/lon" -- Open-Meteo's free geocoding API needs no key. Extracted out
// of heat-tracker.tsx once a second and third tool (wind-calculator,
// track-wind-calculator) needed the identical behavior.

export type GeocodeResult = {
  id: number;
  latitude: number;
  longitude: number;
  name: string;
  admin1?: string;
  country?: string;
};

type GeocodeResponse = {
  results?: GeocodeResult[];
};

export type LocationMeta = {
  lat: number;
  lon: number;
  label: string;
};

// Open-Meteo's admin1 field holds the full state name (e.g. "Arizona"), so a
// typed abbreviation needs mapping before it can be compared against it.
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

export function geocodeLabel(result: GeocodeResult): string {
  return [result.name, result.admin1, result.country].filter(Boolean).join(", ");
}

export async function fetchGeocodeCandidates(cityName: string, count: number): Promise<GeocodeResult[]> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=${count}`,
  );
  if (!res.ok) throw new Error("Location lookup failed.");
  const data: GeocodeResponse = await res.json();
  return data.results ?? [];
}

export async function geocodeCity(query: string): Promise<LocationMeta> {
  // The geocoding API matches a place's literal name field, so "Phoenix, AZ"
  // finds nothing -- only "Phoenix" does. Split off an optional state/country
  // qualifier and use it to pick the right candidate among several matches
  // instead, rather than sending the whole string as the name to search for.
  const [namePart, regionPart] = query.split(",");
  const cityName = namePart.trim();
  const region = regionPart ? normalizeRegion(regionPart) : null;

  const results = await fetchGeocodeCandidates(cityName, 10);
  if (results.length === 0) throw new Error("No matching location found.");

  const result =
    (region &&
      results.find(
        (candidate) =>
          candidate.admin1?.toLowerCase() === region || candidate.country?.toLowerCase() === region,
      )) ||
    results[0];

  return {
    lat: result.latitude,
    lon: result.longitude,
    label: geocodeLabel(result),
  };
}
