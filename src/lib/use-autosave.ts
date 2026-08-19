"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { AutosaveController, type AutosaveControllerOptions, type AutosaveStatus } from "@/lib/autosave-controller";

type UseAutosaveOptions<T> = AutosaveControllerOptions<T> & { value: T };

// Thin React glue around AutosaveController (see that file for the actual
// debounce/race/status-machine logic and why it's a plain class). One
// controller instance per component instance, created via useState's lazy
// initializer rather than useMemo -- useMemo is documented as a
// performance optimization React may discard and recompute, not a
// lifetime guarantee, which matters here since the controller owns real
// timers between renders.
//
// Subscribing through useSyncExternalStore (not a local useState mirrored
// via an effect) means every status transition -- including the ones that
// happen inside a setTimeout callback long after this component last
// rendered -- flows through React's own external-store mechanism instead
// of a useEffect that would have to synchronously call setState to catch
// up, which is exactly the pattern this codebase's own eslint config
// (react-hooks/set-state-in-effect) already pushes away from elsewhere
// (see use-site-search.ts's comment).
export function useAutosave<T>({
  value,
  ...options
}: UseAutosaveOptions<T>): { status: AutosaveStatus; error?: string; retry: () => void } {
  const [controller] = useState(() => new AutosaveController(value, options));
  controller.updateOptions(options);

  useEffect(() => {
    controller.notifyValueChanged(value);
  }, [controller, value]);

  useEffect(() => () => controller.destroy(), [controller]);

  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

  return { status: snapshot.status, error: snapshot.error, retry: () => controller.retry() };
}
