"use client";

import { useCallback, useEffect, useState } from "react";

type ZoneName = "green" | "yellow" | "red" | "black";

type Zone = {
  maxC: number;
  name: ZoneName;
  flagLabel: string;
  textClass: string;
  fillClass: string;
  bandClass: string;
  swatchClass: string;
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
  },
  {
    maxC: 23,
    name: "yellow",
    flagLabel: "Yellow flag",
    textClass: "text-amber-600 dark:text-amber-500",
    fillClass: "fill-amber-600",
    bandClass: "fill-amber-600/10",
    swatchClass: "bg-amber-600",
  },
  {
    maxC: 28,
    name: "red",
    flagLabel: "Red flag",
    textClass: "text-red-600 dark:text-red-500",
    fillClass: "fill-red-600",
    bandClass: "fill-red-600/10",
    swatchClass: "bg-red-600",
  },
  {
    maxC: Infinity,
    name: "black",
    flagLabel: "Black flag",
    textClass: "text-zinc-900 dark:text-white",
    fillClass: "fill-zinc-900 dark:fill-white",
    bandClass: "fill-zinc-900/10 dark:fill-white/10",
    swatchClass: "bg-zinc-900 dark:bg-white",
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
        title: "Optimal for quality sessions",
        sub: "Good day for intervals or tempo. Heat won't be a limiter.",
      };
    }
    return {
      title: "Low risk",
      sub: "Drink 4–8 oz every 15–20 min. Quality sessions can go as planned.",
    };
  }
  if (zoneName === "yellow") {
    return {
      title: "Moderate risk",
      sub: "Fine for easy mileage; ease off target paces on a quality session and add recovery.",
    };
  }
  if (zoneName === "red") {
    return {
      title: "High risk",
      sub: "Shift quality sessions to a treadmill or cooler part of the day, or run easy by effort only.",
    };
  }
  return {
    title: "Extreme risk — black flag",
    sub: "Move training indoors or postpone. Heat stroke risk is too high for outdoor work at this level.",
  };
}

