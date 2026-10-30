"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 260;

// Left panel: the page's own 5-item "Athlete Checklist" under "Recognizing
// Overtraining Before It Wrecks a Season" -- no symptom alone is proof,
// but two or more together is a real signal.
const SYMPTOMS = [
  "Unusually dark urine",
  "A puffy or swollen-looking face",
  "New cravings for salty or sugary food",
  "Resting heart rate creeping up from baseline",
  "A familiar easy pace suddenly feeling like a grind",
];
const ROW_Y_START = 46;
const ROW_GAP = 30;
const BANNER_Y = ROW_Y_START + SYMPTOMS.length * ROW_GAP + 6;

// Right panel: the page's own diagnostic tool -- "a consistent easy run
// over the same familiar loop, at the same easy heart rate... When that
// easy pace starts requiring a noticeably higher heart rate or perceived
// effort than it used to, that's the signal."
const DIAG_X0 = 430;
const DIAG_TRACK_X1 = 600;
const DIAG_BAR_WIDTH = 56;
const DIAG_BASELINE_Y = 200;
const USUAL_HR_HEIGHT = 66;
const TODAY_HR_HEIGHT = 102; // noticeably higher, same loop/effort

const EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const ROW_STAGGER_MS = 70; // keep stagger short (emil-design-eng: 30-80ms between items)

