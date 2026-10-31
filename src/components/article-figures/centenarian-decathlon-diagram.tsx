"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";

import { Diagram } from "@/components/ui/diagram";
import { Button } from "@/components/ui/button";
import { segmentedButtonClass } from "@/lib/tool-styles";

// Same flatter viewBox + toggle-between-two-views-in-one-viewBox convention
// as this batch's other two toggled figures -- switching never changes
// this figure's own height.
const CHART_WIDTH = 640;
const CHART_HEIGHT = 300;

type View = "distinction" | "tasks";

// Training Through the Decades's own second paragraph (sections.ts), citing
// Attia, Outlive, 2023: "lifespan (years alive) versus health span (years
// of those spent with full physical function): a masters runner optimizing
// purely for more racing years without attention to strength and mobility
// risks winning on the first measure while losing ground on the second."
// The two lines below are illustrative shapes only (lifespan flat/long,
// healthspan declining earlier without a reserve) -- no age or percentage
// is invented; the page gives none.
const AGE_START = 30;
const AGE_END = 90;

// The three concrete tasks are the page's own named examples, verbatim:
// "carrying groceries, getting up off the floor, hiking with grandchildren."
const TASKS = ["Carrying groceries", "Getting up off the floor", "Hiking with grandchildren"];

const SWEEP_DURATION_MS = 900;
const SWEEP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)"; // emil-design-eng's strong ease-out
const HIDDEN_CLIP = "inset(0 100% 0 0)";
const REVEALED_CLIP = "inset(0 0% 0 0)";

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
      el.style.transition = "opacity 200ms ease-out, transform 200ms ease-out";
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

