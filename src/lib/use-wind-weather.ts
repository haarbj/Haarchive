"use client";

import { useState } from "react";

import { useLocationSearch, type LocationSearch } from "@/lib/use-location-search";
import { fetchCurrentWind, fetchWindAtTime, type CurrentWind } from "@/lib/weather-wind";

export type WhenMode = "now" | "specific";

type UseWindWeatherResult = {
  locationSearch: LocationSearch;
  fetchedWind: CurrentWind | null;
  weatherMessage: string;
  weatherLocation: string | null;
  whenMode: WhenMode;
  setWhenMode: (mode: WhenMode) => void;
  /** Raw value of a `<input type="datetime-local">`, e.g. "2026-07-20T07:30". */
  whenInput: string;
  setWhenInput: (value: string) => void;
};

// Shared by wind-calculator.tsx and track-wind-calculator.tsx: search a
// city (or use device location), then fetch wind for either right now or
// a specific date/time -- past or future -- re-fetching automatically
// whenever the date/time or the "now vs. specific" choice changes, as
// long as a location has already been resolved once.
export function useWindWeather(): UseWindWeatherResult {
  const [fetchedWind, setFetchedWind] = useState<CurrentWind | null>(null);
  const [weatherMessage, setWeatherMessage] = useState("");
  const [weatherLocation, setWeatherLocation] = useState<string | null>(null);
  const [resolvedLocation, setResolvedLocation] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [whenMode, setWhenModeRaw] = useState<WhenMode>("now");
  const [whenInput, setWhenInputRaw] = useState("");

  function runFetch(lat: number, lon: number, label: string, mode: WhenMode, when: string) {
    if (mode === "specific" && !when) {
      setWeatherMessage(`Location set to ${label} — pick a date and time to fetch wind for it.`);
      return;
    }
    setWeatherMessage(mode === "now" ? "Fetching current wind…" : "Fetching wind for that date…");
    const request = mode === "now" ? fetchCurrentWind(lat, lon) : fetchWindAtTime(lat, lon, when);
    request
      .then((wind) => {
        setFetchedWind(wind);
        setWeatherLocation(label);
        setWeatherMessage(mode === "now" ? `Using live wind for ${label}` : `Using wind for ${label} at that time`);
      })
      .catch((error) => {
        setWeatherMessage(error instanceof Error ? error.message : "Could not fetch wind data.");
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

  return {
    locationSearch,
    fetchedWind,
    weatherMessage,
    weatherLocation,
    whenMode,
    setWhenMode,
    whenInput,
    setWhenInput,
  };
}