// Two-panel figure. The left checklist enters as a short staggered fade +
// rise (opacity/translateY, composite-only) row by row, in the order a
// reader would scan it, then the "2+ together" banner. The right
// diagnostic bars grow in via transform: scaleY, timed to start only after
// the checklist has mostly finished, so the two panels read in sequence:
// "here's the cluster, here's the actual test you'd run." All driven
// imperatively via refs + a forced reflow on Replay, never React state
// (animation-performance skill).
export function OvertrainingClusterDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(SVGGElement | null)[]>([]);
  const bannerRef = useRef<SVGGElement | null>(null);
  const usualGroupRef = useRef<SVGGElement | null>(null);
  const todayGroupRef = useRef<SVGGElement | null>(null);
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);

  function play() {
    rowRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.transition = `opacity 260ms ${EASE} ${i * ROW_STAGGER_MS}ms, transform 260ms ${EASE} ${i * ROW_STAGGER_MS}ms`;
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
    const bannerDelay = SYMPTOMS.length * ROW_STAGGER_MS + 120;
    if (bannerRef.current) {
      bannerRef.current.style.transition = `opacity 260ms ease-out ${bannerDelay}ms`;
      bannerRef.current.style.opacity = "1";
    }
    const diagStart = bannerDelay + 250;
    if (usualGroupRef.current) {
      usualGroupRef.current.style.transition = `transform 500ms ${EASE} ${diagStart}ms`;
      usualGroupRef.current.style.transform = "scaleY(1)";
    }
    if (todayGroupRef.current) {
      todayGroupRef.current.style.transition = `transform 500ms ${EASE} ${diagStart + 250}ms`;
      todayGroupRef.current.style.transform = "scaleY(1)";
    }
  }

  function reset() {
    rowRefs.current.forEach((el) => {
      if (!el) return;
      el.style.transition = "none";
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
    });
    if (bannerRef.current) {
      bannerRef.current.style.transition = "none";
      bannerRef.current.style.opacity = "0";
    }
    if (usualGroupRef.current) {
      usualGroupRef.current.style.transition = "none";
      usualGroupRef.current.style.transform = "scaleY(0)";
    }
    if (todayGroupRef.current) {
      todayGroupRef.current.style.transition = "none";
      todayGroupRef.current.style.transform = "scaleY(0)";
    }
  }

  function handleReplay() {
    reset();
    rowRefs.current[0]?.getBoundingClientRect(); // force a reflow before re-triggering
    requestAnimationFrame(play);
  }

  useEffect(() => {
    if (reducedMotion || hasPlayedOnce) return;
    reset();
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasPlayedOnce(true);
          play();
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion, hasPlayedOnce]);

  const staticFallback = reducedMotion;

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt="Two panels. Left: the page's five-symptom overtraining checklist -- unusually dark urine, a puffy or swollen face, new salty or sugary food cravings, a creeping resting heart rate, and a familiar easy pace suddenly feeling like a grind -- with two or more together flagged as a real signal to back off, not any single one alone. Right: the page's own diagnostic test, comparing a runner's usual heart rate on a familiar easy loop against today's heart rate for the same effort, where a noticeably higher reading is the actual signal to watch for."
      >
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
          {/* Divider between the two panels */}
          <line x1={400} y1={16} x2={400} y2={CHART_HEIGHT - 16} strokeWidth="1" className="stroke-zinc-200 dark:stroke-zinc-800" />

          {/* Left panel: the checklist */}
          <text x={16} y={22} className="fill-zinc-500 text-[11px] font-semibold tracking-wide uppercase dark:fill-zinc-400">
            Watch for these together
          </text>
          {SYMPTOMS.map((s, i) => (
            <g
              key={s}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              style={{
                opacity: staticFallback ? 1 : 0,
                transform: staticFallback ? "translateY(0)" : "translateY(8px)",
              }}
            >
              <circle cx={24} cy={ROW_Y_START + i * ROW_GAP} r="3.5" className="fill-[var(--accent-warning)]" />
              <text x={38} y={ROW_Y_START + i * ROW_GAP + 4} className="fill-zinc-700 text-[12px] dark:fill-zinc-200">
                {s}
              </text>
            </g>
          ))}
          <g ref={bannerRef} style={{ opacity: staticFallback ? 1 : 0 }}>
            <rect x={16} y={BANNER_Y} width={370} height={30} rx="6" className="fill-[var(--accent-warning)] opacity-[0.1]" />
            <text x={24} y={BANNER_Y + 19} className="fill-[var(--accent-warning)] text-[11px] font-semibold">
              2+ together = back off before the next hard session
            </text>
          </g>

          {/* Right panel: the diagnostic test */}
          <text x={DIAG_X0} y={22} className="fill-zinc-500 text-[11px] font-semibold tracking-wide uppercase dark:fill-zinc-400">
            Same loop, same effort
          </text>
          <line x1={DIAG_X0} y1={DIAG_BASELINE_Y} x2={DIAG_TRACK_X1} y2={DIAG_BASELINE_Y} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />

          <g
            ref={usualGroupRef}
            style={{
              transform: staticFallback ? "scaleY(1)" : "scaleY(0)",
              transformOrigin: `${DIAG_X0 + DIAG_BAR_WIDTH / 2}px ${DIAG_BASELINE_Y}px`,
              transformBox: "view-box",
            }}
          >
            <rect x={DIAG_X0} y={DIAG_BASELINE_Y - USUAL_HR_HEIGHT} width={DIAG_BAR_WIDTH} height={USUAL_HR_HEIGHT} rx="4" className="fill-zinc-400 dark:fill-zinc-500" />
          </g>
          <text x={DIAG_X0 + DIAG_BAR_WIDTH / 2} y={DIAG_BASELINE_Y + 18} textAnchor="middle" className="fill-zinc-500 text-[10.5px] dark:fill-zinc-400">
            Usual HR
          </text>

          <g
            ref={todayGroupRef}
            style={{
              transform: staticFallback ? "scaleY(1)" : "scaleY(0)",
              transformOrigin: `${DIAG_X0 + DIAG_BAR_WIDTH + 14 + DIAG_BAR_WIDTH / 2}px ${DIAG_BASELINE_Y}px`,
              transformBox: "view-box",
            }}
          >
            <rect
              x={DIAG_X0 + DIAG_BAR_WIDTH + 14}
              y={DIAG_BASELINE_Y - TODAY_HR_HEIGHT}
              width={DIAG_BAR_WIDTH}
              height={TODAY_HR_HEIGHT}
              rx="4"
              className="fill-[var(--accent-warning)]"
            />
          </g>
          <text x={DIAG_X0 + DIAG_BAR_WIDTH + 14 + DIAG_BAR_WIDTH / 2} y={DIAG_BASELINE_Y + 18} textAnchor="middle" className="fill-zinc-500 text-[10.5px] dark:fill-zinc-400">
            Today&rsquo;s HR
          </text>
          <text x={(DIAG_X0 + DIAG_TRACK_X1) / 2} y={DIAG_BASELINE_Y + 38} textAnchor="middle" className="fill-zinc-500 text-[10px] italic dark:fill-zinc-400">
            noticeably higher = the signal
          </text>
        </svg>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          No single symptom on the left is proof on its own; two or more together, especially alongside a familiar
          easy pace suddenly feeling hard, is the page&rsquo;s own real signal to back off. The right panel&rsquo;s
          relative bar heights are illustrative, not measured heart-rate values.
        </p>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the overtraining cluster animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
    </div>
  );
}
