import Link from "next/link";

import type { FamilyTreeNode } from "@/lib/coaches/family-tree";

function TreeNode({ node, isLast }: { node: FamilyTreeNode; isLast: boolean }) {
  return (
    <li className="relative pl-6">
      {/* The connector glyphs (├── / └──) are drawn with borders, not
          literal Unicode box-drawing characters -- those render
          inconsistently across fonts/platforms, while a border is
          guaranteed to look identical everywhere and scales cleanly on
          mobile. */}
      <span
        aria-hidden="true"
        className={`absolute top-0 left-0 w-4 border-l-2 border-zinc-200 dark:border-zinc-700 ${
          isLast ? "h-3.5" : "h-full"
        }`}
      />
      <span
        aria-hidden="true"
        className="absolute top-3.5 left-0 h-0.5 w-4 bg-zinc-200 dark:bg-zinc-700"
      />
      <div className="flex flex-wrap items-baseline gap-x-2 py-1">
        {node.slug ? (
          <Link
            href={`/coaching-library/${node.slug}`}
            className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-4 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
          >
            {node.name}
          </Link>
        ) : (
          <span className="font-medium text-zinc-600 dark:text-zinc-300">{node.name}</span>
        )}
        {node.alsoInfluencedBy && node.alsoInfluencedBy.length > 0 ? (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            (also influenced by {node.alsoInfluencedBy.join(", ")})
          </span>
        ) : null}
      </div>
      {node.children && node.children.length > 0 ? (
        <ul>
          {node.children.map((child, i) => (
            <TreeNode key={child.name} node={child} isLast={i === node.children!.length - 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

// The whole library's coaching lineage in one place -- every edge here
// traces back to a real `influencedBy` fact already on some coach's own
// page (see family-tree.ts's own comment). Rendered as a classic indented
// tree view rather than an SVG diagram: it's the only layout that stays
// legible with an arbitrary number of branches and depths, degrades
// perfectly on mobile (it's just nested, wrapping text), and needs no
// canvas/graph library.
export function FamilyTree({ roots }: { roots: FamilyTreeNode[] }) {
  return (
    <div className="space-y-1">
      {roots.map((root) => (
        <div key={root.name}>
          <div className="flex flex-wrap items-baseline gap-x-2 py-1">
            {root.slug ? (
              <Link
                href={`/coaching-library/${root.slug}`}
                className="text-lg font-semibold text-zinc-900 underline decoration-black/20 underline-offset-4 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
              >
                {root.name}
              </Link>
            ) : (
              <span className="text-lg font-semibold text-zinc-900 dark:text-white">{root.name}</span>
            )}
          </div>
          {root.children && root.children.length > 0 ? (
            <ul>
              {root.children.map((child, i) => (
                <TreeNode key={child.name} node={child} isLast={i === root.children!.length - 1} />
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
