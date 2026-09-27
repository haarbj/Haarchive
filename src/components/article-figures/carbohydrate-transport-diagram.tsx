"use client";

import { useState } from "react";

import { sectionLabelClass, segmentedButtonClass, statCardClass, statLabelClass } from "@/lib/tool-styles";

type Pathway = "both" | "glucose" | "fructose";

// A schematic (not anatomically literal) map of the small intestine -> liver
// -> circulation route for glucose and fructose, built to make one idea
// intuitive: the two sugars use separate intestinal transporters and have
// very different fates once they reach the liver. The percentages shown
// (glucose to liver glycogen; fructose's uptake and its split into
// glucose/lactate/glycogen) are commonly cited approximate figures, not
// fixed biological constants -- the liver's actual split varies with how
// depleted its glycogen already is, how much sugar arrives at once, and
// individual metabolism, so the labels and callouts below are worded as
// typical/representative ranges rather than a rule every runner's liver
// follows exactly.
export function CarbohydrateTransportDiagram() {
  const [pathway, setPathway] = useState<Pathway>("both");
  const showGlucose = pathway !== "fructose";
  const showFructose = pathway !== "glucose";

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 sm:p-5 dark:border-white/10 dark:bg-zinc-900">
      <p className={sectionLabelClass}>How glucose and fructose travel from gut to muscle</p>

      <div className="mb-3 flex gap-2">
        <button type="button" onClick={() => setPathway("both")} className={segmentedButtonClass(pathway === "both")}>
          Both
        </button>
        <button type="button" onClick={() => setPathway("glucose")} className={segmentedButtonClass(pathway === "glucose")}>
          Glucose
        </button>
        <button type="button" onClick={() => setPathway("fructose")} className={segmentedButtonClass(pathway === "fructose")}>
          Fructose
        </button>
      </div>

      <svg
        viewBox="0 0 720 420"
        className="h-auto w-full"
        role="img"
        aria-label="Diagram showing glucose absorbed via the SGLT1 transporter and fructose via a separate transporter (GLUT5) in the small intestine, each traveling to the liver. The liver typically converts something on the order of 10 to 30 percent of glucose to liver glycogen and releases the rest into circulation, though the exact share varies. The liver takes up most fructose, commonly cited around 85 to 90 percent, and converts it into a mix of glucose, lactate, and liver glycogen -- roughly comparable thirds is one representative pattern, not a fixed split -- releasing the glucose and lactate into circulation."
      >
        {/* Small intestine */}
        <rect x="40" y="20" width="640" height="70" rx="10" className="fill-none stroke-zinc-400 dark:stroke-zinc-600" strokeWidth="1.5" />
        <text x="360" y="60" textAnchor="middle" className="fill-zinc-600 text-[18px] font-semibold dark:fill-zinc-300">
          Small intestine
        </text>

        {/* Glucose transporter + path */}
        {showGlucose ? (
          <g>
            <rect
              x="120"
              y="86"
              width="160"
              height="27"
              rx="4"
              style={{ fill: "var(--accent-tip)", fillOpacity: 0.15 }}
              className="stroke-[var(--accent-tip)]"
              strokeWidth="1.25"
            />
            <text x="200" y="103" textAnchor="middle" className="fill-[var(--accent-tip)] text-[14px] font-semibold">
              SGLT1 transporter
            </text>
            <path d="M200,113 L200,180" fill="none" strokeWidth="2" className="stroke-[var(--accent-tip)]" markerEnd="url(#arrow-glucose)" />
          </g>
        ) : null}

        {/* Fructose transporter + path */}
        {showFructose ? (
          <g>
            <rect
              x="440"
              y="86"
              width="160"
              height="27"
              rx="4"
              style={{ fill: "var(--accent-research)", fillOpacity: 0.15 }}
              className="stroke-[var(--accent-research)]"
              strokeWidth="1.25"
            />
            <text x="520" y="103" textAnchor="middle" className="fill-[var(--accent-research)] text-[14px] font-semibold">
              Separate transporter
            </text>
            <path d="M520,113 L520,180" fill="none" strokeWidth="2" className="stroke-[var(--accent-research)]" markerEnd="url(#arrow-fructose)" />
          </g>
        ) : null}

        {/* Liver */}
        <rect x="120" y="185" width="480" height="90" rx="10" className="fill-none stroke-zinc-400 dark:stroke-zinc-600" strokeWidth="1.5" />
        <text x="360" y="212" textAnchor="middle" className="fill-zinc-600 text-[18px] font-semibold dark:fill-zinc-300">
          Liver
        </text>

        {showGlucose ? (
          <text x="200" y="238" textAnchor="middle" className="fill-zinc-500 text-[15px] dark:fill-zinc-400">
            ~10&ndash;30% taken up
            <tspan x="200" dy="18">
              &rarr; liver glycogen
            </tspan>
          </text>
        ) : null}

        {showFructose ? (
          <text x="520" y="238" textAnchor="middle" className="fill-zinc-500 text-[15px] dark:fill-zinc-400">
            ~85&ndash;90% taken up
            <tspan x="520" dy="18">
              &rarr; glucose / lactate / glycogen
            </tspan>
          </text>
        ) : null}

        {/* Glucose: remainder to circulation */}
        {showGlucose ? (
          <path d="M220,275 L220,320 L340,320" fill="none" strokeWidth="2" className="stroke-[var(--accent-tip)]" markerEnd="url(#arrow-glucose)" />
        ) : null}

        {/* Fructose: glucose + lactate to circulation, glycogen stored */}
        {showFructose ? (
          <>
            <path d="M500,275 L500,320 L400,320" fill="none" strokeWidth="2" className="stroke-[var(--accent-research)]" markerEnd="url(#arrow-fructose)" />
            <path d="M540,275 L540,345 L400,345" fill="none" strokeWidth="1.5" strokeDasharray="3 3" className="stroke-[var(--accent-research)]" markerEnd="url(#arrow-fructose)" />
          </>
        ) : null}

        {/* Circulation / bloodstream */}
        <rect x="230" y="305" width="270" height="55" rx="8" className="fill-zinc-100 stroke-zinc-300 dark:fill-zinc-800 dark:stroke-zinc-600" strokeWidth="1.25" />
        <text x="365" y="326" textAnchor="middle" className="fill-zinc-600 text-[15px] font-semibold dark:fill-zinc-300">
          Bloodstream
        </text>
        <text x="365" y="345" textAnchor="middle" className="fill-zinc-500 text-[13px] dark:fill-zinc-400">
          circulating to working muscle
        </text>

        <defs>
          <marker id="arrow-glucose" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" className="fill-[var(--accent-tip)]" />
          </marker>
          <marker id="arrow-fructose" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" className="fill-[var(--accent-research)]" />
          </marker>
        </defs>
      </svg>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {showGlucose ? (
          <div className={statCardClass}>
            <p className={`${statLabelClass} text-[var(--accent-tip)]`}>Glucose</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              The liver keeps a variable share for its own glycogen store, commonly cited on the order of 10&ndash;30%,
              depending on how depleted its glycogen already is and how much arrives at once; the rest reaches
              circulation. Absorption through SGLT1 is the rate-limiting step &mdash; the whole trip from stomach to
              muscle takes about 20&ndash;30 minutes.
            </p>
          </div>
        ) : null}
        {showFructose ? (
          <div className={statCardClass}>
            <p className={`${statLabelClass} text-[var(--accent-research)]`}>Fructose</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              The liver takes up most of it, commonly cited around 85&ndash;90%, and converts it into a mix of glucose,
              lactate, and glycogen &mdash; roughly comparable thirds is one representative pattern, not a fixed split.
              The lactate route is a genuinely interesting fuel-shuttling mechanism, though whether an
              individual&rsquo;s lactate-shuttling capacity changes how well they use fructose is still speculative.
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 rounded-lg border border-black/10 p-3 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-300">
        <span className="font-semibold text-zinc-900 dark:text-white">Not simply a function of body size: </span>
        larger and smaller runners have roughly the same number of intestinal glucose transporters, so this bottleneck
        doesn&rsquo;t scale with size. Total energy needs still do &mdash; this is about absorption capacity, not how much
        fuel a given runner actually requires.
      </div>
    </div>
  );
}
