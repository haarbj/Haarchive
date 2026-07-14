"use client";

import { useState } from "react";

import { useLocationSearch, type LocationSearch } from "@/lib/use-location-search";
import {
  fetchConditionsAtTime,
  fetchCurrentConditions,
  fetchUtcOffsetSeconds,
  type WeatherConditions,
} from "@/lib/environmental/fetch-weather-conditions";
import type { RouteSource } from "@/lib/route-import/types";

export type WhenMode = "now" | "specific";

type UseEnvironmentalWeatherResult = {
  locationSearch: LocationSearch;
  fetchedConditions: WeatherConditions | null;
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
   * RouteSummary.startTimeIso).
   */
  applyRouteLocation: (lat: number, lon: number, startTimeIso: string | null, source: RouteSource) => void;
};

// Mirrors use-wind-weather.ts exactly, but fetches the full condition set
// (temperature, humidity, dew point, cloud cover, pressure, wind) that the
// Environmental Performance Calculator's engines need, in one call rather
// than one per factor.
export function useEnvironmentalWeather(): UseEnvironmentalWeatherResult {
  const [fetchedConditions, setFetchedConditions] = useState<WeatherConditions | null>(null);
  const [weatherMessage, setWeatherMessage] = useState("");
  const [weatherLocation, setWeatherLocation] = useState<string | null>(null);
  const [resolvedLocation, setResolvedLocation] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [whenMode, setWhenModeRaw] = useState<WhenMode>("now");
  const [whenInput, setWhenInputRaw] = useState("");

  function runFetch(lat: number, lon: number, label: string, mode: WhenMode, when: string) {
    if (mode === "specific" && !when) {
      setWeatherMessage(`Location set to ${label} — pick a date and time to fetch conditions for it.`);
      return;
    }
    setWeatherMessage(mode === "now" ? "Fetching current conditions…" : "Fetching conditions for that date…");
    const request = mode === "now" ? fetchCurrentConditions(lat, lon) : fetchConditionsAtTime(lat, lon, when);
    request
      .then((conditions) => {
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

  function applyRouteLocation(lat: number, lon: number, startTimeIso: string | null, source: RouteSource) {
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
      runFetch(lat, lon, label, "specific", localDateTime);
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
      runFetch(lat, lon, label, "specific", localDateTime);
    });
  }

  return {
    locationSearch,
    fetchedConditions,
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
