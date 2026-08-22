"use client";

import { useActionState, useEffect, useId, useRef } from "react";

import { submitBugReport, type SubmitBugReportState } from "@/app/bug-report-actions";
import { buildBugReportMetadata } from "@/lib/bug-report/metadata";
import { fieldClass, labelClass } from "@/lib/form-styles";
import { Button } from "@/components/ui/button";
import { SuccessPanel } from "@/components/ui/success-panel";
import { FormError } from "@/components/ui/form-error";
import type { CaptureState } from "@/components/bug-report/bug-report-trigger";

type BugReportFormProps = {
  capture: CaptureState;
  onRetake: () => void;
  onSubmitted: () => void;
};

export function BugReportForm({ capture, onRetake, onSubmitted }: BugReportFormProps) {
  const descriptionId = useId();
  const websiteId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mirrors note-card.tsx's own autoFocus-on-open precedent -- Drawer's own
  // open effect focuses the panel itself (a landing point, not a real tab
  // stop) specifically so a call site with a more useful first focus target
  // can claim it, exactly like this. Deferred one frame, not a bare mount
  // effect: Drawer's own open effect captures document.activeElement into
  // previouslyFocusedRef *synchronously within its own effect body*, to
  // restore focus there on close -- a same-tick focus() call here can run
  // before that capture (effect order between a parent and a child isn't
  // something either component should depend on) and get captured as the
  // "previous" focus instead of the real trigger, which breaks focus
  // restoration on close (found live: Escape closed the panel correctly,
  // but focus fell back to <body> instead of the trigger button). One
  // rAF guarantees this runs strictly after every mount effect from this
  // same commit, including Drawer's.
  useEffect(() => {
    const raf = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  const [state, formAction, isPending] = useActionState<SubmitBugReportState, FormData>(
    async (prevState, formData) => {
      if (capture.status === "success") {
        formData.set("screenshot", capture.blob, "screenshot.jpg");
      }
      const metadata = buildBugReportMetadata({
        href: window.location.href,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        userAgent: navigator.userAgent,
      });
      formData.set("pageUrl", metadata.pageUrl);
      formData.set("viewportWidth", String(metadata.viewportWidth));
      formData.set("viewportHeight", String(metadata.viewportHeight));
      formData.set("devicePixelRatio", String(metadata.devicePixelRatio));
      formData.set("userAgent", metadata.userAgent);
      return submitBugReport(prevState, formData);
    },
    {},
  );

  if (state.success) {
    return (
      <SuccessPanel heading="Bug reported — thank you.">
        I read every report myself.
        <div className="mt-4">
          <Button type="button" variant="outline" size="sm" onClick={onSubmitted}>
            Close
          </Button>
        </div>
      </SuccessPanel>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">Something not working right?</p>

      <div>
        <p className={labelClass}>Screenshot</p>

        {capture.status === "capturing" ? (
          <p role="status" aria-live="polite" className="text-sm text-zinc-500 dark:text-zinc-400">
            Capturing page…
          </p>
        ) : null}

        {capture.status === "success" ? (
          <div aria-live="polite">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Your screenshot captures what&rsquo;s currently visible on this page. Review it before submitting.
            </p>
            <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-black/10 dark:border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element -- a
                  local blob: preview, not a next/image-optimizable remote
                  asset (see content-blocks.tsx's own established convention
                  for the same reasoning). */}
              <img src={capture.previewUrl} alt="Screenshot preview of the current page" className="w-full" />
            </div>
            <button
              type="button"
              onClick={onRetake}
              className="mt-2 text-xs font-semibold text-zinc-500 underline underline-offset-2 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Retake screenshot
            </button>
          </div>
        ) : null}

        {capture.status === "unavailable" ? (
          <div aria-live="polite">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Screenshot couldn&rsquo;t be captured, but you can still report the issue.
            </p>
            <button
              type="button"
              onClick={onRetake}
              className="mt-1 text-xs font-semibold text-zinc-500 underline underline-offset-2 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Try again
            </button>
          </div>
        ) : null}
      </div>

      <div>
        <label htmlFor={descriptionId} className={labelClass}>
          What went wrong?
        </label>
        <textarea
          ref={textareaRef}
          id={descriptionId}
          name="description"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder="Tell us what you expected to happen and what happened instead — and anything else that might help."
          className={`${fieldClass} w-full`}
        />
      </div>

      {/* Honeypot -- invisible to real visitors, irresistible to bots that
          fill every field. A non-empty value here silently fails validation. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor={websiteId}>Website</label>
        <input id={websiteId} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {state.error ? <FormError>{state.error}</FormError> : null}

      <Button type="submit" size="lg" disabled={isPending || capture.status === "capturing"}>
        {isPending ? "Submitting…" : "Submit Bug"}
      </Button>
    </form>
  );
}
