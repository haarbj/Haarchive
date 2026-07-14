"use client";

import { useId, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

import { classifyWindAngle } from "@/lib/wind-physics";

type CompassVariant = "wind" | "heading";

type WindCompassProps = {
  angleDeg: number;
  onChange: (angleDeg: number) => void;
  // "wind" (default): angleDeg is relative to a fixed forward direction --
  // the ring marker is drawn as a through-center flow arrow (where the
  // wind comes FROM, and where it blows TOWARD), and the ring is labeled
  // Head/Cross/Tail/Cross. "heading": angleDeg is an absolute compass
  // bearing -- the ring marker is a single outward arrow (a heading only
  // ever points one way), and the ring is labeled N/E/S/W.
  variant?: CompassVariant;
};

const COMPASS_LABELS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

// Nearest 16-point compass label for an absolute heading -- used when this
// dial represents "which way will you be running" rather than a relative
// wind angle.
export function compassPointLabel(angleDeg: number): string {
  const normalized = ((angleDeg % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return COMPASS_LABELS[index];
}

// N at the top, matching the convention used throughout wind-physics.ts:
// 0deg = headwind (wind blowing in from the direction the runner faces),
// 180deg = tailwind, 90/270 = pure crosswind.
// Ordered to read as a 3x3 grid (row-major) with a blank center cell:
// NW N NE / W · E / SW S SE
const HEADING_PRESETS = [
  { label: "NW", angle: 315 },
  { label: "N", angle: 0 },
  { label: "NE", angle: 45 },
  { label: "W", angle: 270 },
  { label: "E", angle: 90 },
  { label: "SW", angle: 225 },
  { label: "S", angle: 180 },
  { label: "SE", angle: 135 },
];

const WIND_PRESETS = [
  { label: "Head ↖", angle: 315 },
  { label: "Head", angle: 0 },
  { label: "Head ↗", angle: 45 },
  { label: "Cross ←", angle: 270 },
  { label: "Cross →", angle: 90 },
  { label: "Tail ↙", angle: 225 },
  { label: "Tail", angle: 180 },
  { label: "Tail ↘", angle: 135 },
];

// top/right/bottom/left, in that order.
const RING_LABELS: Record<CompassVariant, [string, string, string, string]> = {
  wind: ["HEAD", "CROSS", "TAIL", "CROSS"],
  heading: ["N", "E", "S", "W"],
};

type CompassPoint = { label: string; angle: number };

function CompassButton({
  point,
  activeAngle,
  onChange,
}: {
  point: CompassPoint;
  activeAngle: number;
  onChange: (angle: number) => void;
}) {
  const isActive = Math.round(activeAngle) === point.angle;
  return (
    <button
      type="button"
      onClick={() => onChange(point.angle)}
      aria-label={`Set to ${point.label}`}
      className={`rounded-lg border px-1 py-2 text-xs font-semibold whitespace-nowrap transition ${
        isActive
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
          : "border-black/10 bg-white text-zinc-700 hover:bg-black/5 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-white/10"
      }`}
    >
      {point.label}
    </button>
  );
}

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

// Screen-space pointer position relative to a circle's center, converted
// to a compass angle where "up" is 0deg -- atan2(dx, -dy) rather than the
// more usual atan2(dy, dx), since screen Y grows downward and we want
// "straight up" to read as zero, not 90.
function angleFromPointer(clientX: number, clientY: number, rect: DOMRect): number {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const rad = Math.atan2(dx, -dy);
  return normalizeAngle((rad * 180) / Math.PI);
}

export function WindCompass({ angleDeg, onChange, variant = "wind" }: WindCompassProps) {
  const dialRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const labelId = useId();

  const describeAngle = variant === "heading" ? compassPointLabel : classifyWindAngle;
  const windType = describeAngle(angleDeg);
  const [topLabel, rightLabel, bottomLabel, leftLabel] = RING_LABELS[variant];
  const presets = variant === "heading" ? HEADING_PRESETS : WIND_PRESETS;

  function setFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = dialRef.current?.getBoundingClientRect();
    if (!rect) return;
    onChange(angleFromPointer(event.clientX, event.clientY, rect));
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setFromPointer(event);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    setFromPointer(event);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 45 : 5;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(normalizeAngle(angleDeg - step));
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(normalizeAngle(angleDeg + step));
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(0);
    } else if (event.key === "End") {
      event.preventDefault();
      onChange(180);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={dialRef}
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(angleDeg)}
        aria-valuetext={`${Math.round(angleDeg)} degrees, ${windType}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        className="relative h-40 w-40 shrink-0 cursor-grab touch-none rounded-full outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:focus-visible:ring-white dark:focus-visible:ring-offset-zinc-950"
      >
        <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
          <circle
            cx="50"
            cy="50"
            r="36"
            className="fill-white stroke-black/10 dark:fill-zinc-900 dark:stroke-white/10"
            strokeWidth="1.5"
          />
          <circle cx="50" cy="50" r="36" className="fill-none stroke-black/5 dark:stroke-white/5" strokeWidth="0.5" />

          {/* Fixed ring labels -- these never rotate, since they describe
              zones relative to the runner's fixed forward direction (or,
              in heading mode, true compass points). */}
          <text x="50" y="9" textAnchor="middle" className="fill-zinc-500 text-[7px] font-semibold dark:fill-zinc-400">
            {topLabel}
          </text>
          <text x="92" y="53" textAnchor="end" className="fill-zinc-500 text-[7px] font-semibold dark:fill-zinc-400">
            {rightLabel}
          </text>
          <text x="50" y="97" textAnchor="middle" className="fill-zinc-500 text-[7px] font-semibold dark:fill-zinc-400">
            {bottomLabel}
          </text>
          <text x="8" y="53" textAnchor="start" className="fill-zinc-500 text-[7px] font-semibold dark:fill-zinc-400">
            {leftLabel}
          </text>

          {/* Fixed center marker: always points straight up, representing
              the runner's own forward direction of travel -- deliberately
              a plain neutral arrow rather than an emoji, since an emoji's
              apparent "facing" direction isn't guaranteed to point up
              across platforms and would contradict the angle convention. */}
          <path d="M 50 41 L 45 51 L 55 51 Z" className="fill-zinc-400 dark:fill-zinc-500" />
          <line x1="50" y1="51" x2="50" y2="58" strokeWidth="2" className="stroke-zinc-400 dark:stroke-zinc-500" />

          {/* Rotating marker for the current angle. */}
          <g style={{ transform: `rotate(${angleDeg}deg)`, transformOrigin: "50px 50px" }}>
            {variant === "wind" ? (
              <>
                {/* Where the wind comes FROM. */}
                <circle cx="50" cy="16" r="4.5" className="fill-accent-tip" />
                {/* Shaft passing behind the runner marker, and an
                    arrowhead showing where it blows TOWARD -- one
                    continuous arrow through the dial instead of an
                    isolated position marker. */}
                <line x1="50" y1="20.5" x2="50" y2="76" strokeWidth="2.5" strokeLinecap="round" className="stroke-accent-tip" />
                <path d="M 50 86 L 44.5 74 L 55.5 74 Z" className="fill-accent-tip" />
              </>
            ) : (
              <>
                <circle cx="50" cy="14" r="6" className="fill-accent-tip" />
                <path d="M 50 4 L 44.5 16 L 55.5 16 Z" className="fill-accent-tip" />
              </>
            )}
          </g>
        </svg>
      </div>

      <p id={labelId} className="text-center text-sm">
        <span className="font-semibold text-zinc-900 dark:text-white">{Math.round(angleDeg)}°</span>{" "}
        <span className="text-zinc-600 dark:text-zinc-300">({windType})</span>
      </p>

      <div className="grid grid-cols-3 gap-1.5">
        {presets.slice(0, 3).map((point) => (
          <CompassButton key={point.label} point={point} activeAngle={angleDeg} onChange={onChange} />
        ))}
        <CompassButton point={presets[3]} activeAngle={angleDeg} onChange={onChange} />
        <span aria-hidden="true" />
        <CompassButton point={presets[4]} activeAngle={angleDeg} onChange={onChange} />
        {presets.slice(5, 8).map((point) => (
          <CompassButton key={point.label} point={point} activeAngle={angleDeg} onChange={onChange} />
        ))}
      </div>
    </div>
  );
}
