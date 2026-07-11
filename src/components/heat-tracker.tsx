"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

type ZoneName = "green" | "yellow" | "red" | "black";

type Zone = {
  maxC: number;
  name: ZoneName;
  flagLabel: string;
  textClass: string;
  fillClass: string;
  bandClass: string;
  swatchClass: string;
  ringClass: string;
  // Literal hex, not a Tailwind class — SVG <stop stop-color> needs a real
  // color value, which Tailwind utility classes can't provide.
  hex: string;
};

const ZONES: Zone[] = [
  {
    maxC: 18,
    name: "green",
    flagLabel: "Green flag",
    textClass: "text-green-600 dark:text-green-500",
    fillClass: "fill-green-600",
    bandClass: "fill-green-600/10",
    swatchClass: "bg-green-600",
    ringClass: "stroke-green-600",
    hex: "#16a34a",
  },
  {
    maxC: 23,
    name: "yellow",
    flagLabel: "Yellow flag",
    textClass: "text-amber-600 dark:text-amber-500",
    fillClass: "fill-amber-600",
    bandClass: "fill-amber-600/10",
    swatchClass: "bg-amber-600",
    ringClass: "stroke-amber-600",
    hex: "#d97706",
  },
  {
    maxC: 28,
    name: "red",
    flagLabel: "Red flag",
    textClass: "text-red-600 dark:text-red-500",
    fillClass: "fill-red-600",
    bandClass: "fill-red-600/10",
    swatchClass: "bg-red-600",
    ringClass: "stroke-red-600",
    hex: "#dc2626",
  },
  {
    maxC: Infinity,
    name: "black",
    flagLabel: "Black flag",
    textClass: "text-zinc-900 dark:text-white",
    fillClass: "fill-zinc-900 dark:fill-white",
    bandClass: "fill-zinc-900/10 dark:fill-white/10",
    swatchClass: "bg-zinc-900 dark:bg-white",
    ringClass: "stroke-zinc-900 dark:stroke-white",
    // Fixed dark-red rather than a light/dark-flipped value: gradient stops
    // can't respond to a dark: variant, so this needs one color that stays
    // legible on both a white and a zinc-900 chart card.
    hex: "#7f1d1d",
  },
];

const BLACK_FLAG_C = 28;
const SCALE_MIN_C = -5;
const SCALE_MAX_C = 35;
const GAUGE_WIDTH = 34;
const GAUGE_HEIGHT = 160;
const CHART_WIDTH = 860;
const CHART_HEIGHT = 280;
const PAD_LEFT = 40;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 34;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

type GeocodeResult = {
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

type ForecastResponse = {
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
  };
};

type WbgtPoint = {
  time: Date;
  tempC: number;
  rh: number;
  wbgtC: number;
};

type LocationMeta = {
  lat: number;
  lon: number;
  label: string;
};

