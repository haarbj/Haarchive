"use client";

import { useState, useTransition } from "react";

import { saveCalculation } from "@/components/pace-calculator-actions";
import { useAuthStatus } from "@/lib/use-auth-status";

type SaveCalculationButtonProps = {
  calculatorType: string;
  input: unknown;
  output: unknown;
  label: string;
};

export function SaveCalculationButton({
  calculatorType,
  input,
  output,
  label,
}: SaveCalculationButtonProps) {
  const status = useAuthStatus();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(
    null,
  );

  // Phase 12A.2: only "loading" hides the button now (avoids a flash
  // before the real session is known, same guard ArticleNotes/
  // BookmarkButton already use) -- an anonymous visitor now sees Save too,
  // so the existing saveCalculation() sign-in boundary and its Phase 12A
  // instrumentation (see pace-calculator-actions.ts) become reachable.
  // Everything below this line -- handleSave, the button, the error
  // message -- is unchanged; an anonymous click just now actually reaches
  // it instead of the button never rendering at all.
  if (status === "loading") return null;

  function handleSave() {
    startTransition(async () => {
      const res = await saveCalculation(calculatorType, input, output, label);
      setResult({ ok: res.status === "success", message: res.message });
    });
  }

  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending || result?.ok === true}
        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-900/15 px-4 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-black/5 disabled:opacity-60 dark:border-white/20 dark:text-zinc-200 dark:hover:bg-white/10"
      >
        {result?.ok ? "Saved ✓" : isPending ? "Saving…" : "Save this result"}
      </button>
      {result && !result.ok && (
        <p className="text-xs text-red-700 dark:text-red-400">{result.message}</p>
      )}
    </div>
  );
}
