"use client";

import { useActionState, useRef } from "react";

export type AutoSaveState = { error?: string; success?: boolean };

// Wraps useActionState so a form saves itself instead of waiting for an
// explicit "Save changes" click -- built for settings-shaped forms (a
// small set of fields representing one persistent record), not for a
// "compose, then commit or cancel" flow like building a workout or
// marking one complete, where auto-saving mid-edit would be actively
// wrong (see completion-form.tsx/workout-form.tsx, deliberately NOT
// converted to this).
//
// scheduleSave (debounced) is for continuous-typing fields (text,
// textarea, number) via onBlur -- waits until the user actually leaves
// the field rather than saving on every keystroke. saveNow (immediate) is
// for discrete-choice fields (select, checkbox, radio) via onChange,
// where there's no "still typing" state to wait out.
//
// Dispatches via useActionState's own returned action function called
// directly with a FormData built from the live form element
// (new FormData(formRef.current)), the same object identity a real
// <form action={dispatch}> submission would build -- this only works
// because every converted form's fields are still real name-bearing
// inputs, not extracted into separate controlled state.
export function useAutoSaveForm<State extends AutoSaveState>(
  action: (prevState: Awaited<State>, formData: FormData) => State | Promise<State>,
  initialState: Awaited<State>,
  debounceMs = 600,
) {
  const [state, dispatch, isPending] = useActionState<State, FormData>(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function saveNow() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (!formRef.current) return;
    // Skip silently (no error flash) while a required field is still
    // empty -- a form being filled in for the first time (e.g. a fresh
    // Athlete Profile with 3 required fields) would otherwise show a
    // validation error the moment you leave the FIRST field, well before
    // you've had a chance to fill in the rest. checkValidity() is the
    // same native HTML5 constraint check (required/min/max/type) the
    // inputs already declare -- not a second, separately-maintained rule
    // set.
    if (!formRef.current.checkValidity()) return;
    dispatch(new FormData(formRef.current));
  }

  function scheduleSave() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(saveNow, debounceMs);
  }

  return { state, formRef, isPending, scheduleSave, saveNow };
}
