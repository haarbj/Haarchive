"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";

import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";
import { segmentedButtonClass } from "@/lib/tool-styles";

// Same flatter viewBox + toggle-between-two-views-in-one-viewBox convention
// as heart-rate-myth-vs-talk-test-diagram.tsx / vena-cava-compression-
// diagram.tsx -- switching the toggle never changes this figure's own
// height, so zero attributable layout shift either way.
const CHART_WIDTH = 640;
const CHART_HEIGHT = 300;

type View = "mechanism" | "lever";

// Training Through the Decades's own first paragraph (sections.ts): "The
// decline is driven more by peripheral factors (shrinking muscle mass
// reducing how much oxygen the muscle can actually extract and use) than by
// central factors like heart rate; maximum heart rate does drop gradually,
// but stroke volume (how much blood the heart pumps per beat) holds up
// fairly well into a runner's 50s and 60s with continued training." No bar
// heights below are measured data -- they're illustrative, "more decline"
// vs "less decline" proportions that match the page's own relative language
// ("driven more by," "holds up fairly well"), the same relative-bar
// convention as capillary-densification-diagram.tsx.
const MECHANISM_BARS = [
  { label: "Max heart rate", sub: "drops gradually", decline: 0.3, tone: "var(--accent-tip)" },
  { label: "Stroke volume", sub: "holds up well into 50s/60s", decline: 0.12, tone: "var(--accent-tip)" },
  { label: "Muscle mass & O2 extraction", sub: "drives most of the decline", decline: 0.62, tone: "var(--accent-warning)" },
];

// Same paragraph's second half: "Fast-twitch muscle fiber loss with age is
// largely irreversible once it happens, while slow-twitch fiber loss can be
// meaningfully offset by resistance training, which is the practical case
// for starting serious strength work in your 30s, before the losses begin."
// The lever view shows exactly those two fiber types side by side -- no
// numeric percentage for either is invented, since the page gives none.
const BAR_X = 230;
const BAR_WIDTH = 300;
const BAR_HEIGHT = 26;
const MECH_ROW_Y = [70, 130, 190];

const SWEEP_DURATION_MS = 900;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

// Same panel-swap entrance as the other toggled figures in this batch -- the
// h-full wrapper is required, not decorative (Diagram's `[&_svg]:h-full`
// rule has nothing real to propagate from without it, which silently
// clipped content at 390px in a prior batch).
function PanelEntrance({ animate, children }: { animate: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!animate) return;
    const el = ref.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.opacity = "0";
    el.style.transform = "scale(0.98)";
    el.getBoundingClientRect(); // force a reflow before the transition below starts
    requestAnimationFrame(() => {
      el.style.transition =
        "opacity 200ms cubic-bezier(0.23, 1, 0.32, 1), transform 200ms cubic-bezier(0.23, 1, 0.32, 1)";
      el.style.opacity = "1";
      el.style.transform = "scale(1)";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once per mount (re-keyed by the caller on view change), not on every render
  }, []);
  return (
    <div ref={ref} className="h-full w-full">
      {children}
    </div>
  );
}

