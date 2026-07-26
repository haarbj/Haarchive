import { createClient } from "@/lib/db/client";

export type ProfileFitnessSnapshot = {
  age: number | null;
  weightLb: number | null;
  recentRace: { distanceM: number; timeSeconds: number; raceName: string | null } | null;
};

export function ageFromBirthYear(birthYear: number | null | undefined): number | null {
  if (birthYear == null) return null;
  return new Date().getFullYear() - birthYear;
}

export function kgToLbs(kg: number): number {
  return kg / 0.453592;
}

// Client-side by necessity: the calculators that would consume this render
// on statically-generated /[slug] pages (same HTML for every visitor), so
// there's no per-request server render to inject a signed-in user's data
// into -- unlike the plan/goal pages, which fetch this kind of thing
// server-side because those routes are genuinely dynamic. Returns null for
// a signed-out visitor rather than throwing, since "no profile to load" is
// an expected, non-error outcome here.
export async function loadProfileFitnessSnapshot(): Promise<ProfileFitnessSnapshot | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: races }] = await Promise.all([
    supabase.from("athlete_profiles").select("birth_year, weight_kg").maybeSingle(),
    supabase.from("race_results").select("distance_m, finish_time_s, race_name").order("race_date", { ascending: false }).limit(1),
  ]);

  const recent = races?.[0];

  return {
    age: ageFromBirthYear(profile?.birth_year),
    weightLb: profile?.weight_kg != null ? kgToLbs(profile.weight_kg) : null,
    recentRace: recent ? { distanceM: recent.distance_m, timeSeconds: recent.finish_time_s, raceName: recent.race_name } : null,
  };
}
