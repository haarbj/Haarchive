// Automatic wind-exposure detection via OpenStreetMap's Overpass API --
// queries land-cover features around a point and turns them into the
// same continuous 0-100 score wind-exposure.ts's model expects, so a
// road/route course can default to a real detected value instead of
// always falling back to "Suburban." Deliberately best-effort: any
// network failure, timeout, or empty result just returns null, and the
// caller falls back to the existing manual picker rather than blocking
// on this or showing an error for what's meant to be a convenience.
//
// Cached by rounded coordinates (see coordCacheKey) so repeatedly viewing
// or recalculating the same imported activity doesn't re-query Overpass --
// both an in-memory cache (covers re-renders within the session) and
// localStorage (covers reloading the same activity later) are checked
// before ever making a network request.

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const QUERY_RADIUS_M = 400;
const FETCH_TIMEOUT_MS = 8000;
const CACHE_STORAGE_KEY = "haarchive-overpass-exposure-cache-v1";
const CACHE_MAX_ENTRIES = 200;

export type OverpassExposureResult = {
  score: number;
  sampleCount: number;
};

type OverpassElement = {
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements: OverpassElement[];
};

// Rounds to ~3 decimal places (roughly 111m of latitude) -- fine-grained
// enough to distinguish genuinely different locations, coarse enough that
// GPS jitter/noise in a route's centroid doesn't create a cache miss for
// what's really the same place.
function coordCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function buildOverpassQuery(lat: number, lon: number, radiusM: number): string {
  return `
    [out:json][timeout:10];
    (
      way["building"](around:${radiusM},${lat},${lon});
      way["landuse"~"^(residential|commercial|industrial|retail)$"](around:${radiusM},${lat},${lon});
      way["natural"~"^(wood)$"](around:${radiusM},${lat},${lon});
      way["landuse"="forest"](around:${radiusM},${lat},${lon});
      way["landuse"~"^(farmland|meadow|grass|allotments)$"](around:${radiusM},${lat},${lon});
      way["natural"~"^(heath|scrub|grassland|beach|sand)$"](around:${radiusM},${lat},${lon});
      way["natural"="coastline"](around:${radiusM},${lat},${lon});
      way["natural"="water"]["water"="bay"](around:${radiusM},${lat},${lon});
    );
    out tags;
  `.trim();
}

/**
 * Turns raw Overpass elements into a 0-100 exposure score. More buildings
 * and forest tags push the score down (sheltered); more open farmland/
 * grassland or a nearby coastline push it up (exposed). This is a
 * deliberately simple heuristic, not a rigorous land-cover
 * classification -- it exists to give a reasonable automatic default,
 * with the manual picker always available as an override.
 */
export function scoreFromOverpassElements(elements: OverpassElement[]): number {
  let buildingCount = 0;
  let forestCount = 0;
  let openCount = 0;
  let coastalNearby = false;

  for (const element of elements) {
    const tags = element.tags ?? {};
    if (tags.building) buildingCount++;
    if (tags.natural === "wood" || tags.landuse === "forest") forestCount++;
    if (tags.landuse === "residential" || tags.landuse === "commercial" || tags.landuse === "industrial" || tags.landuse === "retail") {
      buildingCount++;
    }
    if (
      tags.landuse === "farmland" ||
      tags.landuse === "meadow" ||
      tags.landuse === "grass" ||
      tags.landuse === "allotments" ||
      tags.natural === "heath" ||
      tags.natural === "scrub" ||
      tags.natural === "grassland"
    ) {
      openCount++;
    }
    if (tags.natural === "coastline" || tags.natural === "beach" || tags.natural === "sand" || tags.water === "bay") {
      coastalNearby = true;
    }
  }

  let score = 50;
  score -= Math.min(40, buildingCount * 2);
  score -= Math.min(15, forestCount * 3);
  score += Math.min(25, openCount * 2);
  if (coastalNearby) score = Math.max(score, 85);

  return Math.min(100, Math.max(0, score));
}

function readCache(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, number>) {
  try {
    const keys = Object.keys(cache);
    if (keys.length > CACHE_MAX_ENTRIES) {
      // Simple bound so this can't grow unbounded across many imported
      // activities -- drop the oldest-inserted entries first.
      for (const key of keys.slice(0, keys.length - CACHE_MAX_ENTRIES)) delete cache[key];
    }
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore unavailable storage -- caching is a nice-to-have, not required.
  }
}

const memoryCache = new Map<string, number>();

/**
 * Automatically estimates a wind-exposure score (0-100) for a location
 * using OpenStreetMap data. Returns null on any failure -- no GPS
 * coordinates, network error, timeout, or an empty result -- so callers
 * can gracefully fall back to the manual terrain picker rather than
 * showing an error for what's meant to be a convenience default.
 */
export async function fetchExposureScore(lat: number, lon: number): Promise<number | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const key = coordCacheKey(lat, lon);
  if (memoryCache.has(key)) return memoryCache.get(key)!;
  const stored = readCache();
  if (key in stored) {
    memoryCache.set(key, stored[key]);
    return stored[key];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const query = buildOverpassQuery(lat, lon, QUERY_RADIUS_M);
    const res = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data: OverpassResponse = await res.json();
    if (!data.elements || data.elements.length === 0) return null;

    const score = scoreFromOverpassElements(data.elements);
    memoryCache.set(key, score);
    writeCache({ ...stored, [key]: score });
    return score;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
