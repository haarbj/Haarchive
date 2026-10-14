"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { deletePhaseDefinition, deleteDurationVariant } from "../actions";
import { PhaseDefinitionForm, type ExistingPhaseDefinition } from "./phase-definition-form";
import { VariantForm, type AvailablePhase, type ExistingVariant } from "./variant-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";

export type PhaseDefinitionRow = ExistingPhaseDefinition & { weeksWithContent: number };
export type VariantRow = ExistingVariant & { phaseLabels: string[] };

export function ProgramDetail({
  programId,
  phaseDefinitions,
  variants,
}: {
  programId: string;
  phaseDefinitions: PhaseDefinitionRow[];
  variants: VariantRow[];
}) {
  const router = useRouter();
  const [phaseFormTarget, setPhaseFormTarget] = useState<"new" | ExistingPhaseDefinition | null>(null);
  const [variantFormTarget, setVariantFormTarget] = useState<"new" | ExistingVariant | null>(null);

  const availablePhases: AvailablePhase[] = phaseDefinitions.map((p) => ({
    id: p.id,
    label: p.name ?? p.phaseKey,
    isOptional: p.isOptional,
  }));

  return (
    <div className="mt-10 space-y-10">
      <section>
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Phases</p>
        <div className="mt-3 space-y-2">
          {phaseDefinitions.map((phase) => {
            const isComplete = phase.weeksWithContent >= phase.durationWeeksMin;
            return (
              <Card key={phase.id} padding="md">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/coaching/programs/${programId}/phases/${phase.id}`}
                      className="font-semibold text-zinc-900 hover:underline dark:text-white"
                    >
                      {phase.name ?? phase.phaseKey}
                    </Link>
                    {phase.isOptional ? (
                      <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">optional</span>
                    ) : null}
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                      {phase.durationWeeksMin === phase.durationWeeksMax
                        ? `${phase.durationWeeksMin} weeks`
                        : `${phase.durationWeeksMin}–${phase.durationWeeksMax} weeks`}
                    </p>
                    <p className={`mt-1 text-xs ${isComplete ? "text-zinc-500 dark:text-zinc-400" : "text-amber-600 dark:text-amber-400"}`}>
                      {phase.weeksWithContent}/{phase.durationWeeksMin} week{phase.durationWeeksMin === 1 ? "" : "s"} have
                      workouts
                    </p>
                    {phase.notes ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{phase.notes}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPhaseFormTarget(phase)}
                      className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
                    >
                      Edit
                    </button>
                    <ConfirmButton
                      action={() => deletePhaseDefinition(phase.id, programId).then(() => router.refresh())}
                      confirmMessage={`Delete the "${phase.name ?? phase.phaseKey}" phase? This removes all its authored days and drops it from any plan length that uses it.`}
                      label="Delete"
                      pendingLabel="Deleting…"
                      className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-3">
          {phaseFormTarget ? (
            <PhaseDefinitionForm
              programId={programId}
              existing={phaseFormTarget === "new" ? undefined : phaseFormTarget}
              onDone={() => setPhaseFormTarget(null)}
              onCancel={() => setPhaseFormTarget(null)}
            />
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setPhaseFormTarget("new")}>
              + Add phase
            </Button>
          )}
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Plan Lengths</p>
        <div className="mt-3 space-y-2">
          {variants.map((variant) => (
            <Card key={variant.id} padding="md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-white">
                    {variant.name}
                    {variant.isDefault ? <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">default</span> : null}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    {variant.phaseLabels.length > 0 ? variant.phaseLabels.join(" → ") : "No phases selected yet"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setVariantFormTarget(variant)}
                    className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
                  >
                    Edit
                  </button>
                  <ConfirmButton
                    action={() => deleteDurationVariant(variant.id, programId).then(() => router.refresh())}
                    confirmMessage={`Delete the "${variant.name}" plan length? The phases it uses stay in this program -- only this plan-length option goes away.`}
                    label="Delete"
                    pendingLabel="Deleting…"
                    className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black disabled:opacity-50 dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-3">
          {variantFormTarget ? (
            <VariantForm
              programId={programId}
              availablePhases={availablePhases}
              existing={variantFormTarget === "new" ? undefined : variantFormTarget}
              onDone={() => setVariantFormTarget(null)}
              onCancel={() => setVariantFormTarget(null)}
            />
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setVariantFormTarget("new")}>
              + Add plan length
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
