import type { EvidenceStrength } from "@/lib/coaches/types";

// Five fixed stars, filled left to right -- deliberately not a percentage
// or a decimal score, since the underlying judgment (how well-supported is
// this claim) is a rough five-point read, not a precise measurement, and a
// star rating doesn't imply false precision the way "72%" would.
export function EvidenceMeter({ evidence }: { evidence: EvidenceStrength }) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-label={`Evidence strength: ${evidence.rating} out of 5`}
        className="shrink-0 text-lg tracking-wider text-zinc-900 dark:text-white"
      >
        {"★".repeat(evidence.rating)}
        <span className="text-zinc-300 dark:text-zinc-700">{"★".repeat(5 - evidence.rating)}</span>
      </span>
      <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{evidence.description}</p>
    </div>
  );
}