// Australian Bureau of Meteorology outdoor WBGT approximation. Folds
// evaporative cooling (humidity) and a calibrated radiant-heat term into a
// single estimate, without needing a physical black-globe sensor.
function estimateWBGT(tempC: number, rh: number): number {
  const vaporPressure =
    (rh / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  return 0.567 * tempC + 0.393 * vaporPressure + 3.94;
}

function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

function zoneFor(wbgtC: number): Zone {
  return ZONES.find((zone) => wbgtC < zone.maxC) ?? ZONES[ZONES.length - 1];
}

// Training guidance within the green flag band, per ACSM-aligned tiers.
function runnerGuidance(
  wbgtC: number,
  zoneName: ZoneName,
): { title: string; sub: string } {
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

function geocodeLabel(result: GeocodeResult): string {
  return [result.name, result.admin1, result.country].filter(Boolean).join(", ");
}

async function fetchGeocodeCandidates(
  cityName: string,
  count: number,
): Promise<GeocodeResult[]> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=${count}`,
  );
  if (!res.ok) throw new Error("Location lookup failed.");
  const data: GeocodeResponse = await res.json();
  return data.results ?? [];
}

async function geocodeCity(query: string): Promise<LocationMeta> {
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
          candidate.admin1?.toLowerCase() === region ||
          candidate.country?.toLowerCase() === region,
      )) ||
    results[0];

  return {
    lat: result.latitude,
    lon: result.longitude,
    label: geocodeLabel(result),
  };
}

async function fetchForecastSeries(
  lat: number,
  lon: number,
): Promise<WbgtPoint[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m&forecast_days=3&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Forecast request failed.");
  const data: ForecastResponse = await res.json();
  const { time, temperature_2m, relative_humidity_2m } = data.hourly;

  const now = new Date();
  let nowIndex = 0;
  for (let i = 0; i < time.length; i++) {
    if (new Date(time[i]) <= now) nowIndex = i;
  }

  const series: WbgtPoint[] = [];
  for (let i = nowIndex; i < Math.min(nowIndex + 49, time.length); i++) {
    series.push({
      time: new Date(time[i]),
      tempC: temperature_2m[i],
      rh: relative_humidity_2m[i],
      wbgtC: estimateWBGT(temperature_2m[i], relative_humidity_2m[i]),
    });
  }
  return series;
}

function gaugeFillHeight(wbgtC: number): number {
  const pct = Math.max(
    0,
    Math.min(1, (wbgtC - SCALE_MIN_C) / (SCALE_MAX_C - SCALE_MIN_C)),
  );
  return pct * GAUGE_HEIGHT;
}

// Catmull-Rom to cubic-Bezier conversion, so the outlook line reads as a
// smooth curve (like Apple Weather's hourly graph) instead of straight
// segments between hourly points.
function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

  let path = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return path;
}

export function HeatTracker() {
  const [cityInput, setCityInput] = useState("");
  const [message, setMessage] = useState("Trying your device location…");
  const [series, setSeries] = useState<WbgtPoint[] | null>(null);
  const [meta, setMeta] = useState<LocationMeta | null>(null);
  const [clock, setClock] = useState("");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const chartSvgRef = useRef<SVGSVGElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionRequestId = useRef(0);
  const skipNextSuggestionFetch = useRef(false);
  const gradientBaseId = useId();
  const listboxId = `heat-tracker-suggestions-${gradientBaseId}`;
  const lineGradientId = `wbgt-line-${gradientBaseId}`;
  const areaFadeId = `wbgt-area-fade-${gradientBaseId}`;
  const areaMaskId = `wbgt-area-mask-${gradientBaseId}`;

  useEffect(() => {
    const updateClock = () => {
      setClock(
        new Date().toLocaleString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          month: "short",
          day: "numeric",
        }),
      );
    };
    updateClock();
    const id = setInterval(updateClock, 30_000);
    return () => clearInterval(id);
  }, []);

  const loadLocation = useCallback(
    async (lat: number, lon: number, label: string) => {
      setMessage("Fetching forecast…");
      try {
        const nextSeries = await fetchForecastSeries(lat, lon);
        setSeries(nextSeries);
        setMeta({ lat, lon, label });
        setMessage(`Showing ${label}`);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Something went wrong fetching the forecast.",
        );
      }
    },
    [],
  );

  const attemptGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setMessage(
        "Your browser doesn't support location lookup — search for a city instead.",
      );
      return;
    }
    setMessage("Asking for your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        void loadLocation(
          latitude,
          longitude,
          `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`,
        );
      },
      () => {
        setMessage(
          "Location access was blocked — search for a city above instead.",
        );
      },
      { timeout: 8000 },
    );
  }, [loadLocation]);

  useEffect(() => {
    attemptGeolocation();
    // Only ever run this once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced as-you-type suggestions. Skipped once right after a selection
  // programmatically fills the input, so picking a suggestion doesn't
  // immediately reopen a dropdown for the text it just wrote.
  useEffect(() => {
    if (skipNextSuggestionFetch.current) {
      skipNextSuggestionFetch.current = false;
      return;
    }

    const [namePart] = cityInput.split(",");
    const cityName = namePart.trim();

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    // Too-short input is cleared synchronously in the input's own onChange
    // handler below, not here -- this effect only ever sets state inside
    // its async fetch callback.
    if (cityName.length < 2) return;

    debounceTimer.current = setTimeout(() => {
      const requestId = ++suggestionRequestId.current;
      setSuggestionsLoading(true);
      fetchGeocodeCandidates(cityName, 6)
        .then((results) => {
          if (requestId !== suggestionRequestId.current) return; // superseded by a newer keystroke
          setSuggestions(results);
          setShowSuggestions(true);
          setSuggestionsLoading(false);
          setHighlightedIndex(-1);
        })
        .catch(() => {
          if (requestId !== suggestionRequestId.current) return;
          setSuggestions([]);
          setShowSuggestions(false);
          setSuggestionsLoading(false);
        });
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [cityInput]);

  useEffect(() => {
    if (!showSuggestions) return;
    function handleClickOutside(event: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSuggestions]);

  const selectSuggestion = (result: GeocodeResult) => {
    const label = geocodeLabel(result);
    skipNextSuggestionFetch.current = true;
    setCityInput(label);
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    void loadLocation(result.latitude, result.longitude, label);
  };

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[highlightedIndex]);
    } else if (event.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleSearch = async () => {
    const query = cityInput.trim();
    if (!query) {
      setMessage("Type a city name first.");
      return;
    }
    setMessage("Looking that up…");
    try {
      const location = await geocodeCity(query);
      await loadLocation(location.lat, location.lon, location.label);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not find that location.",
      );
    }
  };

  const current = series?.[0] ?? null;
  const zone = current ? zoneFor(current.wbgtC) : null;
  const guidance = current && zone ? runnerGuidance(current.wbgtC, zone.name) : null;

  const values = series?.map((point) => point.wbgtC) ?? [];
  const minValue = Math.min(...values, 5);
  const maxValue = Math.max(...values, BLACK_FLAG_C + 3, 25);
  const xForIndex = (index: number) =>
    PAD_LEFT + (index / Math.max(1, (series?.length ?? 1) - 1)) * PLOT_WIDTH;
  const yForValue = (value: number) =>
    PAD_TOP + PLOT_HEIGHT - ((value - minValue) / (maxValue - minValue)) * PLOT_HEIGHT;

  const linePath = series
    ? buildSmoothPath(
        series.map((point, index) => ({
          x: xForIndex(index),
          y: yForValue(point.wbgtC),
        })),
      )
    : undefined;

  const areaPath =
    series && linePath
      ? `${linePath} L${xForIndex(series.length - 1).toFixed(1)},${CHART_HEIGHT - PAD_BOTTOM} L${xForIndex(0).toFixed(1)},${CHART_HEIGHT - PAD_BOTTOM} Z`
      : undefined;

  const hoverPoint =
    series && hoverIndex !== null ? series[hoverIndex] : null;

  let lowIndex = 0;
  let highIndex = 0;
  if (series) {
    series.forEach((point, index) => {
      if (point.wbgtC < series[lowIndex].wbgtC) lowIndex = index;
      if (point.wbgtC > series[highIndex].wbgtC) highIndex = index;
    });
  }

  const handleChartPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!series || !chartSvgRef.current) return;
    const rect = chartSvgRef.current.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    const viewBoxX = fraction * CHART_WIDTH;
    const rawIndex =
      ((viewBoxX - PAD_LEFT) / PLOT_WIDTH) * (series.length - 1);
    const index = Math.max(0, Math.min(series.length - 1, Math.round(rawIndex)));
    setHoverIndex(index);
  };

  const clearChartHover = () => setHoverIndex(null);

  const hoverLeftPct = hoverPoint
    ? Math.max(16, Math.min(84, (xForIndex(hoverIndex ?? 0) / CHART_WIDTH) * 100))
    : null;

  return (
    <div className="mt-10 space-y-10">
      <div className="flex items-baseline justify-between border-b border-black/10 pb-3 text-xs text-zinc-600 dark:border-white/10 dark:text-zinc-300">
        <span className="font-mono tracking-wide uppercase">
          Live conditions
        </span>
        <span className="font-mono">{clock || "—"}</span>
      </div>

      <div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSearch();
          }}
          className="flex flex-wrap gap-2"
        >
          <div ref={searchBoxRef} className="relative min-w-[180px] flex-1">
            <input
              type="text"
              value={cityInput}
              onChange={(event) => {
                const value = event.target.value;
                setCityInput(value);
                const [namePart] = value.split(",");
                if (namePart.trim().length < 2) {
                  setSuggestions([]);
                  setShowSuggestions(false);
                }
              }}
              onKeyDown={handleInputKeyDown}
              onFocus={() => setShowSuggestions(suggestions.length > 0)}
              placeholder="Enter a city, e.g. Phoenix, AZ"
              autoComplete="off"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={
                highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
              }
              className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-base text-zinc-900 transition focus:ring-2 focus:ring-zinc-900 focus:outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
            />
            {(suggestionsLoading || showSuggestions) && (
              <div
                id={listboxId}
                role="listbox"
                className="absolute left-0 top-full z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-900"
              >
                {suggestionsLoading ? (
                  <p className="px-4 py-2.5 text-sm text-zinc-500 dark:text-zinc-400">
                    Searching…
                  </p>
                ) : suggestions.length > 0 ? (
                  suggestions.map((result, index) => (
                    <button
                      key={result.id}
                      id={`${listboxId}-option-${index}`}
                      role="option"
                      aria-selected={index === highlightedIndex}
                      type="button"
                      onClick={() => selectSuggestion(result)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`block w-full px-4 py-2 text-left text-sm ${
                        index === highlightedIndex
                          ? "bg-black/5 text-zinc-950 dark:bg-white/10 dark:text-white"
                          : "text-zinc-700 dark:text-zinc-200"
                      }`}
                    >
                      {geocodeLabel(result)}
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-2.5 text-sm text-zinc-500 dark:text-zinc-400">
                    No matches found
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            type="submit"
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Look up
          </button>
          <button
            type="button"
            onClick={attemptGeolocation}
            className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-black/5 dark:border-white/20 dark:text-zinc-200 dark:hover:bg-white/10"
          >
            Use my location
          </button>
        </form>
        <p className="mt-2 min-h-[1.25rem] text-xs text-zinc-600 dark:text-zinc-300">
          {message}
        </p>
      </div>

      <div className="grid gap-8 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {meta?.label ?? "Waiting for a location…"}
          </p>
          <p className="text-6xl font-semibold tracking-tight text-zinc-900 sm:text-7xl dark:text-white">
            {current ? cToF(current.wbgtC).toFixed(1) : "—"}
            <span className="ml-1 text-2xl font-normal text-zinc-600 dark:text-zinc-300">
              °F
            </span>
          </p>
          <p
            className={`mt-3 text-xl font-semibold ${
              zone ? zone.textClass : "text-zinc-900 dark:text-white"
            }`}
          >
            {zone && guidance
              ? `${zone.flagLabel} · ${guidance.title}`
              : "Waiting on a reading…"}
          </p>
          {guidance && (
            <p className="mt-1 max-w-[46ch] text-sm text-zinc-600 dark:text-zinc-300">
              {guidance.sub}
            </p>
          )}
        </div>

        <div className="flex flex-col items-center justify-self-center">
          <svg
            width={GAUGE_WIDTH + 12}
            height={GAUGE_HEIGHT + 56}
            viewBox={`0 0 ${GAUGE_WIDTH + 12} ${GAUGE_HEIGHT + 56}`}
          >
            <rect
              x="6"
              y="0"
              width={GAUGE_WIDTH}
              height={GAUGE_HEIGHT}
              rx={GAUGE_WIDTH / 2}
              strokeWidth="1"
              className="fill-white stroke-black/10 dark:fill-zinc-900 dark:stroke-white/10"
            />
            {current && zone && (
              <rect
                x="6"
                y={GAUGE_HEIGHT - gaugeFillHeight(current.wbgtC)}
                width={GAUGE_WIDTH}
                height={gaugeFillHeight(current.wbgtC)}
                rx={GAUGE_WIDTH / 2}
                className={zone.fillClass}
              />
            )}
            <circle
              cx={6 + GAUGE_WIDTH / 2}
              cy={GAUGE_HEIGHT + 28}
              r="22"
              strokeWidth="1"
              className={
                zone
                  ? `${zone.fillClass} stroke-black/10 dark:stroke-white/10`
                  : "fill-white stroke-black/10 dark:fill-zinc-900 dark:stroke-white/10"
              }
            />
          </svg>
          <p className="mt-2 text-center text-[10px] tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
            {cToF(SCALE_MIN_C).toFixed(0)}–{cToF(SCALE_MAX_C).toFixed(0)}°F
            <br />
            WBGT
          </p>
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
          48-hour WBGT outlook — plan your sessions
        </p>
        <div className="relative rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
          {series && linePath && areaPath ? (
            <svg
              ref={chartSvgRef}
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="h-auto w-full touch-none"
              onPointerMove={handleChartPointer}
              onPointerDown={handleChartPointer}
              onPointerLeave={clearChartHover}
            >
              <defs>
                <linearGradient
                  id={lineGradientId}
                  gradientUnits="userSpaceOnUse"
                  x1={PAD_LEFT}
                  y1="0"
                  x2={CHART_WIDTH - PAD_RIGHT}
                  y2="0"
                >
                  {series.map((point, index) => (
                    <stop
                      key={point.time.toISOString()}
                      offset={`${(index / Math.max(1, series.length - 1)) * 100}%`}
                      stopColor={zoneFor(point.wbgtC).hex}
                    />
                  ))}
                </linearGradient>
                <linearGradient id={areaFadeId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
                <mask id={areaMaskId}>
                  <rect
                    x={PAD_LEFT}
                    y={PAD_TOP}
                    width={PLOT_WIDTH}
                    height={PLOT_HEIGHT}
                    fill={`url(#${areaFadeId})`}
                  />
                </mask>
              </defs>

              {ZONES.map((zoneBand, index) => {
                const prevMax = index === 0 ? minValue : ZONES[index - 1].maxC;
                const top = Math.min(zoneBand.maxC, maxValue);
                const bottom = Math.max(prevMax, minValue);
                if (top <= bottom) return null;
                return (
                  <rect
                    key={zoneBand.name}
                    x={PAD_LEFT}
                    y={yForValue(top)}
                    width={PLOT_WIDTH}
                    height={yForValue(bottom) - yForValue(top)}
                    className={zoneBand.bandClass}
                  />
                );
              })}

              {Array.from({ length: 5 }, (_, step) => {
                const value = minValue + (step / 4) * (maxValue - minValue);
                const y = yForValue(value);
                return (
                  <line
                    key={step}
                    x1={PAD_LEFT}
                    y1={y}
                    x2={CHART_WIDTH - PAD_RIGHT}
                    y2={y}
                    strokeWidth="1"
                    className="stroke-black/10 dark:stroke-white/10"
                  />
                );
              })}

              {series.map((point, index) => {
                if (point.time.getHours() % 6 !== 0) return null;
                return (
                  <line
                    key={point.time.toISOString()}
                    x1={xForIndex(index)}
                    y1={PAD_TOP}
                    x2={xForIndex(index)}
                    y2={CHART_HEIGHT - PAD_BOTTOM}
                    strokeWidth="1"
                    className="stroke-black/10 dark:stroke-white/10"
                  />
                );
              })}

              {BLACK_FLAG_C >= minValue && BLACK_FLAG_C <= maxValue && (
                <line
                  x1={PAD_LEFT}
                  y1={yForValue(BLACK_FLAG_C)}
                  x2={CHART_WIDTH - PAD_RIGHT}
                  y2={yForValue(BLACK_FLAG_C)}
                  strokeWidth="1.5"
                  strokeDasharray="5,4"
                  className="stroke-zinc-900 dark:stroke-white"
                />
              )}

              <path d={areaPath} fill={`url(#${lineGradientId})`} mask={`url(#${areaMaskId})`} />
              <path
                d={linePath}
                fill="none"
                stroke={`url(#${lineGradientId})`}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              <circle
                cx={xForIndex(lowIndex)}
                cy={yForValue(series[lowIndex].wbgtC)}
                r="3.5"
                strokeWidth="1.5"
                className="fill-white stroke-zinc-600 dark:fill-zinc-900 dark:stroke-zinc-300"
              />
              <circle
                cx={xForIndex(highIndex)}
                cy={yForValue(series[highIndex].wbgtC)}
                r="3.5"
                strokeWidth="1.5"
                className="fill-white stroke-zinc-600 dark:fill-zinc-900 dark:stroke-zinc-300"
              />

              <circle
                cx={xForIndex(0)}
                cy={yForValue(series[0].wbgtC)}
                r="5.5"
                strokeWidth="2.5"
                className={`fill-white dark:fill-zinc-900 ${zoneFor(series[0].wbgtC).ringClass}`}
              />

              {hoverPoint && hoverIndex !== null && (
                <>
                  <line
                    x1={xForIndex(hoverIndex)}
                    y1={PAD_TOP}
                    x2={xForIndex(hoverIndex)}
                    y2={CHART_HEIGHT - PAD_BOTTOM}
                    strokeWidth="1"
                    className="stroke-zinc-900/30 dark:stroke-white/30"
                  />
                  <circle
                    cx={xForIndex(hoverIndex)}
                    cy={yForValue(hoverPoint.wbgtC)}
                    r="5.5"
                    strokeWidth="2.5"
                    className={`fill-white dark:fill-zinc-900 ${zoneFor(hoverPoint.wbgtC).ringClass}`}
                  />
                </>
              )}
            </svg>
          ) : (
            <p className="py-12 text-center text-sm text-zinc-600 dark:text-zinc-300">
              Waiting on a forecast to plot…
            </p>
          )}

          {series && (
            <>
              {/* Axis and point labels are rendered as HTML, not SVG <text>,
                  so they stay a real, legible font size on narrow screens
                  instead of shrinking with the chart's viewBox scale. */}
              {Array.from({ length: 5 }, (_, step) => {
                const value = minValue + (step / 4) * (maxValue - minValue);
                const topPct = (yForValue(value) / CHART_HEIGHT) * 100;
                return (
                  <span
                    key={step}
                    className="pointer-events-none absolute left-1 -translate-y-1/2 font-mono text-[10px] text-zinc-600 sm:text-[11px] dark:text-zinc-300"
                    style={{ top: `${topPct}%` }}
                  >
                    {cToF(value).toFixed(0)}°
                  </span>
                );
              })}

              {series.map((point, index) => {
                const hour = point.time.getHours();
                if (hour % 6 !== 0) return null;
                const isMajor = hour % 12 === 0;
                const leftPct = (xForIndex(index) / CHART_WIDTH) * 100;
                return (
                  <span
                    key={point.time.toISOString()}
                    className={`pointer-events-none absolute bottom-0.5 -translate-x-1/2 font-mono text-[10px] text-zinc-600 sm:text-[11px] dark:text-zinc-300 ${
                      isMajor ? "" : "hidden sm:inline-block"
                    }`}
                    style={{ left: `${leftPct}%` }}
                  >
                    {point.time.toLocaleTimeString(undefined, {
                      hour: "numeric",
                    })}
                  </span>
                );
              })}

              <span
                className="pointer-events-none absolute -translate-x-1/2 text-[10px] font-semibold text-zinc-600 sm:text-[11px] dark:text-zinc-300"
                style={{
                  left: `${(xForIndex(lowIndex) / CHART_WIDTH) * 100}%`,
                  top: `${(yForValue(series[lowIndex].wbgtC) / CHART_HEIGHT) * 100}%`,
                  marginTop: "10px",
                }}
              >
                L
              </span>
              <span
                className="pointer-events-none absolute -translate-x-1/2 text-[10px] font-semibold text-zinc-600 sm:text-[11px] dark:text-zinc-300"
                style={{
                  left: `${(xForIndex(highIndex) / CHART_WIDTH) * 100}%`,
                  top: `${(yForValue(series[highIndex].wbgtC) / CHART_HEIGHT) * 100}%`,
                  marginTop: "-20px",
                }}
              >
                H
              </span>

              {BLACK_FLAG_C >= minValue && BLACK_FLAG_C <= maxValue && (
                <div
                  className="pointer-events-none absolute right-1 -translate-y-full text-[10px] text-zinc-900 sm:text-[10.5px] dark:text-white"
                  style={{
                    top: `${(yForValue(BLACK_FLAG_C) / CHART_HEIGHT) * 100}%`,
                  }}
                >
                  <span className="hidden sm:inline">
                    {cToF(BLACK_FLAG_C).toFixed(0)}°F — take training indoors
                  </span>
                  <span className="sm:hidden">
                    {cToF(BLACK_FLAG_C).toFixed(0)}°F limit
                  </span>
                </div>
              )}
            </>
          )}

          {hoverPoint && hoverLeftPct !== null && (
            <div
              className="pointer-events-none absolute top-2 w-28 -translate-x-1/2 rounded-lg border border-black/10 bg-white px-2.5 py-2 text-center shadow-md sm:w-auto sm:text-left dark:border-white/10 dark:bg-zinc-900"
              style={{ left: `${hoverLeftPct}%` }}
            >
              <p className="font-mono text-[11px] text-zinc-600 sm:whitespace-nowrap dark:text-zinc-300">
                {hoverPoint.time.toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
              <div className="mt-1 flex items-center justify-center gap-1.5 sm:justify-start">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${zoneFor(hoverPoint.wbgtC).swatchClass}`}
                />
                <p
                  className={`text-sm font-semibold sm:whitespace-nowrap ${zoneFor(hoverPoint.wbgtC).textClass}`}
                >
                  {cToF(hoverPoint.wbgtC).toFixed(1)}°F WBGT
                </p>
              </div>
              <p className="mt-1 text-[11px] text-zinc-600 sm:whitespace-nowrap dark:text-zinc-300">
                {cToF(hoverPoint.tempC).toFixed(0)}°F air · {hoverPoint.rh}%
                humidity
              </p>
              <p
                className={`mt-0.5 text-[11px] font-medium sm:whitespace-nowrap ${zoneFor(hoverPoint.wbgtC).textClass}`}
              >
                {zoneFor(hoverPoint.wbgtC).flagLabel}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-zinc-600 dark:text-zinc-300">
        <span className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${ZONES[0].swatchClass}`} />
          Green flag — under {cToF(ZONES[0].maxC).toFixed(0)}°F: train as
          planned, easy or hard
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${ZONES[1].swatchClass}`} />
          Yellow flag — {cToF(ZONES[0].maxC).toFixed(0)}–
          {cToF(ZONES[1].maxC).toFixed(0)}°F: easy runs are fine, ease off
          intervals and tempo
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${ZONES[2].swatchClass}`} />
          Red flag — {cToF(ZONES[1].maxC).toFixed(0)}–
          {cToF(ZONES[2].maxC).toFixed(0)}°F: easy runs by effort only,
          intervals and tempo move indoors
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${ZONES[3].swatchClass}`} />
          Black flag — above {cToF(ZONES[2].maxC).toFixed(0)}°F: skip
          outdoor training, easy or hard
        </span>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
          Right now
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
            <p className="text-[10.5px] tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
              Air temp
            </p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
              {current ? `${cToF(current.tempC).toFixed(1)}°F` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
            <p className="text-[10.5px] tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
              Relative humidity
            </p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
              {current ? `${current.rh}%` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
            <p className="text-[10.5px] tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
              WBGT estimate
            </p>
            <p
              className={`mt-1 text-2xl font-semibold ${
                zone ? zone.textClass : "text-zinc-900 dark:text-white"
              }`}
            >
              {current ? `${cToF(current.wbgtC).toFixed(1)}°F` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
            <p className="text-[10.5px] tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
              Coordinates
            </p>
            <p className="font-mono mt-1 text-lg font-semibold text-zinc-900 dark:text-white">
              {meta ? `${meta.lat.toFixed(2)}, ${meta.lon.toFixed(2)}` : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-[64ch] space-y-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
          What this is showing
        </h2>
        <p>
          Wet Bulb Globe Temperature (WBGT) is what sports physiologists use
          to gauge heat stress in distance runners, since it combines air
          temperature and humidity with the radiant heat load a body absorbs
          outdoors — a fuller picture than air temperature alone. A true WBGT
          reading comes from a black-globe thermometer plus wind and solar
          sensors; this page instead uses the Australian Bureau of
          Meteorology&rsquo;s outdoor approximation, which estimates the same
          value from temperature and humidity:{" "}
          <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-xs dark:bg-white/10">
            WBGT ≈ 0.567·Ta + 0.393·e + 3.94
          </code>
          , where <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-xs dark:bg-white/10">e</code> is
          vapor pressure derived from relative humidity.<sup>1</sup> It&rsquo;s
          a solid stand-in when there&rsquo;s no physical sensor on hand, but
          validation studies have found it doesn&rsquo;t fully account for
          wind speed or direct sun, so on very sunny, still days the real
          WBGT may run a bit higher than shown here.<sup>2</sup>
        </p>

        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
          How to use it
        </h2>
        <p>
          Check it before you plan a session, not just before you walk out
          the door — the 48-hour outlook exists so you can move a track
          workout or long run to a cooler window (early morning tends to
          beat afternoon) instead of just gutting through the heat you
          happen to hit. Treat the flag color as the headline and the exact
          number as a detail: conditions right at a boundary deserve the
          more conservative read, since heat illness risk doesn&rsquo;t
          actually jump at a clean line the way the categories imply.
        </p>

        <p>
          The flag categories and training notes follow the American College
          of Sports Medicine&rsquo;s WBGT guidelines: green flag is a green
          light for whatever&rsquo;s on the schedule, yellow flag calls for
          easing off intervals, tempo, and other structured hard efforts
          while easy mileage stays fine, red flag means shifting those hard
          efforts to a treadmill or a cooler window of the day, and black
          flag is the point where outdoor training itself carries real
          heat-illness risk.<sup>3</sup> These aren&rsquo;t arbitrary lines —
          at the Boston Marathon, every recorded exertional heat stroke case
          over a multi-year period occurred once WBGT climbed into this
          range, and incidence tracked the rise in WBGT from the start of
          the race.<sup>4</sup> A separate 30-year analysis of the Twin
          Cities Marathon found the same pattern: WBGT was a meaningful
          predictor of medical tent volume and emergency transfers on
          unexpectedly warm race days.<sup>5</sup>
        </p>
        <p>
          This is general sports-science guidance, not a substitute for a
          coach&rsquo;s judgment — heat illness can escalate quickly during
          hard efforts, so when conditions sit near a flag boundary,
          it&rsquo;s worth erring conservative and listening to how the body
          actually feels that day.
        </p>

        <div className="border-t border-black/10 pt-4 dark:border-white/10">
          <h3 className="text-xs font-semibold tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
            Sources
          </h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs">
            <li>
              Australian Bureau of Meteorology,{" "}
              <a
                href="https://www.bom.gov.au/info/thermal_stress/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
              >
                Thermal Comfort observations
              </a>{" "}
              — source of the outdoor WBGT approximation formula used here.
            </li>
            <li>
              Lemke &amp; Kjellstrom,{" "}
              <a
                href="https://www.sciencedirect.com/science/article/abs/pii/S2212095519302469"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
              >
                Applicability of the model presented by the Australian
                Bureau of Meteorology to determine WBGT in outdoor
                workplaces
              </a>{" "}
              — independent validation of the approximation&rsquo;s accuracy
              and limitations against physical sensors.
            </li>
            <li>
              Armstrong et al.,{" "}
              <a
                href="https://pubmed.ncbi.nlm.nih.gov/17473783/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
              >
                American College of Sports Medicine position stand:
                Exertional heat illness during training and competition
              </a>
              , <em>Medicine &amp; Science in Sports &amp; Exercise</em>{" "}
              (2007) — source of the flag thresholds and training guidance
              used on this page.
            </li>
            <li>
              Chiampas et al.,{" "}
              <a
                href="https://pubmed.ncbi.nlm.nih.gov/33756522/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
              >
                Exertional Heat Stroke at the Boston Marathon: Demographics
                and the Environment
              </a>{" "}
              — real-race evidence linking WBGT to heat stroke incidence in
              distance runners.
            </li>
            <li>
              Roberts et al.,{" "}
              <a
                href="https://pubmed.ncbi.nlm.nih.gov/36205927/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
              >
                Using Wet Bulb Globe Temperature and Physiological
                Equivalent Temperature as Predictive Models of Medical
                Stress in a Marathon: Analysis of 30 Years of Data From the
                Twin Cities Marathon
              </a>{" "}
              — three decades of race data on WBGT and medical demand.
            </li>
          </ol>
        </div>
      </div>

      <p className="border-t border-black/10 pt-4 text-xs text-zinc-600 dark:border-white/10 dark:text-zinc-300">
        Data: Open-Meteo forecast &amp; geocoding APIs · Formula: Australian
        Bureau of Meteorology outdoor WBGT approximation · Flag categories:
        ACSM heat guidelines · No data is stored anywhere.
      </p>
    </div>
  );
}
