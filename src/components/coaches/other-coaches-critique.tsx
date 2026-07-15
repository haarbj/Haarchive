import Link from "next/link";

import { coachMap } from "@/lib/coaches/data";
import type { OtherCoachCritique } from "@/lib/coaches/types";

// Genuine disagreement between real, named philosophies -- distinct from
// the page's own Common Criticisms (this site's even-handed critique/
// response pairs). Every entry links to that coach's own page, so a reader
// can go verify the critique reflects that coach's actual documented
// position rather than taking it on faith.
export function OtherCoachesCritique({ critiques }: { critiques: OtherCoachCritique[] }) {
  return (
    <div className="mt-8 space-y-4">
      {critiques.map((item) => {
        const critic = coachMap.get(item.coachSlug);
        if (!critic) return null;
        return (
          <div key={item.coachSlug} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
            <Link
              href={`/coaching-library/${critic.slug}`}
              className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
            >
              {critic.name}
            </Link>
            <p className="mt-1.5 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{item.critique}</p>
          </div>
        );
      })}
    </div>
  );
}
