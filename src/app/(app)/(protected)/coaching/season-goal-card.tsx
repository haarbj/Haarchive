"use client";

import { useActionState, useState } from "react";

import { updateSeasonGoal, type UpdateSeasonGoalState } from "./season-goal-actions";
import { SEASON_GOAL_MAX_LENGTH } from "@/lib/validation/athlete-profile";
import { fieldClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

// "What would make this season a success for you?" -- the one open
// prompt question this feature's own copy exists around; it is the
// entire scaffold (empty-state invitation copy and the textarea's
// placeholder, nothing more -- no template text, no suggested answer).
const PROMPT = "What would make this season a success for you?";

// Distinct from the structured goal race (a fact: name, date, target
// time) -- this is the athlete's own voice, one current value, no
// history. Same component renders on the athlete's own home and (via
// `readOnly`) a coach's view-as session: the coach never gets an edit
// control, but sees the exact same prompt/value a real athlete would.
export function SeasonGoalCard({ initialValue, readOnly = false }: { initialValue: string | null; readOnly?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [draft, setDraft] = useState(initialValue ?? "");
  const [state, formAction, isPending] = useActionState<UpdateSeasonGoalState, FormData>(updateSeasonGoal, {});

  // Same "adjust state during render" shape checkin-response-composer.tsx
  // already uses for this exact pattern: `state` is a new object only
  // once the action itself resolves, so this fires exactly once per save,
  // never on an unrelated re-render.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (!state.error) {
      setValue(draft.trim() || null);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="mt-6">
        <label htmlFor="season-goal" className="block text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">
          Your season goal
        </label>
        <form action={formAction} className="mt-2">
          <textarea
            id="season-goal"
            name="seasonGoal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={SEASON_GOAL_MAX_LENGTH}
            placeholder={PROMPT}
            rows={3}
            autoFocus
            className={`w-full ${fieldClass}`}
          />
          <div className="mt-2 flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
          {state.error ? <FormError className="mt-2">{state.error}</FormError> : null}
        </form>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase dark:text-zinc-400">Your season goal</p>
      {value ? (
        <p className="mt-2 text-lg leading-7 text-zinc-900 dark:text-white">&ldquo;{value}&rdquo;</p>
      ) : (
        <p className="mt-2 text-lg leading-7 text-zinc-600 dark:text-zinc-300">{PROMPT}</p>
      )}
      {!readOnly ? (
        <button
          type="button"
          onClick={() => {
            setDraft(value ?? "");
            setEditing(true);
          }}
          className="mt-1 text-sm font-semibold text-zinc-600 underline decoration-black/20 underline-offset-2 hover:decoration-black dark:text-zinc-300 dark:decoration-white/20 dark:hover:decoration-white"
        >
          {value ? "Edit" : "Add your season goal"}
        </button>
      ) : null}
    </div>
  );
}
