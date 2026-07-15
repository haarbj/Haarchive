"use client";

import { fieldClass as baseFieldClass } from "@/lib/form-styles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const fieldClass = `w-full ${baseFieldClass}`;

export type CitationDraft = {
  paperTitle: string;
  authors: string;
  year: string;
  linkOrDoi: string;
  topic: string;
  claimSupported: string;
  notes: string;
};

export const EMPTY_CITATION: CitationDraft = {
  paperTitle: "",
  authors: "",
  year: "",
  linkOrDoi: "",
  topic: "",
  claimSupported: "",
  notes: "",
};

export function CitationsEditor({
  citations,
  onChange,
}: {
  citations: CitationDraft[];
  onChange: (citations: CitationDraft[]) => void;
}) {
  function update(index: number, patch: Partial<CitationDraft>) {
    onChange(citations.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  return (
    <div className="space-y-3">
      {citations.map((citation, index) => (
        <Card key={index} padding="sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className={fieldClass}
              value={citation.paperTitle}
              onChange={(e) => update(index, { paperTitle: e.target.value })}
              placeholder="Paper title"
            />
            <input
              className={fieldClass}
              value={citation.authors}
              onChange={(e) => update(index, { authors: e.target.value })}
              placeholder="Authors"
            />
            <input
              className={fieldClass}
              value={citation.year}
              onChange={(e) => update(index, { year: e.target.value })}
              placeholder="Year"
              inputMode="numeric"
            />
            <input
              className={fieldClass}
              value={citation.linkOrDoi}
              onChange={(e) => update(index, { linkOrDoi: e.target.value })}
              placeholder="Link or DOI"
            />
            <input
              className={fieldClass}
              value={citation.topic}
              onChange={(e) => update(index, { topic: e.target.value })}
              placeholder="Topic (e.g. RED-S)"
            />
            <input
              className={fieldClass}
              value={citation.claimSupported}
              onChange={(e) => update(index, { claimSupported: e.target.value })}
              placeholder="Claim supported"
            />
          </div>
          <textarea
            className={`${fieldClass} mt-2`}
            rows={2}
            value={citation.notes}
            onChange={(e) => update(index, { notes: e.target.value })}
            placeholder="Notes (optional)"
          />
          <button
            type="button"
            onClick={() => onChange(citations.filter((_, i) => i !== index))}
            className="mt-2 text-xs font-semibold text-red-700 dark:text-red-400"
          >
            Remove citation
          </button>
        </Card>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...citations, { ...EMPTY_CITATION }])}>
        + Add citation
      </Button>
    </div>
  );
}