export function CentenarianDecathlonDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>("distinction");
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

  // Lifespan: a flat, long line -- "years alive," unaffected by physical
  // function. Healthspan: declines earlier without attention to strength
  // and mobility, which is the gap the page's own framing points at.
  const distinctionView = (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
      <text x={CHART_WIDTH / 2} y={22} textAnchor="middle" className="fill-zinc-400 text-[11px] font-semibold tracking-wide uppercase dark:fill-zinc-500">
        Lifespan vs. health span
      </text>
      <text x={CHART_WIDTH / 2} y={40} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
        Years alive, vs. years of those spent with full physical function
      </text>

      <line x1={64} y1={240} x2={576} y2={240} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
      <text x={64} y={258} className="fill-zinc-500 text-[10px] dark:fill-zinc-400">
        {AGE_START}
      </text>
      <text x={576} y={258} textAnchor="end" className="fill-zinc-500 text-[10px] dark:fill-zinc-400">
        {AGE_END}+
      </text>
      <text x={320} y={272} textAnchor="middle" className="fill-zinc-400 text-[10px] italic dark:fill-zinc-500">
        age
      </text>

      {/* Lifespan: flat, stays at the top the whole way. */}
      <line x1={64} y1={78} x2={576} y2={78} strokeWidth="2.5" className="stroke-[var(--accent-tip)]" />
      <text x={584} y={82} className="fill-[var(--accent-tip)] text-[11px] font-semibold">
        Lifespan
      </text>

      {/* Healthspan without a reserve: starts dropping earlier. */}
      <path
        d="M64,78 C 220,80 300,100 360,150 C 420,196 480,224 576,236"
        fill="none"
        strokeWidth="2.5"
        strokeDasharray="6 5"
        className="stroke-[var(--accent-warning)]"
      />
      <text x={584} y={232} className="fill-[var(--accent-warning)] text-[10.5px] font-semibold">
        Health span
      </text>
      <text x={584} y={246} className="fill-zinc-400 text-[9px] italic dark:fill-zinc-500">
        without a reserve
      </text>

      <g>
        <rect x={64} y={100} width={240} height={56} rx="6" fill="none" strokeWidth="1" strokeDasharray="3 3" className="stroke-zinc-300 dark:stroke-zinc-700" />
        <text x={76} y={120} className="fill-zinc-500 text-[9.5px] font-semibold tracking-wide uppercase dark:fill-zinc-400">
          The risk
        </text>
        <text x={76} y={136} className="fill-zinc-600 text-[10px] dark:fill-zinc-300">
          Winning on racing years alone
        </text>
        <text x={76} y={150} className="fill-zinc-600 text-[10px] dark:fill-zinc-300">
          while losing ground on function.
        </text>
      </g>
    </svg>
  );

  // Tasks: the page's own three concrete examples, with a note that the
  // reserve for them is built decades before it's needed.
  const tasksView = (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
      <text x={CHART_WIDTH / 2} y={24} textAnchor="middle" className="fill-zinc-400 text-[11px] font-semibold tracking-wide uppercase dark:fill-zinc-500">
        The Centenarian Decathlon
      </text>
      <text x={CHART_WIDTH / 2} y={42} textAnchor="middle" className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
        Training now for concrete tasks you&rsquo;ll want at 80 or 90
      </text>

      {TASKS.map((task, i) => {
        const x = 70 + i * 170;
        return (
          <g key={task}>
            <rect x={x} y={70} width={150} height={92} rx="8" fill="none" strokeWidth="1.5" className="stroke-zinc-300 dark:stroke-zinc-700" />
            <circle cx={x + 75} cy={102} r="16" className="fill-[var(--accent-research)] opacity-[0.14]" />
            <text x={x + 75} y={108} textAnchor="middle" className="fill-[var(--accent-research)] text-[13px] font-semibold">
              {i + 1}
            </text>
            <text x={x + 75} y={138} textAnchor="middle" className="fill-zinc-600 text-[10.5px] font-semibold dark:fill-zinc-200">
              {task.split(" ").slice(0, 2).join(" ")}
            </text>
            <text x={x + 75} y={152} textAnchor="middle" className="fill-zinc-600 text-[10.5px] font-semibold dark:fill-zinc-200">
              {task.split(" ").slice(2).join(" ")}
            </text>
          </g>
        );
      })}

      <polygon points="300,196 300,210 320,203" className="fill-zinc-400 dark:fill-zinc-500" />

      <g>
        <rect x={64} y={214} width={512} height={58} rx="6" fill="none" strokeWidth="1" strokeDasharray="3 3" className="stroke-zinc-300 dark:stroke-zinc-700" />
        <text x={76} y={234} className="fill-zinc-500 text-[9.5px] font-semibold tracking-wide uppercase dark:fill-zinc-400">
          Built decades early
        </text>
        <text x={76} y={250} className="fill-zinc-600 text-[10.5px] dark:fill-zinc-300">
          Requires a strength and mobility reserve built decades before
        </text>
        <text x={76} y={264} className="fill-zinc-600 text-[10.5px] dark:fill-zinc-300">
          you&rsquo;ll need to draw on it &mdash; not waiting until decline is visible.
        </text>
      </g>
    </svg>
  );

  return (
    <div ref={containerRef}>
      <Diagram
        aspect="wide"
        alt={
          view === "distinction"
            ? "A chart distinguishing lifespan, a flat line representing years alive, from health span, a dashed line that declines earlier without attention to strength and mobility, representing years spent with full physical function. A note warns that optimizing purely for racing years risks winning on lifespan while losing ground on health span."
            : "Three labeled cards showing the Centenarian Decathlon's concrete physical tasks: carrying groceries, getting up off the floor, and hiking with grandchildren. A note below explains that these require a strength and mobility reserve built decades before it's needed, not waiting until decline is already visible."
        }
      >
        <div ref={sweepRef} className="h-full w-full" style={{ clipPath: staticFallback ? REVEALED_CLIP : HIDDEN_CLIP }}>
          <PanelEntrance key={view} animate={!staticFallback && hasPlayedOnce}>
            {view === "distinction" ? distinctionView : tasksView}
          </PanelEntrance>
        </div>
      </Diagram>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Lifespan vs. health span or the concrete tasks">
          <button type="button" onClick={() => setView("distinction")} className={segmentedButtonClass(view === "distinction")}>
            Lifespan vs. health span
          </button>
          <button type="button" onClick={() => setView("tasks")} className={segmentedButtonClass(view === "tasks")}>
            The concrete tasks
          </button>
        </div>
        {!staticFallback ? (
          <Button type="button" variant="outline" size="md" onClick={handleReplay} aria-label="Replay the Centenarian Decathlon animation">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Replay
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Illustrative curve shapes, not measured data &mdash; Attia,{" "}
        <em>Outlive</em> (2023).
      </p>
    </div>
  );
}
