import type { Coach } from "@/lib/coaches/types";

function Row({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-40 shrink-0 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {label}
      </dt>
      <dd className="text-sm text-zinc-700 dark:text-zinc-200">{children}</dd>
    </div>
  );
}

// The "understand this in under 30 seconds" summary -- every value here is
// pulled from a field that already exists elsewhere on the page (compare,
// signatureWorkouts, strongestArgument, criticisms, bestFor, notIdealFor),
// deliberately: this card is a compact lens onto the real data, not a
// second, separately-maintained summary that could drift from it.
export function AtAGlance({ coach }: { coach: Coach }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-card dark:border-white/10 dark:bg-zinc-900">
      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {coach.name} at a Glance
      </p>
      <dl className="mt-3 space-y-2.5">
        <Row label="Core belief">{coach.compare.primaryIdea}</Row>
        <Row label="Primary adaptation">{coach.compare.primaryAdaptation}</Row>
        {coach.signatureWorkouts[0] ? (
          <Row label="Signature workout">{coach.signatureWorkouts[0].name}</Row>
        ) : null}
        <Row label="Greatest strength">{coach.strongestArgument}</Row>
        {coach.criticisms[0] ? <Row label="Most common criticism">{coach.criticisms[0].criticism}</Row> : null}
        {coach.bestFor[0] ? <Row label="Best for">{coach.bestFor[0].label}</Row> : null}
        {coach.notIdealFor[0] ? <Row label="Avoid if">{coach.notIdealFor[0].label}</Row> : null}
      </dl>
    </div>
  );
}
