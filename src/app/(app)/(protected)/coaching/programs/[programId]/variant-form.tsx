"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { saveDurationVariant, setVariantPhases, type DurationVariantInput } from "../actions";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export type AvailablePhase = { id: string; label: string; isOptional: boolean };
export type ExistingVariant = { id: string; name: string; isDefault: boolean; phaseDefinitionIds: string[] };

// A variant ("12-Week", "18-Week") is just a name plus an ordered subset of
// the program's own phase definitions -- see the plan's own architecture
// note on why Supportive/Specific can be shared, byte-for-byte, across two
// variants that only differ in which General phase they use. Required
// phases are pre-selected and can't be unchecked here since a phase's own
// is_optional flag is what actually governs that, not this picker; this
// form controls MEMBERSHIP + ORDER for a variant, not per-phase inclusion
// at assignment time (that's a separate, per-athlete choice -- see
// assign-program-form.tsx).
export function VariantForm({
  programId,
  availablePhases,
  existing,
  onDone,
  onCancel,
}: {
  programId: string;
  availablePhases: AvailablePhase[];
  existing?: ExistingVariant;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false);
  const [orderedIds, setOrderedIds] = useState<string[]>(
    existing?.phaseDefinitionIds ?? availablePhases.filter((p) => !p.isOptional).map((p) => p.id),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function toggle(id: string) {
    setOrderedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function move(id: string, direction: -1 | 1) {
    setOrderedIds((prev) => {
      const index = prev.indexOf(id);
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) return setError("Give this plan length a name.");
    if (orderedIds.length === 0) return setError("Include at least one phase.");

    setIsPending(true);
    const input: DurationVariantInput = { id: existing?.id, programId, name, isDefault };
    const result = await saveDurationVariant(input);
    if (result.error) {
      setIsPending(false);
      return setError(result.error);
    }
    const variantId = result.id!;
    const phasesResult = await setVariantPhases(variantId, programId, orderedIds);
    setIsPending(false);
    if (phasesResult.error) return setError(phasesResult.error);
    onDone();
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-control border border-black/10 p-3 dark:border-white/10">
      <label className="block max-w-sm">
        <span className={labelClass}>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="12-Week, 18-Week…" className={fieldClass} />
      </label>

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="h-4 w-4" />
        Default plan length
      </label>

      <div>
        <p className={labelClass}>Phases, in order</p>
        {availablePhases.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-300">Add at least one phase to this program first.</p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {availablePhases.map((phase) => {
              const selected = orderedIds.includes(phase.id);
              const position = orderedIds.indexOf(phase.id);
              return (
                <li
                  key={phase.id}
                  className="flex items-center justify-between gap-2 rounded-control border border-black/10 p-2 text-sm dark:border-white/10"
                >
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={!phase.isOptional && selected}
                      onChange={() => toggle(phase.id)}
                      className="h-4 w-4"
                    />
                    {phase.label}
                    {!phase.isOptional ? <span className="text-xs text-zinc-500 dark:text-zinc-400">(required)</span> : null}
                  </label>
                  {selected ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">#{position + 1}</span>
                      <button
                        type="button"
                        onClick={() => move(phase.id, -1)}
                        aria-label="Move earlier"
                        className="rounded px-1.5 py-1 text-xs text-zinc-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(phase.id, 1)}
                        aria-label="Move later"
                        className="rounded px-1.5 py-1 text-xs text-zinc-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
                      >
                        ↓
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error && <FormError>{error}</FormError>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" disabled={isPending} onClick={handleSubmit}>
          {isPending ? "Saving…" : "Save plan length"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
