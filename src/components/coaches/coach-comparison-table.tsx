"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { genomeScoreLabel } from "@/lib/coaches/genome";
import type { Coach } from "@/lib/coaches/types";

type ColumnKey =
  | "name"
  | "primaryIdea"
  | "primaryAdaptation"
  | "intensityPhilosophy"
  | "periodization"
  | "bestFor"
  | "dataDriven"
  | "individualization"
  | "mileagePhilosophy"
  | "recoveryPhilosophy"
  | "raceSpecificity"
  | "psychologicalEmphasis"
  | "technicalEmphasis"
  | "longTermSustainability";

type Column = {
  key: ColumnKey;
  label: string;
  getDisplay: (coach: Coach) => string;
  getSort: (coach: Coach) => string | number;
};

// Every column (after the pinned "name" one, rendered separately so it can
// stay a Link) is driven from this single list for both the header and the
// body -- adding a dimension is one entry here, not a header cell plus a
// separately-hand-written body cell that can drift out of sync with it.
const COLUMNS: Column[] = [
  { key: "primaryIdea", label: "Primary Idea", getDisplay: (c) => c.compare.primaryIdea, getSort: (c) => c.compare.primaryIdea },
  { key: "primaryAdaptation", label: "Primary Adaptation", getDisplay: (c) => c.compare.primaryAdaptation, getSort: (c) => c.compare.primaryAdaptation },
  { key: "intensityPhilosophy", label: "Intensity Philosophy", getDisplay: (c) => c.compare.intensityPhilosophy, getSort: (c) => c.compare.intensityPhilosophy },
  {
    key: "periodization",
    label: "Periodization",
    getDisplay: (c) => c.periodization.map((s) => s.label).join(" → "),
    getSort: (c) => c.periodization.length,
  },
  { key: "bestFor", label: "Best For", getDisplay: (c) => c.bestFor[0]?.label ?? "", getSort: (c) => c.bestFor[0]?.label ?? "" },
  { key: "dataDriven", label: "Data Driven", getDisplay: (c) => genomeScoreLabel(c.genome.dataDriven), getSort: (c) => c.genome.dataDriven },
  {
    key: "individualization",
    label: "Individualization",
    getDisplay: (c) => genomeScoreLabel(c.genome.individualization),
    getSort: (c) => c.genome.individualization,
  },
  { key: "mileagePhilosophy", label: "Mileage Philosophy", getDisplay: (c) => c.compare.mileagePhilosophy, getSort: (c) => c.compare.mileagePhilosophy },
  { key: "recoveryPhilosophy", label: "Recovery Philosophy", getDisplay: (c) => c.compare.recoveryPhilosophy, getSort: (c) => c.compare.recoveryPhilosophy },
  {
    key: "raceSpecificity",
    label: "Race Specificity",
    getDisplay: (c) => genomeScoreLabel(c.genome.specificity),
    getSort: (c) => c.genome.specificity,
  },
  {
    key: "psychologicalEmphasis",
    label: "Psychological Emphasis",
    getDisplay: (c) => genomeScoreLabel(c.genome.psychology),
    getSort: (c) => c.genome.psychology,
  },
  {
    key: "technicalEmphasis",
    label: "Technical Emphasis",
    getDisplay: (c) => genomeScoreLabel(c.genome.biomechanics),
    getSort: (c) => c.genome.biomechanics,
  },
  {
    key: "longTermSustainability",
    label: "Long-Term Sustainability",
    getDisplay: (c) => c.compare.longTermSustainability,
    getSort: (c) => c.compare.longTermSustainability,
  },
];

type FilterKey = "all" | "marathon" | "middleDistance" | "highMileage" | "dataDriven";

