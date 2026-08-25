import { Star } from "lucide-react";

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
        className="flex shrink-0 items-center gap-0.5 text-zinc-900 dark:text-white"
      >
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={i < evidence.rating ? "h-4 w-4" : "h-4 w-4 text-zinc-300 dark:text-zinc-700"}
            fill={i < evidence.rating ? "currentColor" : "none"}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        ))}
      </span>
      <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{evidence.description}</p>
    </div>
  );
}
