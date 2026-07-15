import Link from "next/link";

import type { GenealogyTier } from "@/lib/coaches/types";

type GenealogyDiagramProps = {
  tiers: GenealogyTier[];
  // The coach whose page this diagram appears on -- always rendered as the
  // final node automatically, so a coach's own data never has to list
  // itself as its own last influence.
  coachName: string;
};

function NameNode({ link, emphasis = false }: { link: { name: string; slug?: string }; emphasis?: boolean }) {
  const textClass = emphasis
    ? "text-xl font-semibold tracking-tight text-zinc-900 dark:text-white"
    : "text-base font-medium text-zinc-700 dark:text-zinc-200";
  if (link.slug) {
    return (
      <Link href={`/coaching-library/${link.slug}`} className={`${textClass} underline decoration-black/20 underline-offset-4 transition hover:decoration-black/60 dark:decoration-white/30 dark:hover:decoration-white/70`}>
        {link.name}
      </Link>
    );
  }
  return <span className={textClass}>{link.name}</span>;
}

// Intellectual inheritance, drawn the way a family tree actually reads --
// plain names connected by real lines, not badges/pills floating in a row.
// A tier of more than one name converges diagonally into whatever comes
// next (an SVG fan-in, reused from the same converging-lines technique
// training-philosophy-page.tsx uses for its coaches diagram); a tier of one
// name just drops a single vertical connector. Either way the coach's own
// name is always the final, most visually emphasized node.
export function GenealogyDiagram({ tiers, coachName }: GenealogyDiagramProps) {
  const nodeTiers: { links: GenealogyTier; emphasis: boolean }[] = [
    ...tiers.map((links) => ({ links, emphasis: false })),
    { links: [{ name: coachName }], emphasis: true },
  ];

  return (
    <div className="mt-8 flex flex-col items-center">
      {nodeTiers.map((tier, i) => {
        const nextTier = nodeTiers[i + 1];
        const isMultiSource = tier.links.length > 1 && !!nextTier;

        return (
          <div key={i} className="flex w-full flex-col items-center">
            <div className="flex flex-wrap justify-center gap-x-10 gap-y-3">
              {tier.links.map((link) => (
                <NameNode key={link.name} link={link} emphasis={tier.emphasis} />
              ))}
            </div>

            {nextTier ? (
              isMultiSource ? (
                <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-10 w-full max-w-xs text-zinc-300 dark:text-zinc-600">
                  {tier.links.map((_, idx) => (
                    <line
                      key={idx}
                      x1={((idx + 0.5) / tier.links.length) * 100}
                      y1="0"
                      x2="50"
                      y2="28"
                      stroke="currentColor"
                      strokeWidth="1"
                    />
                  ))}
                </svg>
              ) : (
                <div aria-hidden="true" className="my-2 h-8 w-px bg-zinc-300 dark:bg-zinc-600" />
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
