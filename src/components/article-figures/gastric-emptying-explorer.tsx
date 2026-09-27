"use client";

import { useId, useMemo, useState } from "react";

import { scaleLinear } from "@/components/article-figures/svg-scale";
import { sectionLabelClass, segmentedButtonClass, statLabelClass } from "@/lib/tool-styles";

const CHART_WIDTH = 720;
const CHART_HEIGHT = 340;
const PAD_LEFT = 46;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 48;
const PLOT_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

const INTENSITY_MIN = 45;
const INTENSITY_MAX = 90;
const RESEARCH_ZONE_END = 70;
const TRANSITION_ZONE_END = 80;

const xScale = scaleLinear([INTENSITY_MIN, INTENSITY_MAX], [PAD_LEFT, PAD_LEFT + PLOT_WIDTH]);
// A relative, illustrative 0-100 "gastric emptying rate" -- not a measured
// unit. Higher = emptying more readily; this is deliberately unitless (see
// the supplied source's own caveat that the graph is a reference showing a
// qualitative pattern, not a numeric dataset).
const yScale = scaleLinear([0, 100], [PAD_TOP + PLOT_HEIGHT, PAD_TOP]);

// A smooth, monotonically-declining curve shape -- not digitized from the
// supplied image. `baseline` sets the overall level, `midpoint` is the
// intensity where the decline is steepest, `steepness` controls how sharp
// that drop is. Used only to draw an illustrative, qualitatively-correct
// shape (flat-ish through the low/moderate range, falling off at higher
// intensity), never presented as measured data.
function emptyingCurve(baseline: number, midpoint: number, steepness: number) {
  return (x: number) => {
    const floor = Math.max(0, baseline - 55);
    return floor + 55 / (1 + Math.exp((x - midpoint) / steepness));
  };
}

const REPRESENTATIVE_CURVE = emptyingCurve(95, 75, 6);

// Four individual response shapes, spanning the range of starting level and
// how sharply each declines -- preserving the supplied graph's central
// qualitative message (large individual variation) without claiming these
// are real athletes' measured data.
const INDIVIDUAL_CURVES: { label: string; curve: (x: number) => number }[] = [
  { label: "Tolerates high intensity well", curve: emptyingCurve(100, 84, 5) },
  { label: "Typical decline", curve: emptyingCurve(90, 74, 6) },
  { label: "Drops off earlier", curve: emptyingCurve(85, 64, 7) },
  { label: "Sensitive at any intensity", curve: emptyingCurve(65, 68, 4) },
];

const SAMPLE_COUNT = 46; // one sample per whole percent from 45-90

function samplePoints(curve: (x: number) => number): { x: number; y: number }[] {
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const x = INTENSITY_MIN + i;
    return { x: xScale(x), y: yScale(curve(x)) };
  });
}

