"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { buildLinkableTargets, searchLinkableTargets, type LinkableTarget } from "@/lib/questions/section-picker";
import { resolveLinkedSection } from "@/lib/sections";
import { fieldClass, labelClass } from "@/lib/form-styles";

type CategoryGroup = {
  categoryTitle: string;
  sections: Map<string, { sectionTitle: string; targets: LinkableTarget[] }>;
};

function groupByCategoryThenSection(targets: LinkableTarget[]): Map<string, CategoryGroup> {
  const byCategory = new Map<string, CategoryGroup>();
  for (const target of targets) {
    if (!byCategory.has(target.categorySlug)) {
      byCategory.set(target.categorySlug, { categoryTitle: target.categoryTitle, sections: new Map() });
    }
    const category = byCategory.get(target.categorySlug)!;
    if (!category.sections.has(target.sectionSlug)) {
      category.sections.set(target.sectionSlug, { sectionTitle: target.sectionTitle, targets: [] });
    }
    category.sections.get(target.sectionSlug)!.targets.push(target);
  }
  return byCategory;
}

function breadcrumb(target: LinkableTarget): string {
  return target.label === target.sectionTitle
    ? `${target.categoryTitle} → ${target.sectionTitle}`
    : `${target.categoryTitle} → ${target.sectionTitle} → ${target.label}`;
}

/**
 * Replaces hand-typing questions.linked_section_slug (a bare slug, or
 * "slug#heading-anchor") with search-as-you-type or a browsable
 * category -> section -> heading tree -- the exact anchor mismatch that
 * caused a real bug (see resolveLinkedSection in sections.ts) came from
 * an admin having to construct that string by hand with no feedback
 * about whether it was even valid.
 */
export function LinkedSectionPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const targets = useMemo(() => buildLinkableTargets(), []);
  const byCategory = useMemo(() => groupByCategoryThenSection(targets), [targets]);
  const [query, setQuery] = useState("");
  const [showManual, setShowManual] = useState(false);

  const results = useMemo(() => searchLinkableTargets(query, targets), [query, targets]);
  const selectedTarget = value ? targets.find((t) => t.value === value) : undefined;
  const selectedResolves = value ? resolveLinkedSection(value) !== null : true;

  function select(target: LinkableTarget) {
    onChange(target.value);
    setQuery("");
  }

  return (
    <div>
      <label htmlFor="linkedSectionSearch" className={labelClass}>
        Linked article (set when status is “Added to Library”)
      </label>

      <div className="mt-1 flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5">
        {value ? (
          <span
            className={`flex items-center gap-1.5 ${selectedResolves ? "text-zinc-800 dark:text-zinc-200" : "text-red-700 dark:text-red-400"}`}
          >
            {selectedTarget ? (
              breadcrumb(selectedTarget)
            ) : selectedResolves ? (
              value
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                {`"${value}" doesn't match any real article`}
              </>
            )}
          </span>
        ) : (
          <span className="text-zinc-500 dark:text-zinc-400">Not linked to an article yet.</span>
        )}
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 text-xs font-semibold text-zinc-600 underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:text-zinc-300 dark:decoration-white/30"
          >
            Clear
          </button>
        ) : null}
      </div>

      <input
        id="linkedSectionSearch"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for a heading or article, e.g. soreness"
        className={`${fieldClass} mt-2 w-full`}
      />

      {results.length > 0 ? (
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-black/10 p-2 dark:border-white/10">
          {results.map((target) => (
            <li key={target.value}>
              <button
                type="button"
                onClick={() => select(target)}
                className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span className="block text-zinc-900 dark:text-white">{target.label}</span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">{breadcrumb(target)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!query ? (
        <details className="mt-2 rounded-lg border border-black/10 dark:border-white/10">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            Browse by category
          </summary>
          <div className="space-y-1 px-3 pb-3">
            {Array.from(byCategory.entries()).map(([categorySlug, category]) => (
              <details key={categorySlug} className="rounded-md border border-black/5 dark:border-white/5">
                <summary className="cursor-pointer px-2 py-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  {category.categoryTitle}
                </summary>
                <div className="space-y-1 px-2 pb-2">
                  {Array.from(category.sections.entries()).map(([sectionSlug, section]) => (
                    <details key={sectionSlug} className="ml-2 border-l border-black/10 pl-2 dark:border-white/10">
                      <summary className="cursor-pointer py-1 text-sm text-zinc-700 dark:text-zinc-300">
                        {section.sectionTitle}
                      </summary>
                      <ul className="mb-1 ml-2 space-y-0.5">
                        {section.targets.map((target) => (
                          <li key={target.value}>
                            <button
                              type="button"
                              onClick={() => select(target)}
                              className="w-full rounded px-2 py-1 text-left text-xs text-zinc-600 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
                            >
                              {target.value === sectionSlug ? "(whole page)" : target.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      ) : null}

      <button
        type="button"
        onClick={() => setShowManual((v) => !v)}
        className="mt-2 text-xs text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:text-zinc-400 dark:decoration-white/30"
      >
        {showManual ? "Hide manual entry" : "Enter the slug manually instead"}
      </button>
      {showManual ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. recovery or recovery#some-heading"
          className={`${fieldClass} mt-2 w-full`}
        />
      ) : null}

      <input type="hidden" name="linkedSectionSlug" value={value} />
    </div>
  );
}
