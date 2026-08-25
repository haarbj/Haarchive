"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "haarchive-theme";

// Plain module-level subscription set, not a Context provider -- the
// handful of components that need this (the toggle button, the header
// logo, the footer logo) aren't in a parent/child relationship with each
// other, and useSyncExternalStore (built into React, no dependency) is a
// smaller, more direct fit than wrapping the app in a Provider just to
// share one value. Mirrors the same "no unnecessary dependency" stance the
// rest of this codebase already takes (see CLAUDE.md's dependency-list
// note) -- this is effectively the useful slice of next-themes, hand-built.
const listeners = new Set<() => void>();

function readInitialTheme(): Theme {
  // The server always renders light (see layout.tsx) and the pre-hydration
  // inline script there is what actually decides the first paint's real
  // class -- this just has to agree with whatever the DOM already says by
  // the time React runs, not re-derive it from localStorage/matchMedia
  // itself (that logic lives in exactly one place: the inline script).
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

let currentTheme: Theme = readInitialTheme();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): Theme {
  return currentTheme;
}

// Matches the server's own unconditional light render (layout.tsx never
// renders "dark" itself) -- this is about the *value* useSyncExternalStore
// reports during SSR/before hydration, a separate concern from the actual
// <html> class mismatch layout.tsx's suppressHydrationWarning already
// covers (the inline script may have already added "dark" by the time
// React hydrates; this function still correctly reports what the server
// itself rendered, which is what useSyncExternalStore requires).
function getServerSnapshot(): Theme {
  return "light";
}

export function setTheme(theme: Theme): void {
  currentTheme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private browsing / storage disabled -- the class toggle above still
    // applies for the rest of this session, it just won't persist.
  }
  listeners.forEach((listener) => listener());
}

export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { theme, setTheme };
}
