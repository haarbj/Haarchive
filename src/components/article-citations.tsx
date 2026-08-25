import type { PublicCitation } from "@/lib/articles/citations";
import { textLinkClass } from "@/components/ui/text-link";

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

// A reader-facing "Sources" list for a DB-backed article -- distinct from
// Foundations pages' inline (Author, Book, Year) citations woven into the
// prose itself, since a contributor article's citations are structured
// data (article_citations) attached separately from the content blocks.
export function ArticleCitations({ citations }: { citations: PublicCitation[] }) {
  if (citations.length === 0) return null;

  return (
    // No mt-* here: this renders as the last child inside article-layout's
    // space-y-6 prose container, whose sibling-combinator margin rule beats
    // a plain utility class on specificity -- border-t + pt-8 alone already
    // reads as a clear section break.
    <div className="border-t border-black/5 pt-8 dark:border-white/10">
      <h2 className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Sources</h2>
      <ol className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
        {citations.map((citation, index) => (
          <li key={citation.id} className="flex gap-3">
            <span aria-hidden="true" className="tabular-nums text-zinc-400 dark:text-zinc-500">
              {index + 1}.
            </span>
            <span>
              {citation.authors ? `${citation.authors}. ` : ""}
              {citation.paperTitle}
              {citation.year ? ` (${citation.year})` : ""}
              {citation.linkOrDoi ? (
                isHttpUrl(citation.linkOrDoi) ? (
                  <>
                    {". "}
                    <a href={citation.linkOrDoi} target="_blank" rel="noreferrer" className={textLinkClass}>
                      {citation.linkOrDoi}
                    </a>
                  </>
                ) : (
                  `. ${citation.linkOrDoi}`
                )
              ) : (
                "."
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
