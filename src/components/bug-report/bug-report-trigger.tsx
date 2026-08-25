"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  capturePageScreenshot,
  revokeScreenshotPreviewUrl,
  type ScreenshotCaptureResult,
} from "@/lib/bug-report/capture-screenshot";
import { Drawer } from "@/components/ui/drawer";
import { Tooltip } from "@/components/ui/tooltip";
import { BugReportForm } from "@/components/bug-report/bug-report-form";

export type CaptureState = { status: "idle" } | { status: "capturing" } | ScreenshotCaptureResult;

type BugReportTriggerProps = {
  // "text" (default): the footer's own text link, exactly as it already
  // was -- untouched by adding this prop. "icon": a compact icon-only
  // button matching the navbar's other utility icons (search, Questions),
  // for the new navbar entry point. Same underlying open/capture/session
  // state and the same Drawer either way -- only the trigger's own markup
  // differs, so mounting this twice (footer + navbar) never duplicates the
  // screenshot/validation/submission logic, just the small trigger control
  // itself, the same way NotificationBell already renders twice (desktop
  // cluster + mobile menu) without duplicating notification logic.
  variant?: "text" | "icon";
  // Only meaningful for variant="icon". "md" (default, 48px) is the
  // original size, still used in the mobile menu where a larger touch
  // target genuinely matters more. "sm" (40px) matches the desktop header
  // icon cluster's other buttons (search, Questions, ThemeToggle) -- see
  // site-header.tsx's own space-budget comments for why that row is
  // tighter than the mobile one.
  size?: "md" | "sm";
};

const ICON_BUTTON_SIZE_CLASSES: Record<"md" | "sm", string> = {
  md: "h-12 w-12",
  sm: "h-10 w-10",
};

// The "Report a Bug" entry point -- houses the trigger button, the
// screenshot-capture lifecycle, and the Drawer together, the same shape
// article-notes.tsx uses for its own trigger + panel. Capture starts the
// moment the drawer opens, not on every keystroke or hover -- "capture
// screenshot -> preview -> describe -> submit" is the whole flow, and
// nothing here uploads anything until the form itself is actually
// submitted (see capture-screenshot.ts and bug-report-actions.ts).
export function BugReportTrigger({ variant = "text", size = "md" }: BugReportTriggerProps) {
  const [open, setOpen] = useState(false);
  const [capture, setCapture] = useState<CaptureState>({ status: "idle" });
  // Bumped on every open so BugReportForm remounts fresh each time (a new
  // useActionState, a blank textarea, no stale success/error state from a
  // previous report) -- see the component's own key usage below.
  const [session, setSession] = useState(0);
  const captureRef = useRef(capture);
  useEffect(() => {
    captureRef.current = capture;
  }, [capture]);

  function runCapture() {
    if (captureRef.current.status === "success") {
      revokeScreenshotPreviewUrl(captureRef.current.previewUrl);
    }
    setCapture({ status: "capturing" });
    void capturePageScreenshot().then(setCapture);
  }

  function handleOpen() {
    setSession((s) => s + 1);
    setOpen(true);
    runCapture();
  }

  // useCallback, not a plain function -- Drawer's own open effect depends
  // on its `onClose` prop (see drawer.tsx's [open, onClose, isMobileSheet]
  // dependency array), and a fresh function identity on every render
  // re-runs that effect even when `open` itself hasn't changed. That effect
  // re-focuses the panel every time it runs -- so a plain (non-memoized)
  // handleClose here re-stole focus back to the panel every time this
  // component re-rendered for an unrelated reason (screenshot capture
  // resolving asynchronously, mid-open, was the concrete case that
  // surfaced it live: BugReportForm's own textarea auto-focus effect would
  // win the *first* frame, then lose it again the moment `capture` state
  // updated a few hundred ms later). A stable reference here stops Drawer's
  // effect from re-running for any reason other than `open` itself
  // changing.
  const handleClose = useCallback(() => setOpen(false), []);

  // Only cleans up on unmount (the whole trigger leaving the tree, e.g. a
  // route change that swaps the footer) -- an in-progress capture between
  // opens is already revoked by runCapture's own guard above.
  useEffect(() => {
    return () => {
      if (captureRef.current.status === "success") revokeScreenshotPreviewUrl(captureRef.current.previewUrl);
    };
  }, []);

  const iconButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      {variant === "icon" ? (
        <span className="relative inline-flex">
          <button
            ref={iconButtonRef}
            type="button"
            onClick={handleOpen}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label="Report a bug"
            className={`flex items-center justify-center rounded-full text-zinc-500 transition hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white ${ICON_BUTTON_SIZE_CLASSES[size]}`}
          >
            {/* A restrained line-art bug glyph, matching the header's other
                icons (thin ~1.4 stroke, 18px, no fill) -- deliberately not
                red/orange or alert-styled: this is a utility affordance,
                not a warning indicator. */}
            <svg className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <rect x="7" y="7" width="6" height="8" rx="3" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10 7V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <path d="M8 5L7 3.5M12 5L13 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <path
                d="M7 9H4M7 11.5H4M7 14H5M13 9H16M13 11.5H16M13 14H15"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <Tooltip label="Report a bug" side="bottom" align="center" anchorRef={iconButtonRef} />
        </span>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
        >
          Report a Bug
        </button>
      )}
      <Drawer open={open} onClose={handleClose} title="Report a Bug">
        <BugReportForm key={session} capture={capture} onRetake={runCapture} onSubmitted={handleClose} />
      </Drawer>
    </>
  );
}
