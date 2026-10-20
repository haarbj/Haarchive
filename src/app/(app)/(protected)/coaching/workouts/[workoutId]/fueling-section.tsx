import { formatHoursMinutes, formatMilesLabel, type WorkoutFuelingCard } from "@/lib/private-coaching/workout-fueling";

// Fueling plans attached to workouts: a pure, server-rendered display of
// whatever buildWorkoutFuelingCard computed for this workout, right now,
// from its current planned distance/duration/type/RPE. No interactivity,
// no fetch of its own -- the athlete and the coach see the exact same
// card because both render this same component from the same adapter
// call (see page.tsx's own call site). Absent entirely (page.tsx never
// renders this component at all) when the workout isn't eligible -- no
// "fueling doesn't apply" message, just nothing, the same "no nag"
// discipline conditions-section.tsx already established for a non-
// Strava completion.
export function FuelingSection({ card }: { card: WorkoutFuelingCard }) {
  const distanceLabel = formatMilesLabel(card.distanceM);
  const tieIn = [distanceLabel ? `${card.label}, ${distanceLabel}` : card.label, `~${formatHoursMinutes(card.durationMinutes)}`]
    .filter(Boolean)
    .join(" — ");

  const preRun = card.schedule[0]?.note?.includes("pre-load") ? card.schedule[0] : null;
  const inRun = preRun ? card.schedule.slice(1) : card.schedule;

  return (
    <div className="mt-8">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Fueling</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">For this {tieIn}</p>

      <div className="mt-3 space-y-4">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-900 dark:text-white">
          <p>
            <span className="font-semibold">{card.totalCarbsG}g</span> carbs total (
            <span className="font-semibold">{card.carbsPerHourGPerHour}g/hr</span>)
          </p>
          <p>
            <span className="font-semibold">{card.fluidPerHourMl}mL/hr</span> fluid
          </p>
          <p>
            <span className="font-semibold">{card.sodiumPerHourMg}mg/hr</span> sodium
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase dark:text-zinc-400">Schedule</p>
          <ul className="mt-1.5 space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
            {preRun ? (
              <li>
                <span className="font-semibold text-zinc-900 dark:text-white">Before you start:</span> {preRun.note}
              </li>
            ) : null}
            {inRun.length > 0 ? (
              inRun.map((entry) => (
                <li key={entry.minute}>
                  <span className="font-semibold text-zinc-900 dark:text-white">~{entry.minute} min:</span> {entry.product.name} (~
                  {entry.carbsG}g carbs{entry.fluidMl > 0 ? `, ~${entry.fluidMl}mL fluid` : ""}, ~{entry.sodiumMg}mg sodium)
                  {entry.note && !entry.note.includes("pre-load") ? ` — ${entry.note}` : ""}
                </li>
              ))
            ) : (
              <li>Nothing scheduled beyond the pre-run dose above -- this session is short enough that one serving covers it.</li>
            )}
          </ul>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Based on {card.product.name} ({card.product.carbsPerServingG}g carbs, {card.product.sodiumPerServingMg}mg sodium per serving)
          {card.weightSource === "default" ? " and a default body weight (no weight on file)" : ""}.
        </p>
      </div>
    </div>
  );
}
