import { createClient } from "@/lib/db/server";
import { createOrRefreshAdaptationCards, listPendingAdaptationCardsForCoach, type AdaptationCardRow } from "@/lib/private-coaching/adaptation-cards-service";
import { todayForViewer } from "@/lib/viewer-timezone";

export type CoachAdaptationCard = AdaptationCardRow & { athleteDisplayName: string };

// Coach home's own batched surface for adaptation cards -- runs the
// signal engine for every active athlete on the roster (so a coach who
// never opens a given athlete's schedule page still sees a card the
// moment it fires), then returns every currently-pending card with its
// athlete's display name attached, newest first. Deliberately a separate
// loader from loadCoachHomeData (coach-home-data.ts) rather than folded
// into it -- that function's queries/shape are tightly coupled to
// attention-flag computation with exactly one caller, and this loader's
// own per-athlete engine run is a meaningfully different shape of work.
export async function loadAdaptationCardsForCoach(coachId: string): Promise<CoachAdaptationCard[]> {
  const supabase = await createClient();
  const today = await todayForViewer();

  const { data: relationships } = await supabase
    .from("coach_athletes")
    .select("athlete_id")
    .eq("coach_id", coachId)
    .eq("status", "active")
    .returns<{ athlete_id: string }[]>();

  const athleteIds = (relationships ?? []).map((r) => r.athlete_id);
  if (athleteIds.length === 0) return [];

  await Promise.all(athleteIds.map((athleteId) => createOrRefreshAdaptationCards(supabase, athleteId, coachId, today)));

  const [cards, { data: profiles }] = await Promise.all([
    listPendingAdaptationCardsForCoach(supabase, coachId),
    supabase.from("profiles").select("id, display_name").in("id", athleteIds).returns<{ id: string; display_name: string }[]>(),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  return cards.map((card) => ({ ...card, athleteDisplayName: nameById.get(card.athlete_id) ?? "Athlete" }));
}
