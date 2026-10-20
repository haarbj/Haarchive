import { afterEach, describe, expect, it, vi } from "vitest";

import { createScriptedSupabaseClient } from "./supabase-test-utils";

// Mirrors publish-workouts-action.test.ts's own scripted-client pattern.
// unstable_cache is mocked to a pass-through identity function (no real
// caching needed for these tests, and a real cache would leak state
// across runs since the cache key is lat/lon/date-based).

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/environmental/fetch-weather-conditions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/environmental/fetch-weather-conditions")>();
  return { ...actual, fetchCurrentConditions: vi.fn(), fetchConditionsWindow: vi.fn() };
});
vi.mock("@/lib/geocode", () => ({ geocodeCity: vi.fn() }));

import { createClient } from "@/lib/db/server";
import { fetchCurrentConditions, fetchConditionsWindow, type WeatherConditions } from "@/lib/environmental/fetch-weather-conditions";
import { geocodeCity } from "@/lib/geocode";
import {
  buildTodayConditionsCard,
  resolveStoredLocation,
  type TodayWorkoutInput,
} from "@/app/(app)/(protected)/plan/today-conditions-service";
import { conditionsAdjustedPaceSPerMi } from "@/lib/private-coaching/today-conditions";
import { formatClock } from "@/lib/running-format";

afterEach(() => {
  vi.clearAllMocks();
});

function conditions(overrides: Partial<WeatherConditions> = {}): WeatherConditions {
  return {
    tempC: 15,
    relativeHumidityPct: 40,
    dewPointC: 5,
    cloudCoverPct: 20,
    pressureHPa: 1013,
    windSpeedMS: 2,
    windFromBearingDeg: 90,
    windGustsMS: 3,
    elevationM: 100,
    source: "forecast",
    ...overrides,
  };
}

describe("buildTodayConditionsCard", () => {
  it("an easy workout with no resolved pace gets the conditions line only, no adjustment", async () => {
    vi.mocked(fetchCurrentConditions).mockResolvedValue(conditions());
    vi.mocked(fetchConditionsWindow).mockResolvedValue([conditions()]);

    const workouts: TodayWorkoutInput[] = [{ id: "w-1", dayLabel: "Easy", title: null, resolvedPaceMinSPerMi: null }];
    const card = await buildTodayConditionsCard(35, -80, "Atlanta, GA", "2026-07-20", workouts);

    expect(card).not.toBeNull();
    expect(card!.workouts[0].plannedPaceText).toBeNull();
    expect(card!.workouts[0].adjustedPaceText).toBeNull();
  });

  it("a pace-target workout gets a real adjustment equal to a direct engine call with the same conditions", async () => {
    const hotConditions = conditions({ tempC: 29, relativeHumidityPct: 60 });
    vi.mocked(fetchCurrentConditions).mockResolvedValue(hotConditions);
    vi.mocked(fetchConditionsWindow).mockResolvedValue([hotConditions]);

    const workouts: TodayWorkoutInput[] = [{ id: "w-2", dayLabel: "Tempo", title: null, resolvedPaceMinSPerMi: 370 }];
    const card = await buildTodayConditionsCard(35, -80, "Atlanta, GA", "2026-07-20", workouts);

    const expectedAdjusted = conditionsAdjustedPaceSPerMi(370, hotConditions);
    expect(card!.workouts[0].plannedPaceText).toBe(`${formatClock(370)}/mi`);
    expect(card!.workouts[0].adjustedPaceText).toBe(`${formatClock(Math.round(expectedAdjusted))}/mi`);
  });

  it("heat caution appears only once conditions cross the reused materiality threshold", async () => {
    const mild = conditions({ tempC: 15 });
    vi.mocked(fetchCurrentConditions).mockResolvedValue(mild);
    vi.mocked(fetchConditionsWindow).mockResolvedValue([mild]);
    const mildCard = await buildTodayConditionsCard(35, -80, "Atlanta, GA", "2026-07-20", []);
    expect(mildCard!.heatCaution).toBeNull();

    const hot = conditions({ tempC: 32, relativeHumidityPct: 70 });
    vi.mocked(fetchCurrentConditions).mockResolvedValue(hot);
    vi.mocked(fetchConditionsWindow).mockResolvedValue([hot]);
    const hotCard = await buildTodayConditionsCard(35, -80, "Atlanta, GA", "2026-07-20", []);
    expect(hotCard!.heatCaution).not.toBeNull();
  });

  it("the peak-heat window picks the hottest reading, not the current one, for the caution/peak-temp figures", async () => {
    const current = conditions({ tempC: 18 });
    const peak = conditions({ tempC: 32, relativeHumidityPct: 65 });
    vi.mocked(fetchCurrentConditions).mockResolvedValue(current);
    vi.mocked(fetchConditionsWindow).mockResolvedValue([current, peak, conditions({ tempC: 22 })]);

    const card = await buildTodayConditionsCard(35, -80, "Atlanta, GA", "2026-07-20", []);
    expect(card!.currentTempF).toBe(Math.round((18 * 9) / 5 + 32));
    expect(card!.peakTempF).toBe(Math.round((32 * 9) / 5 + 32));
    expect(card!.heatCaution).not.toBeNull(); // driven by the peak, not the current (mild) reading
  });

  it("weather-fetch failure returns null -- absent entirely, never a fabricated card", async () => {
    vi.mocked(fetchCurrentConditions).mockRejectedValue(new Error("Open-Meteo unavailable"));
    const card = await buildTodayConditionsCard(35, -80, "Atlanta, GA", "2026-07-20", []);
    expect(card).toBeNull();
  });
});

describe("resolveStoredLocation", () => {
  it("null when the athlete has no city on file", async () => {
    const { client } = createScriptedSupabaseClient(
      [{ table: "athlete_profiles", result: { data: { city: null, state: null, country: null }, error: null } }],
      "athlete-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);
    expect(await resolveStoredLocation("athlete-1")).toBeNull();
    expect(geocodeCity).not.toHaveBeenCalled();
  });

  it("geocodes a stored city/state into real coordinates", async () => {
    const { client } = createScriptedSupabaseClient(
      [{ table: "athlete_profiles", result: { data: { city: "Nashville", state: "TN", country: "US" }, error: null } }],
      "athlete-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(geocodeCity).mockResolvedValue({ lat: 36.17, lon: -86.78, label: "Nashville, Tennessee, United States" });

    const result = await resolveStoredLocation("athlete-1");
    expect(result).toEqual({ lat: 36.17, lon: -86.78, label: "Nashville, Tennessee, United States" });
    expect(geocodeCity).toHaveBeenCalledWith("Nashville, TN");
  });

  it("null (never throws) when geocoding the stored city fails", async () => {
    const { client } = createScriptedSupabaseClient(
      [{ table: "athlete_profiles", result: { data: { city: "Nowhereville", state: null, country: null }, error: null } }],
      "athlete-1",
    );
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(geocodeCity).mockRejectedValue(new Error("No matching location found."));

    expect(await resolveStoredLocation("athlete-1")).toBeNull();
  });
});
