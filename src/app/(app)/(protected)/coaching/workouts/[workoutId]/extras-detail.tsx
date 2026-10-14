import type { WorkoutExtraInput } from "@/lib/private-coaching/extras";
import { Card } from "@/components/ui/card";

// Athlete-facing detail for a workout's extras (strides/drills/plyos/
// strength). A native <details open> disclosure per extra -- expanded by
// default so a new athlete can read the full detail, collapsible
// ("undrop") once they know the routine, to cut down on-screen text for a
// repeat athlete. No JS state beyond the browser's own toggle; nothing to
// persist across page loads.
export function ExtrasDetail({ extras }: { extras: WorkoutExtraInput[] }) {
  if (extras.length === 0) return null;

  return (
    <div className="space-y-3">
      {extras.map((extra, index) => {
        const meta = [
          extra.count != null ? `${extra.count}x` : null,
          extra.distanceM != null ? `${extra.distanceM}m` : null,
          extra.durationS != null ? `${extra.durationS}s` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <Card key={index} padding="md">
            <details open>
              <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-white">
                {extra.kind}
                {meta ? <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">{meta}</span> : null}
              </summary>
              <div className="mt-2">
                {extra.overview ? <p className="text-sm text-zinc-600 dark:text-zinc-300">{extra.overview}</p> : null}
                {extra.items.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
                    {extra.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </details>
          </Card>
        );
      })}
    </div>
  );
}
