"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { fetchGeocodeCandidates, geocodeCity, geocodeLabel, type GeocodeResult } from "@/lib/geocode";

type UseLocationSearchOptions = {
  // Called once a location is resolved, whether from geolocation, a picked
  // suggestion, or a submitted search -- the consumer owns what happens
  // next (fetch a forecast, fetch current wind, etc.).
  onResolved: (lat: number, lon: number, label: string) => void;
  // The hook narrates its own progress (asking for location, looking a
  // city up, permission denied, no matches) through this setter rather
  // than owning a "message" state itself, so a single status string can
  // keep flowing seamlessly into whatever the consumer's own async work
  // reports next ("Fetching forecast...", "Showing Nashville, TN", etc.).
  setStatusMessage: (message: string) => void;
  // Attempt browser geolocation once, on mount -- on by default since
  // that's the common case (heat-tracker, wind lookups); pass false for a
  // tool where the user should search deliberately instead.
  autoGeolocateOnMount?: boolean;
};

// Shared by any tool that needs "type a city, get a lat/lon" with
// autocomplete -- extracted out of heat-tracker.tsx so wind-calculator.tsx
// and track-wind-calculator.tsx don't each grow their own copy of this
// debounced-suggestions/keyboard-nav/geolocation state machine.
export function useLocationSearch({
  onResolved,
  setStatusMessage,
  autoGeolocateOnMount = true,
}: UseLocationSearchOptions) {
  const [cityInput, setCityInputRaw] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionRequestId = useRef(0);
  const skipNextSuggestionFetch = useRef(false);
  const baseId = useId();
  const listboxId = `location-search-${baseId}`;

  function setCityInput(value: string) {
    setCityInputRaw(value);
    const [namePart] = value.split(",");
    if (namePart.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }

  function attemptGeolocation() {
    if (!navigator.geolocation) {
      setStatusMessage("Your browser doesn't support location lookup — search for a city instead.");
      return;
    }
    setStatusMessage("Asking for your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onResolved(latitude, longitude, `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`);
      },
      () => {
        setStatusMessage("Location access was blocked — search for a city above instead.");
      },
      { timeout: 8000 },
    );
  }

  useEffect(() => {
    if (autoGeolocateOnMount) attemptGeolocation();
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

  function selectSuggestion(result: GeocodeResult) {
    const label = geocodeLabel(result);
    skipNextSuggestionFetch.current = true;
    setCityInputRaw(label);
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    onResolved(result.latitude, result.longitude, label);
  }

  async function handleSearch() {
    const query = cityInput.trim();
    if (!query) {
      setStatusMessage("Type a city name first.");
      return;
    }
    setStatusMessage("Looking that up…");
    try {
      const location = await geocodeCity(query);
      onResolved(location.lat, location.lon, location.label);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not find that location.");
    }
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
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
  }

  return {
    cityInput,
    setCityInput,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    suggestionsLoading,
    highlightedIndex,
    setHighlightedIndex,
    listboxId,
    selectSuggestion,
    attemptGeolocation,
    handleSearch,
    handleInputKeyDown,
  };
}

export type LocationSearch = ReturnType<typeof useLocationSearch>;
