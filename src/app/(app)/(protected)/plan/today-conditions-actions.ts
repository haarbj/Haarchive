"use server";

import { getAppSession } from "@/lib/auth/session";
import { buildTodayConditionsCard, type TodayConditionsCardData, type TodayWorkoutInput } from "./today-conditions-service";

// The one quiet, explicit "use my location" affordance (see
// today-conditions-geolocation.tsx) -- there is no second prompt
// anywhere, and this never runs automatically on page load. Browser
// geolocation itself can only ever run client-side (navigator.
// geolocation), so this action exists purely to move the weather fetch
// and the pace adjustment back onto the server once the browser has
// resolved real coordinates, matching every other weather-fetch call
// site on this page.
export async function fetchTodayConditionsForCoordinates(
  lat: number,
  lon: number,
  todayDate: string,
  workouts: TodayWorkoutInput[],
): Promise<TodayConditionsCardData | null> {
  const session = await getAppSession();
  if (!session) return null;

  // workouts is already exactly what this athlete's own /plan page just
  // rendered to them server-side (see plan-view.tsx's own fetch) -- this
  // action only ever adds weather/pace-adjustment math on top of data
  // the caller already has, never a second, independently-authorized
  // data fetch.
  return buildTodayConditionsCard(lat, lon, `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, todayDate, workouts);
}
