"use client";

import { domToCanvas } from "modern-screenshot";

// The one real capture boundary -- see layout.tsx's own comment on why this
// id, not document.body, is the target (every Drawer/modal in the app
// portals to document.body as a *sibling* of this element, so capturing
// this instead of body already excludes them -- no redaction list to keep
// in sync as new drawers get added).
const CAPTURE_TARGET_ID = "page-content";

// Renders reasonably fast for a typical page, but a very long article is a
// tall DOM tree to walk/serialize -- this bounds how long a visitor waits
// before the flow gives up and falls back to "no screenshot" rather than
// hanging the modal open on a blank/loading state indefinitely.
const CAPTURE_TIMEOUT_MS = 8000;
const JPEG_QUALITY = 0.85;

export type ScreenshotCaptureResult =
  | { status: "success"; blob: Blob; previewUrl: string }
  | { status: "unavailable" };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Screenshot capture timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// Captures only what's actually visible right now, not the whole
// scrollable page: modern-screenshot renders a node at its own full
// (scrollWidth x scrollHeight) size, which for a long article would be
// every paragraph from top to bottom, not just what's on screen -- so this
// renders the full page-content element once, then crops a fresh canvas to
// exactly the current [scrollX, scrollY, innerWidth, innerHeight] window
// before ever producing a Blob. Nothing off-screen, nothing from another
// tab or the browser chrome, ever leaves this function.
//
// Known limitation: because the render is a static clone of the DOM (not a
// live compositor snapshot), a `position: sticky` element like the site
// header won't appear "pinned" at the crop's top edge once scrolled past
// its own natural position in the page -- the crop still shows the correct
// underlying content for that scroll position, just without the header
// overlaid on top of it. Accepted as a known, disclosed limitation rather
// than solved for v1 (see the bug-report feature's final report).
export async function capturePageScreenshot(): Promise<ScreenshotCaptureResult> {
  if (typeof document === "undefined") return { status: "unavailable" };
  const target = document.getElementById(CAPTURE_TARGET_ID);
  if (!target) return { status: "unavailable" };

  try {
    const backgroundColor = getComputedStyle(document.body).backgroundColor || "#000000";
    const fullCanvas = await withTimeout(
      domToCanvas(target, { backgroundColor, scale: 1 }),
      CAPTURE_TIMEOUT_MS,
    );

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const cropped = document.createElement("canvas");
    cropped.width = viewportWidth;
    cropped.height = viewportHeight;
    const ctx = cropped.getContext("2d");
    if (!ctx) return { status: "unavailable" };

    ctx.drawImage(
      fullCanvas,
      window.scrollX,
      window.scrollY,
      viewportWidth,
      viewportHeight,
      0,
      0,
      viewportWidth,
      viewportHeight,
    );

    const blob = await new Promise<Blob | null>((resolve) => cropped.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) return { status: "unavailable" };
    return { status: "success", blob, previewUrl: URL.createObjectURL(blob) };
  } catch {
    // Any failure (timeout, a cross-origin image the canvas can't read,
    // etc.) degrades to "no screenshot," never a broken modal -- see
    // note-card's own precedent for "accuracy/safety over forcing a
    // result."
    return { status: "unavailable" };
  }
}

export function revokeScreenshotPreviewUrl(previewUrl: string): void {
  URL.revokeObjectURL(previewUrl);
}
