"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

export type FeatureAnnouncementProps = {
  // A small kicker label ("New Tool", "New Article", "AI Feature", ...).
  // Optional -- an announcement doesn't have to be framed as "new".
  badge?: string;
  // A pre-rendered icon element (e.g. `<Calculator className="h-4 w-4" />`
  // from lucide-react), not a component reference. Has to be a ReactNode,
  // not a component type: the call site is a Server Component and this is
  // a Client Component, and a bare function/component reference can't be
  // serialized across that boundary -- only an actual rendered element can.
  // Entirely optional -- omit it for a plain text announcement.
  icon?: ReactNode;
  title: string;
  // Hidden below the sm breakpoint to keep the strip to one line on
  // narrow screens.
  description?: string;
  cta: string;
  href: string;
  // Defaults to true. Dismissal is remembered in localStorage keyed by
  // `href` (a natural unique id -- no separate id prop to remember to set
  // per announcement), so closing it closes it for good, not just for
  // this page view.
  dismissible?: boolean;
};

const STORAGE_PREFIX = "haarchive:dismissed-announcement:";

// A persistent, full-width strip at the very top of the homepage -- for
// one major, high-priority launch at a time (see FeaturedEssay for the
// always-present alternative it sits above; the two aren't stacked
// announcing the same thing twice). Deliberately restrained: a single
// dark row, one clear action, no color, no filled button.
//
// bg-zinc-950 in light mode reads as a dark strip against the page's
// light bg-stone-50 (see root layout) -- but the page's own background in
// dark mode is that *same* zinc-950 (dark:bg-zinc-950 on <body>), so this
// needs its own, lighter dark-mode surface color (zinc-900, matching
// Card's existing bg-white/dark:bg-zinc-900 convention) or it disappears
// into the page behind it.
//
// Every future launch (an AI coach, a marathon planner, a new account
// feature, a research tool) is just a different call site -- swap the
// props, never edit this file.
//
// Must only ever be loaded via next/dynamic(..., { ssr: false }) (see
// feature-announcement-loader.tsx / about-page.tsx): the plain,
// synchronous localStorage read in the useState initializer below is only
// safe because this never has a server-rendered version to hydrate-
// mismatch against -- it only ever mounts in the browser. That avoids both
// the "window is not defined" crash a server render would hit and the
// flash a useEffect-based check would cause for an already-dismissed
// visitor.
export function FeatureAnnouncement({
  badge,
  icon,
  title,
  description,
  cta,
  href,
  dismissible = true,
}: FeatureAnnouncementProps) {
  const storageKey = `${STORAGE_PREFIX}${href}`;
  const [dismissed, setDismissed] = useState(
    () => dismissible && window.localStorage.getItem(storageKey) === "1",
  );

  if (dismissed) return null;

  function dismiss() {
    window.localStorage.setItem(storageKey, "1");
    setDismissed(true);
  }

  return (
    <div className="animate-fade-in relative bg-zinc-950 text-white dark:bg-zinc-900">
      <div className="mx-auto flex w-full max-w-content flex-col items-start gap-2 px-6 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {icon ? (
            <span aria-hidden="true" className="shrink-0 leading-none opacity-80">
              {icon}
            </span>
          ) : null}
          {badge ? (
            <span className="shrink-0 rounded-full border border-white/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">
              {badge}
            </span>
          ) : null}
          <span className="font-semibold text-white">{title}</span>
          {description ? <span className="hidden text-zinc-400 sm:inline">{description}</span> : null}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href={href}
            className="group inline-flex items-center gap-1 text-sm font-medium text-zinc-200 transition hover:text-white"
          >
            {cta}
            <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>

          {dismissible ? (
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss announcement"
              className="rounded p-1 text-zinc-600 transition hover:text-zinc-300"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
