"use client";

import { useState } from "react";

import { useLocationSearch, type LocationSearch } from "@/lib/use-location-search";
import {
  fetchConditionsAtTime,
  fetchConditionsWindow,
  fetchCurrentConditions,
  fetchUtcOffsetSeconds,
  summarizeWeatherWindow,
  type WeatherConditions,
} from "@/lib/environmental/fetch-weather-conditions";
import type { RouteSource } from "@/lib/route-import/types";

export type WhenMode = "now" | "specific";

type UseEnvironmentalWeatherResult = {
  locationSearch: LocationSearch;
  /**
   * The single representative value every existing engine (heat, humidity,
   * wind) consumes, unchanged -- for a route import this is the average
   * across weatherWindowPoints (see summarizeWeatherWindow), for every
   * other path it's the one fetched snapshot, same as before this field
   * had a window to be averaged from at all.
   */
  fetchedConditions: WeatherConditions | null;
  /**
   * Every real hourly reading Open-Meteo has across the imported route's
   * own actual [start, start+duration] window -- null when weather was
   * fetched for a single instant instead (manual road/track location
   * search, or a route with no resolvable duration yet). A length-1 array
   * is a genuine, real single observation, not a fabricated range -- the
   * UI must not present it as a range (see environmental-calculator.tsx).
   */
  weatherWindowPoints: WeatherConditions[] | null;
  weatherMessage: string;
  weatherLocation: string | null;
  /** Resolved coordinates behind weatherLocation -- exposed so callers can auto-detect terrain exposure for the same spot without asking the user to search again. */
  resolvedLat: number | null;
  resolvedLon: number | null;
  whenMode: WhenMode;
  setWhenMode: (mode: WhenMode) => void;
  /** Raw value of a `<input type="datetime-local">`, e.g. "2026-07-20T07:30". */
  whenInput: string;
  setWhenInput: (value: string) => void;
  /**
   * Fetches weather directly from an imported route's own centroid and
   * start time -- no location search or manual date/time entry needed,
   * since the activity itself is the source of truth for "where" and
   * "when." Handles the Strava-vs-file timestamp quirk internally (see
   * RouteSummary.startTimeIso). `durationSeconds`, when known (it always
   * is for a loaded route -- see handleRouteLoaded), fetches every real
   * hourly reading across the run's own actual time window instead of one
   * instant; omit it (or pass null) to fall back to the single-snapshot
   * behavior every other path already used.
   */
  applyRouteLocation: (
    lat: number,
    lon: number,
    startTimeIso: string | null,
    source: RouteSource,
    durationSeconds?: number | null,
  ) => void;
};

