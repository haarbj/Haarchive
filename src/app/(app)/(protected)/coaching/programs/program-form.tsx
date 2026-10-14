"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { saveProgram, type ProgramInput } from "./actions";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export type ExistingProgram = {
  id: string;
  name: string;
  description: string | null;
  scalesDistanceWithMileage: boolean;
  scalesDurationWithMileage: boolean;
  initialMileageMin: number | null;
  initialMileageMax: number | null;
  peakMileageMin: number | null;
  peakMileageMax: number | null;
  typicalGoalTimes: string | null;
  recommendedFor: string | null;
  glossaryTerms: string[];
};

function numberInput(value: number | null): string {
  return value != null ? String(value) : "";
}
function parseOptionalNumber(input: string): number | null {
  const trimmed = input.trim();
  return trimmed ? Number(trimmed) : null;
}

// Two independent, un-pre-selected scaling choices -- both default to No
// (matching training_programs' own DB default) and are never pre-checked,
// per the plan's own guardrail against silently assuming Canyon's own need
// for distance-scaling applies to every coach. Distance and duration are
// deliberately never coupled: enabling one has no effect on the other.
//
// The "Framework overview" section below is ONE overview per Program, not
// per duration variant -- a 12-week and an 18-week version of the same
// methodology share it. Every field in it is optional.
export function ProgramForm({ existing }: { existing?: ExistingProgram }) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [scalesDistance, setScalesDistance] = useState(existing?.scalesDistanceWithMileage ?? false);
  const [scalesDuration, setScalesDuration] = useState(existing?.scalesDurationWithMileage ?? false);
  const [initialMileageMinInput, setInitialMileageMinInput] = useState(numberInput(existing?.initialMileageMin ?? null));
  const [initialMileageMaxInput, setInitialMileageMaxInput] = useState(numberInput(existing?.initialMileageMax ?? null));
  const [peakMileageMinInput, setPeakMileageMinInput] = useState(numberInput(existing?.peakMileageMin ?? null));
  const [peakMileageMaxInput, setPeakMileageMaxInput] = useState(numberInput(existing?.peakMileageMax ?? null));
  const [typicalGoalTimes, setTypicalGoalTimes] = useState(existing?.typicalGoalTimes ?? "");
  const [recommendedFor, setRecommendedFor] = useState(existing?.recommendedFor ?? "");
  const [glossaryTerms, setGlossaryTerms] = useState<string[]>(existing?.glossaryTerms ?? []);
  const [newGlossaryTerm, setNewGlossaryTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function addGlossaryTerm() {
    const trimmed = newGlossaryTerm.trim();
    if (!trimmed) return;
    setGlossaryTerms((prev) => [...prev, trimmed]);
    setNewGlossaryTerm("");
  }
  function removeGlossaryTerm(index: number) {
    setGlossaryTerms((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) return setError("Give this program a name.");

    const initialMileageMin = parseOptionalNumber(initialMileageMinInput);
    const initialMileageMax = parseOptionalNumber(initialMileageMaxInput);
    const peakMileageMin = parseOptionalNumber(peakMileageMinInput);
    const peakMileageMax = parseOptionalNumber(peakMileageMaxInput);

    setIsPending(true);
    const input: ProgramInput = {
      id: existing?.id,
      name,
      description: description.trim() || null,
      scalesDistanceWithMileage: scalesDistance,
      scalesDurationWithMileage: scalesDuration,
      initialMileageMin,
      initialMileageMax,
      peakMileageMin,
      peakMileageMax,
      typicalGoalTimes: typicalGoalTimes.trim() || null,
      recommendedFor: recommendedFor.trim() || null,
      glossaryTerms,
    };
    const result = await saveProgram(input);
    setIsPending(false);
    if (result.error) return setError(result.error);
    router.push(existing ? `/coaching/programs/${existing.id}` : `/coaching/programs/${result.id}`);
  }

  return (
    <div className="space-y-6">
      <label className="block max-w-sm">
        <span className={labelClass}>Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="The Canyon Framework…"
          className={fieldClass}
        />
      </label>

      <div className="rounded-control border border-black/10 p-3 dark:border-white/10">
        <p className={labelClass}>Framework overview</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Shared across every plan length under this program -- a 12-week and an 18-week version of the same methodology
          have one overview, not two. Every field here is optional.
        </p>

        <label className="mt-3 block">
          <span className={labelClass}>Description</span>
          <textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={3} className={fieldClass} />
        </label>

        <div className="mt-3 grid grid-cols-1 gap-3 xs:grid-cols-2">
          <div>
            <span className={labelClass}>Initial mileage (mi/wk)</span>
            <div className="mt-1 flex items-center gap-2">
              <input value={initialMileageMinInput} onChange={(e) => setInitialMileageMinInput(e.target.value)} placeholder="25" className={fieldClass} />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">to</span>
              <input value={initialMileageMaxInput} onChange={(e) => setInitialMileageMaxInput(e.target.value)} placeholder="34" className={fieldClass} />
            </div>
          </div>
          <div>
            <span className={labelClass}>Peak mileage (mi/wk)</span>
            <div className="mt-1 flex items-center gap-2">
              <input value={peakMileageMinInput} onChange={(e) => setPeakMileageMinInput(e.target.value)} placeholder="40" className={fieldClass} />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">to</span>
              <input value={peakMileageMaxInput} onChange={(e) => setPeakMileageMaxInput(e.target.value)} placeholder="50" className={fieldClass} />
            </div>
          </div>
        </div>

        <label className="mt-3 block max-w-xs">
          <span className={labelClass}>Typical goal times</span>
          <input
            value={typicalGoalTimes}
            onChange={(e) => setTypicalGoalTimes(e.target.value)}
            placeholder="3:15-4:30"
            className={fieldClass}
          />
        </label>

        <label className="mt-3 block">
          <span className={labelClass}>Recommended for</span>
          <textarea
            value={recommendedFor}
            onChange={(e) => setRecommendedFor(e.target.value)}
            rows={2}
            placeholder="First-time marathoners, injury-prone runners…"
            className={fieldClass}
          />
        </label>

        <div className="mt-3">
          <span className={labelClass}>Glossary</span>
          {glossaryTerms.length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {glossaryTerms.map((term, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <span>{term}</span>
                  <button
                    type="button"
                    onClick={() => removeGlossaryTerm(i)}
                    className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-1.5 flex gap-2">
            <input
              value={newGlossaryTerm}
              onChange={(e) => setNewGlossaryTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addGlossaryTerm();
                }
              }}
              placeholder="LR - Long Run"
              className={`${fieldClass} max-w-xs`}
            />
            <button
              type="button"
              onClick={addGlossaryTerm}
              className="text-xs font-semibold text-zinc-500 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-400 dark:decoration-white/20 dark:hover:decoration-white"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-control border border-black/10 p-3 dark:border-white/10">
        <p className={labelClass}>Mileage scaling</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          When you assign this program to an athlete, should its distances and/or durations scale up or down to a target
          peak weekly volume? Each choice is independent -- most programs scale by one, both, or neither, never assumed.
        </p>
        <div className="mt-3 space-y-2">
          <ScalingToggle
            label="Scale distance with target peak mileage"
            checked={scalesDistance}
            onChange={setScalesDistance}
          />
          <ScalingToggle
            label="Scale duration with target peak mileage"
            checked={scalesDuration}
            onChange={setScalesDuration}
          />
        </div>
      </div>

      {error && <FormError>{error}</FormError>}

      <Button type="button" disabled={isPending} onClick={handleSubmit}>
        {isPending ? "Saving…" : "Save program"}
      </Button>
    </div>
  );
}

function ScalingToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}
