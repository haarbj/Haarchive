import { exitViewAsAthlete } from "@/lib/private-coaching/view-as-actions";

// Persistent on every athlete surface while the mode is active -- never
// a dismissible toast, since "I forgot I was in view-as" is exactly the
// mistake a coach could otherwise make while reading what looks like
// their own plan. The exit control is the one real action here; nothing
// else on this banner does anything.
export function ViewAsBanner({ athleteName }: { athleteName: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-control border border-amber-600/30 bg-amber-500/5 px-4 py-2.5 dark:border-amber-400/30 dark:bg-amber-400/5">
      <p className="text-sm text-amber-900 dark:text-amber-200">
        <span className="font-semibold">Viewing as {athleteName}</span>
        <span className="mx-1.5">&middot;</span>
        <span>Read-only</span>
      </p>
      <form action={exitViewAsAthlete}>
        <button
          type="submit"
          className="text-sm font-semibold text-amber-900 underline decoration-amber-900/40 underline-offset-2 hover:decoration-amber-900 dark:text-amber-200 dark:decoration-amber-200/40 dark:hover:decoration-amber-200"
        >
          Back to coach view
        </button>
      </form>
    </div>
  );
}