function pathFor(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

// These zone boundaries are approximate dividers for orientation, not fixed
// biological thresholds -- exactly where any individual runner's own
// gastric emptying starts to slow varies (see the paragraph above the
// chart and the individual curves below), so the labels here describe
// tendencies across the research, not a universal cutoff every runner
// crosses at the same intensity.
function zoneFor(intensity: number): { label: string; blurb: string } {
  if (intensity < RESEARCH_ZONE_END) {
    return {
      label: "Standard research zone",
      blurb: "Most gastric-emptying studies are run around this intensity -- easy to moderate effort.",
    };
  }
  if (intensity < TRANSITION_ZONE_END) {
    return {
      label: "Transition zone",
      blurb: "Blood flow is starting to shift away from the gut toward working muscle.",
    };
  }
  return {
    label: "Marathon-intensity zone",
    blurb: "Around the effort many trained runners sustain for a marathon. Research suggests emptying tends to slow further in this range, but exactly how much varies by runner.",
  };
}

// The centerpiece visual for Fueling Fridays #1: an illustrative,
// interactive chart showing how gastric emptying tends to decline as
// running intensity rises, and how much that decline varies between
// runners. See the component's own inline comments for exactly what is
// and isn't a real measurement -- this is a conceptual relationship, not a
// personal fueling calculator.
export function GastricEmptyingExplorer() {
  const baseId = useId();
  const [intensity, setIntensity] = useState(75);
  const [showIndividual, setShowIndividual] = useState(true);

  const representativePath = useMemo(() => pathFor(samplePoints(REPRESENTATIVE_CURVE)), []);
  const individualPaths = useMemo(
    () => INDIVIDUAL_CURVES.map((c) => ({ label: c.label, d: pathFor(samplePoints(c.curve)) })),
    [],
  );

  const markerX = xScale(intensity);
  const markerY = yScale(REPRESENTATIVE_CURVE(intensity));
  const zone = zoneFor(intensity);

  const researchZoneX0 = xScale(INTENSITY_MIN);
  const researchZoneX1 = xScale(RESEARCH_ZONE_END);
  const transitionZoneX1 = xScale(TRANSITION_ZONE_END);
  const marathonZoneX1 = xScale(INTENSITY_MAX);

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 sm:p-5 dark:border-white/10 dark:bg-zinc-900">
      <p className={sectionLabelClass}>Gastric emptying vs. running intensity</p>
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        Illustrative relationship, not measured data &mdash; drag the marker to explore.
      </p>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label="A chart showing gastric emptying rate declining as running intensity rises from 45% to 90% of VO2max, with several individual response curves illustrating that some runners tolerate higher intensity than others before emptying slows."
      >
        {/* Zone bands -- one accent hue at two low opacities, deliberately
            not a red/yellow/green "good/bad" scheme. */}
        <rect x={researchZoneX0} y={PAD_TOP} width={researchZoneX1 - researchZoneX0} height={PLOT_HEIGHT} className="fill-[var(--accent-tip)] opacity-[0.05]" />
        <rect x={researchZoneX1} y={PAD_TOP} width={transitionZoneX1 - researchZoneX1} height={PLOT_HEIGHT} className="fill-zinc-400 opacity-[0.05] dark:fill-zinc-500" />
        <rect x={transitionZoneX1} y={PAD_TOP} width={marathonZoneX1 - transitionZoneX1} height={PLOT_HEIGHT} className="fill-[var(--accent-warning)] opacity-[0.08]" />

        {/* Axis lines */}
        <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
        <line x1={PAD_LEFT} y1={PAD_TOP + PLOT_HEIGHT} x2={PAD_LEFT + PLOT_WIDTH} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />

        {/* X-axis ticks -- text sized larger than a typical desktop 11px:
            this SVG scales down with the viewBox on a narrow phone (there's
            no HTML-overlay layer here the way Heat Tracker uses), so text
            sized for a desktop reading distance would shrink to a few CSS
            pixels on mobile. Sizing for mobile legibility instead. */}
        {[45, 55, 65, 75, 85, 90].map((tick) => (
          <g key={tick}>
            <line x1={xScale(tick)} y1={PAD_TOP + PLOT_HEIGHT} x2={xScale(tick)} y2={PAD_TOP + PLOT_HEIGHT + 5} strokeWidth="1" className="stroke-zinc-300 dark:stroke-zinc-700" />
            <text x={xScale(tick)} y={PAD_TOP + PLOT_HEIGHT + 22} textAnchor="middle" className="fill-zinc-500 text-[15px] dark:fill-zinc-400">
              {tick}%
            </text>
          </g>
        ))}
        <text x={PAD_LEFT + PLOT_WIDTH / 2} y={CHART_HEIGHT - 4} textAnchor="middle" className="fill-zinc-500 text-[15px] dark:fill-zinc-400">
          Running intensity (% VO2max)
        </text>
        <text
          x={16}
          y={PAD_TOP + PLOT_HEIGHT / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${PAD_TOP + PLOT_HEIGHT / 2})`}
          className="fill-zinc-500 text-[15px] dark:fill-zinc-400"
        >
          Gastric emptying (relative)
        </text>

        {/* Individual curves */}
        {showIndividual
          ? individualPaths.map((p) => (
              <path key={p.label} d={p.d} fill="none" strokeWidth="1.25" className="stroke-zinc-400/70 dark:stroke-zinc-600" />
            ))
          : null}

        {/* Representative curve */}
        <path d={representativePath} fill="none" strokeWidth="2.5" className="stroke-[var(--accent-tip)]" strokeLinecap="round" />

        {/* Marker */}
        <line x1={markerX} y1={PAD_TOP} x2={markerX} y2={PAD_TOP + PLOT_HEIGHT} strokeWidth="1" strokeDasharray="4 3" className="stroke-zinc-500 dark:stroke-zinc-400" />
        <circle cx={markerX} cy={markerY} r="5" className="fill-[var(--accent-tip)] stroke-white dark:stroke-zinc-900" strokeWidth="2" />
      </svg>

      <div className="mt-4">
        <label htmlFor={`${baseId}-intensity`} className={statLabelClass}>
          Running intensity
        </label>
        <input
          id={`${baseId}-intensity`}
          type="range"
          min={INTENSITY_MIN}
          max={INTENSITY_MAX}
          step={1}
          value={intensity}
          onChange={(e) => setIntensity(Number(e.target.value))}
          aria-valuetext={`${intensity} percent of VO2max, ${zone.label}`}
          className="mt-2 w-full accent-[var(--accent-tip)] [accent-color:var(--accent-tip)]"
        />
      </div>

      <div aria-live="polite" className="mt-3 rounded-lg border border-black/10 p-3 dark:border-white/10">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
          {intensity}% VO2max &middot; {zone.label}
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{zone.blurb}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setShowIndividual((v) => !v)} className={segmentedButtonClass(showIndividual)}>
          {showIndividual ? "Hide individual curves" : "Show individual curves"}
        </button>
      </div>

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Heat and humidity add further stress on top of intensity alone, but there&rsquo;s no reliable way to turn
        temperature into an exact personal gastric-emptying number &mdash; treat this chart as a mental model, not a
        calculator.
      </p>
    </div>
  );
}
