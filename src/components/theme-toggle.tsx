"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/lib/theme";

// Same icon-button language as the header's other utility icons (search,
// questions) -- h-10 w-10 rounded-full, hover fill, no border. Shows the
// icon for the *current* theme (Sun visible while light, Moon while dark)
// rather than a hint at the click target -- reads as "this is what's on,"
// matching how a physical light switch's position communicates its own
// state rather than the action of flipping it.
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
    >
      {isDark ? <Moon className="h-[18px] w-[18px]" strokeWidth={1.5} /> : <Sun className="h-[18px] w-[18px]" strokeWidth={1.5} />}
    </button>
  );
}