export function CentralVsPeripheralVo2MaxDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>("mechanism");
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);

  function reveal() {
    const el = sweepRef.current;
    if (!el) return;
    el.style.transition = `clip-path ${SWEEP_DURATION_MS}ms ${SWEEP_EASE}`;
    el.style.clipPath = REVEALED_CLIP;
  }

  function handleReplay() {
    const el = sweepRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.clipPath = HIDDEN_CLIP;
    el.offsetHeight; // eslint-disable-line @typescript-eslint/no-unused-expressions -- force a reflow before re-triggering
    requestAnimationFrame(reveal);
  }

  useEffect(() => {
    if (reducedMotion || hasPlayedOnce) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasPlayedOnce(true);
          reveal();
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion, hasPlayedOnce]);

  const staticFallback = reducedMotion;

  const mechanismView = (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
      <text x={CHART_WIDTH / 2} y={24} textAnchor="middle" className="fill-zinc-400 text-[11px] font-semibold tracking-wide uppercase dark:fill-zinc-500">
        What actually drives the VO2 max decline
      </text>
      <text x={CHART_WIDTH / 2} y={42} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
        Central (heart) factors hold up better than peripheral (muscle) factors
      </text>

      {MECHANISM_BARS.map((bar, i) => {
        const y = MECH_ROW_Y[i];
        const width = BAR_WIDTH * bar.decline;
        return (
          <g key={bar.label}>
            <text x={BAR_X - 14} y={y + BAR_HEIGHT / 2 - 5} textAnchor="end" className="fill-zinc-600 text-[11px] font-semibold dark:fill-zinc-200">
              {bar.label}
            </text>
            <text x={BAR_X - 14} y={y + BAR_HEIGHT / 2 + 10} textAnchor="end" className="fill-zinc-400 text-[9.5px] italic dark:fill-zinc-500">
              {bar.sub}
            </text>
            <rect x={BAR_X} y={y} width={BAR_WIDTH} height={BAR_HEIGHT} rx="5" className="fill-zinc-100 dark:fill-zinc-900" />
            <rect x={BAR_X} y={y} width={width} height={BAR_HEIGHT} rx="5" fill={bar.tone} />
          </g>
        );
      })}

      <text x={BAR_X} y={MECH_ROW_Y[2] + BAR_HEIGHT + 28} className="fill-zinc-400 text-[9.5px] dark:fill-zinc-500">
        Illustrative proportions &mdash; relative, not measured percentages
      </text>
    </svg>
  );

  const leverView = (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
      <text x={CHART_WIDTH / 2} y={24} textAnchor="middle" className="fill-zinc-400 text-[11px] font-semibold tracking-wide uppercase dark:fill-zinc-500">
        The strength-training lever
      </text>
      <text x={CHART_WIDTH / 2} y={42} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
        Fast-twitch fiber loss is largely irreversible; slow-twitch loss can be offset
      </text>

      {/* Fast-twitch: a locked bar -- no recovery shown, matching the
          page's "largely irreversible once it happens." */}
      <g>
        <text x={100} y={92} textAnchor="middle" className="fill-zinc-600 text-[12px] font-semibold dark:fill-zinc-200">
          Fast-twitch fiber loss
        </text>
        <rect x={40} y={106} width={120} height={70} rx="8" fill="none" strokeWidth="1.5" className="stroke-zinc-300 dark:stroke-zinc-700" />
        <rect x={40} y={106} width={120} height={70} rx="8" className="fill-[var(--accent-error)] opacity-[0.12]" />
        <text x={100} y={146} textAnchor="middle" className="fill-zinc-700 text-[10.5px] font-semibold dark:fill-zinc-100">
          Largely
        </text>
        <text x={100} y={160} textAnchor="middle" className="fill-zinc-700 text-[10.5px] font-semibold dark:fill-zinc-100">
          irreversible
        </text>
        <text x={100} y={192} textAnchor="middle" className="fill-zinc-400 text-[9.5px] dark:fill-zinc-500">
          once it happens
        </text>
      </g>

      {/* Slow-twitch: resistance training offsets some of the loss -- a
          partial-recovery bar, revealed by the clip-path sweep together
          with the rest of the panel. */}
      <g>
        <text x={540} y={92} textAnchor="middle" className="fill-zinc-600 text-[12px] font-semibold dark:fill-zinc-200">
          Slow-twitch fiber loss
        </text>
        <rect x={480} y={106} width={120} height={70} rx="8" fill="none" strokeWidth="1.5" className="stroke-zinc-300 dark:stroke-zinc-700" />
        <rect x={480} y={106} width={120} height={70} rx="8" className="fill-[var(--accent-success)] opacity-[0.14]" />
        <text x={540} y={140} textAnchor="middle" className="fill-zinc-700 text-[10.5px] font-semibold dark:fill-zinc-100">
          Meaningfully
        </text>
        <text x={540} y={154} textAnchor="middle" className="fill-zinc-700 text-[10.5px] font-semibold dark:fill-zinc-100">
          offset by
        </text>
        <text x={540} y={168} textAnchor="middle" className="fill-zinc-700 text-[10.5px] font-semibold dark:fill-zinc-100">
          resistance training
        </text>
      </g>

      <polygon points="230,138 230,152 250,145" className="fill-zinc-400 dark:fill-zinc-500" />
      <text x={320} y={141} textAnchor="middle" className="fill-zinc-500 text-[9.5px] dark:fill-zinc-400">
        vs.
      </text>

      <g>
        <rect x={64} y={212} width={512} height={58} rx="6" fill="none" strokeWidth="1" strokeDasharray="3 3" className="stroke-zinc-300 dark:stroke-zinc-700" />
        <text x={76} y={232} className="fill-zinc-500 text-[9.5px] font-semibold tracking-wide uppercase dark:fill-zinc-400">
          The practical case
        </text>
        <text x={76} y={248} className="fill-zinc-600 text-[10.5px] dark:fill-zinc-300">
          Start serious strength work in your 30s &mdash; before the losses begin,
        </text>
        <text x={76} y={262} className="fill-zinc-600 text-[10.5px] dark:fill-zinc-300">
          not once a slowdown is already underway.
        </text>
      </g>
    </svg>
  );

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt={
          view === "mechanism"
            ? "Three horizontal bars comparing how much each factor contributes to age-related VO2 max decline: max heart rate drops gradually (a small bar), stroke volume holds up well into a runner's 50s and 60s with continued training (an even smaller bar), and muscle mass and oxygen extraction, a peripheral factor, drives most of the decline (the largest bar)."
            : "A comparison of two muscle fiber types' response to aging: fast-twitch fiber loss is largely irreversible once it happens, shown as a locked box, while slow-twitch fiber loss can be meaningfully offset by resistance training, shown as a box labeled accordingly. A note below states the practical case for starting serious strength work in your 30s, before the losses begin."
        }
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <PanelEntrance key={view} animate={!staticFallback && hasPlayedOnce}>
            {view === "mechanism" ? mechanismView : leverView}
          </PanelEntrance>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Central vs. peripheral mechanism or the strength training lever">
          <button type="button" onClick={() => setView("mechanism")} className={segmentedButtonClass(view === "mechanism")}>
            Central vs. peripheral
          </button>
          <button type="button" onClick={() => setView("lever")} className={segmentedButtonClass(view === "lever")}>
            The strength lever
          </button>
        </div>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the VO2 max decline animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Illustrative proportions, not measured percentages &mdash; the mechanism and the fiber-type distinction are
        the page&rsquo;s own text.
      </p>
    </div>
  );
}
