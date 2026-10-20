// Today's conditions guidance -- the Supabase/weather-fetch-touching
// orchestration. Pure composition (the engines, the pace adjustment, the
// materiality threshold) lives in today-conditions.ts; this file only
// resolves a location, fetches weather for it, and shapes the result
// into what today-conditions-card.tsx renders. No storage, no migration
// -- every call recomputes from scratch, cached only briefly (see
// getCachedTodayWeather below) to keep repeated page loads cheap.

import { unstable_cache } from "next/cache";

import { createClient } from "@/lib/db/server";
import { fetchCurrentConditions, fetchConditionsWindow, type WeatherConditions } from "@/lib/environmental/fetch-weather-conditions";
import { geocodeCity } from "@/lib/geocode";
import { conditionsAdjustedPaceSPerMi, heatCautionFor, peakHeatReading } from "@/lib/private-coaching/today-conditions";
import { cToF } from "@/lib/heat-physics";
import { getWorkoutDisplayLabel } from "@/lib/private-coaching/workout-status";
import { formatClock } from "@/lib/running-format";
import type { HeatGuidance } from "@/lib/heat-physics";
import type { CalendarWorkout } from "@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/calendar-types";

// The minimal shape this module (and the geolocation action/client
// component) actually needs from a CalendarWorkout -- kept narrow so the
// client->server action round-trip only ever passes what it has to,
// rather than the full CalendarWorkout shape (completion detail, steps,
// etc. this card never uses).
export type TodayWorkoutInput = Pick<CalendarWorkout, "id" | "dayLabel" | "title" | "resolvedPaceMinSPerMi">;

export type TodayWorkoutCard = {
  id: string;
  label: string;
  /** Null when this workout has no resolved pace target at all (e.g. easy/recovery by distance or duration only) -- the card shows the conditions line only, no adjustment. */
  plannedPaceText: string | null;
  adjustedPaceText: string | null;
};

export type TodayConditionsCardData = {
  locationLabel: string;
  currentTempF: number;
  peakTempF: number;
  heatCaution: HeatGuidance | null;
  workouts: TodayWorkoutCard[];
};

function buildWorkoutCards(workouts: TodayWorkoutInput[], conditionsForAdjustment: WeatherConditions): TodayWorkoutCard[] {
  return workouts.map((workout) => {
    const label = getWorkoutDisplayLabel(workout.dayLabel, workout.title);
    if (workout.resolvedPaceMinSPerMi == null) {
      return { id: workout.id, label, plannedPaceText: null, adjustedPaceText: null };
    }
    const plannedPaceSPerMi = workout.resolvedPaceMinSPerMi;
    const adjustedPaceSPerMi = conditionsAdjustedPaceSPerMi(plannedPaceSPerMi, conditionsForAdjustment);
    return {
      id: workout.id,
      label,
      plannedPaceText: `${formatClock(plannedPaceSPerMi)}/mi`,
      adjustedPaceText: `${formatClock(Math.round(adjustedPaceSPerMi))}/mi`,
    };
  });
}

// Open-Meteo's own fetch (fetch-weather-conditions.ts) is a plain,
// uncached fetch() -- fine for a one-off tool calculation, too chatty for
// a card rendered on every /plan load. This wraps it in a short,
// Next.js-level cache instead of touching that file's own fetch calls
// (out of scope -- "no engine changes"): a few minutes is plenty for a
// glanceable card, not a live ticker.
const getCachedTodayWeather = unstable_cache(
  async (lat: number, lon: number, todayDate: string) => {
    const [current, windowPoints] = await Promise.all([
      fetchCurrentConditions(lat, lon),
      fetchConditionsWindow(lat, lon, `${todayDate}T00:00`, 23 * 3600),
    ]);
    return { current, windowPoints };
  },
  ["today-conditions-weather"],
  { revalidate: 300 },
);

/**
 * The one entry point: given a resolved lat/lon and today's already-
 * published, already-pace-resolved workouts, fetches today's weather and
 * builds the card. Null on ANY failure (a bad fetch, no readings at all)
 * -- the card is simply absent, the page is otherwise unaffected, never
 * a fabricated result.
 */
export async function buildTodayConditionsCard(
  lat: number,
  lon: number,
  locationLabel: string,
  todayDate: string,
  workouts: TodayWorkoutInput[],
): Promise<TodayConditionsCardData | null> {
  try {
    const { current, windowPoints } = await getCachedTodayWeather(lat, lon, todayDate);
    const peak = peakHeatReading(windowPoints) ?? current;
    const workoutCards = buildWorkoutCards(workouts, current);
    return {
      locationLabel,
      currentTempF: Math.round(cToF(current.tempC)),
      peakTempF: Math.round(cToF(peak.tempC)),
      heatCaution: heatCautionFor(peak),
      workouts: workoutCards,
    };
  } catch {
    return null;
  }
}

type AthleteLocationProfile = { city: string | null; state: string | null; country: string | null };

/**
 * Stored-location tier of the fallback chain -- athlete_profiles.city/
 * state/country, geocoded the same way the Heat Tracker's own search
 * box resolves a typed city (geocode.ts, already server-callable: plain
 * fetch(), no client-only code). These columns exist on the very first
 * schema but no current form writes them (confirmed across this
 * codebase's settings UI) -- in practice this will almost always come
 * back null today, which is why the geolocation tier (today-conditions-
 * actions.ts) is the one that actually carries this feature day to day.
 * Null on no stored city, or on a geocoding miss -- never a guess.
 */
export async function resolveStoredLocation(athleteId: string): Promise<{ lat: number; lon: number; label: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("athlete_profiles")
    .select("city, state, country")
    .eq("user_id", athleteId)
    .maybeSingle<AthleteLocationProfile>();
  if (!data?.city) return null;

  try {
    const query = [data.city, data.state ?? data.country].filter(Boolean).join(", ");
    const result = await geocodeCity(query);
    return result;
  } catch {
    return null;
  }
}