// Started as a mirror of use-wind-weather.ts, fetching the full condition
// set (temperature, humidity, dew point, cloud cover, pressure, wind) the
// Environmental Performance Calculator's engines need in one call rather
// than one per factor. applyRouteLocation now also has an optional
// window-fetch path (see runFetch's own durationSeconds branch) for when
// an imported route's real duration is known -- every other caller here
// (manual location search, a route with no resolvable duration) still
// takes the original single-snapshot path, unchanged.
export function useEnvironmentalWeather(): UseEnvironmentalWeatherResult {
  const [fetchedConditions, setFetchedConditions] = useState<WeatherConditions | null>(null);
  const [weatherWindowPoints, setWeatherWindowPoints] = useState<WeatherConditions[] | null>(null);
  const [weatherMessage, setWeatherMessage] = useState("");
  const [weatherLocation, setWeatherLocation] = useState<string | null>(null);
  const [resolvedLocation, setResolvedLocation] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [whenMode, setWhenModeRaw] = useState<WhenMode>("now");
  const [whenInput, setWhenInputRaw] = useState("");

  // durationSeconds is only ever passed by applyRouteLocation (a route's
  // own real, already-known duration) -- the location-search/date-picker
  // path below never has a run duration to offer, so it always stays on
  // the single-snapshot fetch, unchanged from before this window capability existed.
  function runFetch(lat: number, lon: number, label: string, mode: WhenMode, when: string, durationSeconds?: number | null) {
    if (mode === "specific" && !when) {
      setWeatherMessage(`Location set to ${label}. Pick a date and time to fetch conditions for it.`);
      return;
    }

    if (mode === "specific" && durationSeconds !== null && durationSeconds !== undefined && durationSeconds > 0) {
      setWeatherMessage("Fetching conditions across your run…");
      fetchConditionsWindow(lat, lon, when, durationSeconds)
        .then((points) => {
          setWeatherWindowPoints(points);
          setFetchedConditions(summarizeWeatherWindow(points));
          setWeatherLocation(label);
          setWeatherMessage(
            points.length > 1
              ? `Using ${points.length} hourly readings for ${label} across your run`
              : `Using conditions for ${label} at that time`,
          );
        })
        .catch((error) => {
          setWeatherMessage(error instanceof Error ? error.message : "Could not fetch weather data.");
        });
      return;
    }

    setWeatherMessage(mode === "now" ? "Fetching current conditions…" : "Fetching conditions for that date…");
    const request = mode === "now" ? fetchCurrentConditions(lat, lon) : fetchConditionsAtTime(lat, lon, when);
    request
      .then((conditions) => {
        setWeatherWindowPoints(null);
        setFetchedConditions(conditions);
        setWeatherLocation(label);
        setWeatherMessage(mode === "now" ? `Using live conditions for ${label}` : `Using conditions for ${label} at that time`);
      })
      .catch((error) => {
        setWeatherMessage(error instanceof Error ? error.message : "Could not fetch weather data.");
      });
  }

  const locationSearch = useLocationSearch({
    autoGeolocateOnMount: false,
    setStatusMessage: setWeatherMessage,
    onResolved: (lat, lon, label) => {
      setResolvedLocation({ lat, lon, label });
      runFetch(lat, lon, label, whenMode, whenInput);
    },
  });

  function setWhenMode(mode: WhenMode) {
    setWhenModeRaw(mode);
    if (resolvedLocation) runFetch(resolvedLocation.lat, resolvedLocation.lon, resolvedLocation.label, mode, whenInput);
  }

  function setWhenInput(value: string) {
    setWhenInputRaw(value);
    if (resolvedLocation) runFetch(resolvedLocation.lat, resolvedLocation.lon, resolvedLocation.label, whenMode, value);
  }

  function applyRouteLocation(
    lat: number,
    lon: number,
    startTimeIso: string | null,
    source: RouteSource,
    durationSeconds: number | null = null,
  ) {
    const label = `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
    setResolvedLocation({ lat, lon, label });

    if (!startTimeIso) {
      setWhenModeRaw("now");
      setWhenInputRaw("");
      runFetch(lat, lon, label, "now", "");
      return;
    }

    setWhenModeRaw("specific");
    if (source === "strava") {
      // Strava's start_date_local is local wall-clock time mislabeled with
      // a "Z" suffix -- its digits already ARE the local reading, so no
      // conversion is needed, just trim to datetime-local's precision.
      const localDateTime = startTimeIso.slice(0, 16);
      setWhenInputRaw(localDateTime);
      runFetch(lat, lon, label, "specific", localDateTime, durationSeconds);
      return;
    }

    // GPX/TCX/FIT timestamps are genuine UTC instants -- shift by the
    // location's UTC offset to get the naive local wall-clock reading
    // fetchConditionsAtTime expects. Falls back to the raw UTC digits
    // (better than nothing) if the offset lookup itself fails.
    fetchUtcOffsetSeconds(lat, lon).then((offsetSeconds) => {
      const shiftedMs = new Date(startTimeIso).getTime() + (offsetSeconds ?? 0) * 1000;
      const localDateTime = new Date(shiftedMs).toISOString().slice(0, 16);
      setWhenInputRaw(localDateTime);
      runFetch(lat, lon, label, "specific", localDateTime, durationSeconds);
    });
  }

  return {
    locationSearch,
    fetchedConditions,
    weatherWindowPoints,
    weatherMessage,
    weatherLocation,
    resolvedLat: resolvedLocation?.lat ?? null,
    resolvedLon: resolvedLocation?.lon ?? null,
    whenMode,
    setWhenMode,
    whenInput,
    setWhenInput,
    applyRouteLocation,
  };
}