async function geocodeCity(query: string): Promise<LocationMeta> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`,
  );
  if (!res.ok) throw new Error("Location lookup failed.");
  const data: GeocodeResponse = await res.json();
  const result = data.results?.[0];
  if (!result) throw new Error("No matching location found.");
  return {
    lat: result.latitude,
    lon: result.longitude,
    label: [result.name, result.admin1, result.country]
      .filter(Boolean)
      .join(", "),
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

export function HeatTracker() {
  const [cityInput, setCityInput] = useState("");
  const [message, setMessage] = useState("Trying your device location…");
  const [series, setSeries] = useState<WbgtPoint[] | null>(null);
  const [meta, setMeta] = useState<LocationMeta | null>(null);
  const [clock, setClock] = useState("");

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
    ?.map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${xForIndex(index).toFixed(1)},${yForValue(point.wbgtC).toFixed(1)}`,
    )
    .join(" ");

  const areaPath =
    series && linePath
      ? `${linePath} L${xForIndex(series.length - 1).toFixed(1)},${CHART_HEIGHT - PAD_BOTTOM} L${xForIndex(0).toFixed(1)},${CHART_HEIGHT - PAD_BOTTOM} Z`
      : undefined;

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
          <input
            type="text"
            value={cityInput}
            onChange={(event) => setCityInput(event.target.value)}
            placeholder="Enter a city, e.g. Phoenix, AZ"
            autoComplete="off"
            className="min-w-[180px] flex-1 rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm text-zinc-900 transition focus:ring-2 focus:ring-zinc-900 focus:outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
          />
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
          <p className="font-heading text-6xl font-semibold tracking-tight text-zinc-900 sm:text-7xl dark:text-white">
            {current ? cToF(current.wbgtC).toFixed(1) : "—"}
            <span className="ml-1 text-2xl font-normal text-zinc-600 dark:text-zinc-300">
              °F
            </span>
          </p>
          <p
            className={`font-heading mt-3 text-xl font-semibold ${
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
        <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
          {series && linePath && areaPath ? (
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="h-auto w-full"
            >
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
                  <g key={step}>
                    <line
                      x1={PAD_LEFT}
                      y1={y}
                      x2={CHART_WIDTH - PAD_RIGHT}
                      y2={y}
                      strokeWidth="1"
                      className="stroke-black/10 dark:stroke-white/10"
                    />
                    <text
                      x={PAD_LEFT - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-zinc-600 text-[10.5px] dark:fill-zinc-300"
                    >
                      {cToF(value).toFixed(0)}°
                    </text>
                  </g>
                );
              })}

              {series.map((point, index) => {
                if (point.time.getHours() % 6 !== 0) return null;
                return (
                  <g key={point.time.toISOString()}>
                    <line
                      x1={xForIndex(index)}
                      y1={PAD_TOP}
                      x2={xForIndex(index)}
                      y2={CHART_HEIGHT - PAD_BOTTOM}
                      strokeWidth="1"
                      className="stroke-black/10 dark:stroke-white/10"
                    />
                    <text
                      x={xForIndex(index)}
                      y={CHART_HEIGHT - PAD_BOTTOM + 16}
                      textAnchor="middle"
                      className="fill-zinc-600 text-[10px] dark:fill-zinc-300"
                    >
                      {point.time.toLocaleTimeString(undefined, {
                        hour: "numeric",
                      })}
                    </text>
                  </g>
                );
              })}

              {BLACK_FLAG_C >= minValue && BLACK_FLAG_C <= maxValue && (
                <>
                  <line
                    x1={PAD_LEFT}
                    y1={yForValue(BLACK_FLAG_C)}
                    x2={CHART_WIDTH - PAD_RIGHT}
                    y2={yForValue(BLACK_FLAG_C)}
                    strokeWidth="1.5"
                    strokeDasharray="5,4"
                    className="stroke-zinc-900 dark:stroke-white"
                  />
                  <text
                    x={CHART_WIDTH - PAD_RIGHT}
                    y={yForValue(BLACK_FLAG_C) - 6}
                    textAnchor="end"
                    className="fill-zinc-900 text-[10.5px] dark:fill-white"
                  >
                    {cToF(BLACK_FLAG_C).toFixed(0)}°F — take training indoors
                  </text>
                </>
              )}

              <path
                d={areaPath}
                opacity={0.08}
                className={zone ? zone.fillClass : "fill-zinc-900"}
              />
              <path
                d={linePath}
                fill="none"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                className="stroke-zinc-900 dark:stroke-white"
              />

              {series.map((point, index) => {
                if (index % 3 !== 0) return null;
                const pointZone = zoneFor(point.wbgtC);
                return (
                  <circle
                    key={point.time.toISOString()}
                    cx={xForIndex(index)}
                    cy={yForValue(point.wbgtC)}
                    r="2.6"
                    className={pointZone.fillClass}
                  />
                );
              })}
            </svg>
          ) : (
            <p className="py-12 text-center text-sm text-zinc-600 dark:text-zinc-300">
              Waiting on a forecast to plot…
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-zinc-600 dark:text-zinc-300">
        <span className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${ZONES[0].swatchClass}`} />
          Green flag — under {cToF(ZONES[0].maxC).toFixed(0)}°F: train as
          planned
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${ZONES[1].swatchClass}`} />
          Yellow flag — {cToF(ZONES[0].maxC).toFixed(0)}–
          {cToF(ZONES[1].maxC).toFixed(0)}°F: ease off quality sessions
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${ZONES[2].swatchClass}`} />
          Red flag — {cToF(ZONES[1].maxC).toFixed(0)}–
          {cToF(ZONES[2].maxC).toFixed(0)}°F: move quality sessions indoors
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${ZONES[3].swatchClass}`} />
          Black flag — above {cToF(ZONES[2].maxC).toFixed(0)}°F: skip outdoor
          training
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
            <p className="font-heading mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
              {current ? `${cToF(current.tempC).toFixed(1)}°F` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
            <p className="text-[10.5px] tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
              Relative humidity
            </p>
            <p className="font-heading mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
              {current ? `${current.rh}%` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
            <p className="text-[10.5px] tracking-wide text-zinc-600 uppercase dark:text-zinc-300">
              WBGT estimate
            </p>
            <p
              className={`font-heading mt-1 text-2xl font-semibold ${
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
        <h2 className="font-heading text-lg font-semibold text-zinc-900 dark:text-white">
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
          vapor pressure derived from relative humidity. It&rsquo;s a solid
          stand-in when there&rsquo;s no physical sensor on hand, but it
          doesn&rsquo;t yet account for wind speed or direct sun, so on very
          sunny, still days the real WBGT may run a bit higher than shown
          here.
        </p>
        <p>
          The flag categories and training notes follow the American College
          of Sports Medicine&rsquo;s WBGT guidelines: green flag is a green
          light for whatever&rsquo;s on the schedule, yellow flag calls for
          easing off quality sessions (intervals, tempo, track work) while
          easy mileage stays fine, red flag means shifting quality sessions
          to a treadmill or a cooler window of the day, and black flag is the
          point where outdoor training itself carries real heat-illness risk.
          The 48-hour outlook is there to help pick which window — this
          afternoon, tomorrow morning — is the better time for a track
          session or long run.
        </p>
        <p>
          This is general sports-science guidance, not a substitute for a
          coach&rsquo;s judgment — heat illness can escalate quickly during
          hard efforts, so when conditions sit near a flag boundary,
          it&rsquo;s worth erring conservative and listening to how the body
          actually feels that day.
        </p>
      </div>

      <p className="border-t border-black/10 pt-4 text-xs text-zinc-600 dark:border-white/10 dark:text-zinc-300">
        Data: Open-Meteo forecast &amp; geocoding APIs · Formula: Australian
        Bureau of Meteorology outdoor WBGT approximation · Flag categories:
        ACSM heat guidelines · No data is stored anywhere.
      </p>
    </div>
  );
}