const FILTERS: { key: FilterKey; label: string; test: (coach: Coach) => boolean }[] = [
  { key: "all", label: "All 7 Philosophies", test: () => true },
  { key: "marathon", label: "Marathon-Focused", test: (c) => c.eventFocus === "Marathon" },
  { key: "middleDistance", label: "1500m–10K Focused", test: (c) => c.eventFocus === "1500m-10K" },
  { key: "highMileage", label: "High Mileage", test: (c) => c.genome.volume >= 80 },
  { key: "dataDriven", label: "Data-Driven", test: (c) => c.genome.dataDriven >= 70 },
];

const tableHeaderClass =
  "px-4 py-3 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400 whitespace-nowrap";
const tableCellClass = "px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200 align-top min-w-[9rem]";
// Header and body cells need their own sticky background (matching each
// row's own fill) rather than sharing one, or the sticky column would show
// the wrong fill as it slides over the row behind it -- both have to be
// genuinely opaque colors, not a semi-transparent tint, since a sticky cell
// sits directly over other cells scrolling underneath it.
const stickyHeaderCellClass = "sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-800";
const stickyBodyCellClass = "sticky left-0 z-10 bg-white dark:bg-zinc-900";

function SortButton({
  column,
  label,
  sortKey,
  sortDir,
  onSort,
}: {
  column: ColumnKey;
  label: string;
  sortKey: ColumnKey;
  sortDir: "asc" | "desc";
  onSort: (column: ColumnKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="inline-flex items-center gap-1 uppercase hover:text-zinc-900 dark:hover:text-white"
    >
      {label}
      {sortKey === column ? <span aria-hidden="true">{sortDir === "asc" ? "↑" : "↓"}</span> : null}
    </button>
  );
}

// The homepage's primary comparison feature -- sortable by any column and
// filterable to a specific slice (marathon-focused, high-mileage,
// data-driven) without a page reload, since all seven coaches' comparison
// data is already on the client. Filtering never hides a coach permanently;
// it's just a lens on the same fixed dataset in data.ts. Every dimension is
// either lifted straight from a coach's own `compare` phrase or derived from
// its `genome` score -- nothing here is a separately-opinionated judgment.
export function CoachComparisonTable({ coaches }: { coaches: Coach[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<ColumnKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];

  const rows = useMemo(() => {
    const filtered = coaches.filter(activeFilter.test);
    const sorted = [...filtered].sort((a, b) => {
      const va = sortKey === "name" ? a.name : COLUMNS.find((c) => c.key === sortKey)!.getSort(a);
      const vb = sortKey === "name" ? b.name : COLUMNS.find((c) => c.key === sortKey)!.getSort(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [coaches, activeFilter, sortKey, sortDir]);

  function handleSort(key: ColumnKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter coaches">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`rounded-pill border px-3 py-1.5 text-xs font-semibold transition ${
              filter === f.key
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                : "border-black/10 bg-white text-zinc-600 hover:border-black/20 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white/20"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[1500px] border-collapse">
          <thead>
            <tr className="border-b border-black/10 bg-zinc-50 dark:border-white/10 dark:bg-zinc-800">
              <th className={`${tableHeaderClass} ${stickyHeaderCellClass}`}>
                <SortButton column="name" label="Coach" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              </th>
              {COLUMNS.map((column) => (
                <th key={column.key} className={tableHeaderClass}>
                  <SortButton column={column.key} label={column.label} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/10">
            {rows.map((coach) => (
              <tr key={coach.slug} className="group transition hover:bg-black/[0.015] dark:hover:bg-white/[0.02]">
                <td
                  className={`${tableCellClass} ${stickyBodyCellClass} font-semibold text-zinc-900 transition group-hover:bg-zinc-50 dark:text-white dark:group-hover:bg-zinc-800`}
                >
                  <Link href={`/coaching-library/${coach.slug}`} className="hover:underline">
                    {coach.name}
                  </Link>
                </td>
                {COLUMNS.map((column) => (
                  <td key={column.key} className={tableCellClass}>
                    {column.getDisplay(coach)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">No coaches match this filter.</p>
      ) : null}
    </div>
  );
}
