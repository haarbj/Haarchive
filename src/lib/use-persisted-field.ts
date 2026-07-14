"use client";

import { useCallback, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";

function noopSubscribe() {
  return () => {};
}

/**
 * Hydration-safe read of a JSON blob from localStorage. Returns null on
 * the server AND during the client's first (hydration-matching) render --
 * useSyncExternalStore guarantees that first-render parity by using
 * getServerSnapshot for both passes -- then automatically re-renders with
 * the real value immediately after mount, with no manual effect involved.
 *
 * This is the fix for a real bug (not just a lint nag): an earlier version
 * of this persistence pattern read localStorage inside a useState lazy
 * initializer directly. That initializer runs during the client's
 * hydration-matching render too, where `window` already exists -- so it
 * silently returned different data than the server did whenever a user
 * had a previously-saved value, producing a genuine server/client
 * mismatch (e.g. a compass dial rendering at a different angle than the
 * server-rendered markup). useSyncExternalStore is the primitive React
 * itself recommends for exactly this "read an external, browser-only
 * source without breaking hydration" case.
 */
export function usePersistedJSON<T>(key: string): Partial<T> | null {
  const raw = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<T>;
  } catch {
    return null;
  }
}

/**
 * One persisted field: reads `persistedValue` (from usePersistedJSON)
 * until the caller actually changes it, at which point the local edit
 * takes over. The restored value only ever flows in through a plain
 * render-time fallback (`override ?? persistedValue ?? defaultValue`), so
 * there's no synchronization effect anywhere -- when usePersistedJSON's
 * snapshot flips from null to the real stored value post-hydration, this
 * recomputes automatically on React's own next render.
 *
 * setValue is wrapped in useCallback so its identity is stable across
 * renders (it only changes if persistedValue/defaultValue themselves
 * change) -- a real bug, not just a lint nag: an earlier version recreated
 * setValue as a plain closure every render, so any effect that listed a
 * setter from this hook in its dependency array (as React setState
 * setters are normally safe to do, since useState's own setter is always
 * stable) re-ran on every render. When that effect's body unconditionally
 * called the setter again, it triggered "Maximum update depth exceeded" --
 * an infinite render loop -- the first time a consumer did exactly that.
 */
export function usePersistedField<T>(
  persistedValue: T | undefined,
  defaultValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [override, setOverride] = useState<T | undefined>(undefined);
  const value = override !== undefined ? override : (persistedValue ?? defaultValue);

  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (next) => {
      setOverride((prevOverride) => {
        const prevValue = prevOverride !== undefined ? prevOverride : (persistedValue ?? defaultValue);
        return typeof next === "function" ? (next as (prev: T) => T)(prevValue) : next;
      });
    },
    [persistedValue, defaultValue],
  );

  return [value, setValue];
}
