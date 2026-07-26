# Marathon Pacing Calculator — Design Document

Status: **design only, no implementation yet**, per the brief. This covers Phases 1–2 (reverse-engineered inference of FindMyMarathon + a recommended replacement model), Phase 3 (what Haarchive already has vs. what's net-new), Phase 4 (architecture), Phase 5 (TypeScript interface sketches), and Phase 6 (incremental build roadmap).

---

## Phase 1: Inferred FindMyMarathon Model

### Methodology

FindMyMarathon's pace-band tool is free and public (`pacebandresult.php?race=...`); no paywall or login gate was involved. Two sources of evidence were used:

1. **Their own FAQ page** (`/faq-paceband.php`), which states outright: *"The algorithm used to develop the race-specific paces are derived from peer reviewed research, advice from running experts, and analysis of the actual race paces from thousands of runners who have successfully met their time goals on those courses."* It names the research: **C.T.M. Davies** and **Andrew D. Townshend et al.** on the metabolic effects of running at different grades.
2. **Live black-box probing** of the real Rock 'n' Roll Nashville Marathon pace band, driving the actual page (goal time = 3:30:00) across all 3 start strategies × 6 pacing strategies and reading the generated mile splits. No source code was inspected.

### What the data shows

**Even Effort (EE) vs. Even Pace (EP) — confirms EE is genuinely terrain-driven:**

At a 3:30:00 goal (8:01/mi average), EP is a flat `08:01` every single mile. EE varies mile-to-mile from `07:44` to `08:18` — a ~34s (~7%) swing across the course. This isolates the elevation adjustment: EE = EP ± a per-mile grade correction; EP is the unadjusted control.

**Split strategies (NS/NSA/PS/PSA) — an additive shift layered on top of EE, not a re-derived curve:**

| Strategy | Mile 1 delta vs. EE | Where it flips sign |
|---|---|---|
| Negative Split (NS) | +2s/mi (slower) | Right after the half-marathon point |
| Aggressive Negative Split (NSA) | +7s/mi (slower) | Same |
| Positive Split (PS) | −4s/mi (faster) | Same |
| Aggressive Positive Split (PSA) | −6s/mi (faster) | Same |

The shift is a near-constant offset applied to every mile in each half (not a gradual ramp across the full 26.2mi), flipping sign at the halfway split. Every strategy still lands on the exact same finish time — the model is a zero-sum redistribution of the same total, not a different total-time forecast. Note the asymmetry: PS's swing (−4s) is roughly double NS's (+2s) at the "regular" tier. That's very unlikely to be a designed physiological choice — it's much more consistent with the model being tuned to match *how real marathoners actually fade* (positive splits are far more common and larger in magnitude than genuine negative splits in real race data), reinforcing the "fit to crowd behavior" reading of their FAQ text.

**Start strategies (CS/CSA) — a decaying taper in the opening miles, repaid with a small uniform speedup later:**

| Strategy | Miles 1–3 delta vs. NORM | Taper ends by | Payback |
|---|---|---|---|
| Conservative Start (CS) | +15s, +10s, +5s | Mile 4 | ~1s/mi faster across remaining 23 miles |
| Very Conservative Start (CSA) | +20s, +15s, +10s, +4s | Mile 5 | ~1s/mi faster across remaining 22 miles |

23 miles × ~1.3s ≈ the ~30s "debt" from CS's opening slowdown — a clean conservation check. This is simple bookkeeping, not a physiological model: the extra time spent slow at the start is mechanically clawed back elsewhere to hit the identical target finish time.

### Inferred pseudo-model

```
pace(mile) = EE_base(mile)
           + startTaper(mile, startStrategy)       // nonzero only for miles ~1-5, decaying to 0
           + splitShift(mile, halfPosition, pacingStrategy)  // constant per half, sign flips at halfway
subject to: sum(pace(mile) for all miles) == goalTime  exactly
```

`EE_base(mile)` is most likely a per-mile grade-cost adjustment (probably an older/simpler uphill-downhill economy curve consistent with citing Davies 1980 / Townshend rather than the more complete Minetti 2002 quintic — see Phase 2), blended against real historical per-mile splits from that specific race's past finishers at comparable goal paces, all rescaled so the mile-by-mile curve still sums to the runner's chosen goal time.

**Confidence levels**, being explicit since exact constants weren't and shouldn't be reverse-engineered pixel-for-pixel (per your framing — concepts, not a clone):
- **High confidence:** EE is grade-driven and EP is not; split strategies are a constant additive per-half shift, not a continuous curve; start strategies are a decaying taper with a conservation payback; total time is always preserved exactly.
- **Medium confidence:** the blend of physics-based grade cost with historical per-mile split data, rather than pure physics.
- **Low/no confidence, and not needed:** exact coefficients, exact taper decay shape, exact historical-data weighting.

### Where the assumptions are weak

1. **Historical split data as "ground truth" bakes in fatigue and crowding, not terrain.** If real runners slow down at mile 20 partly from glycogen depletion — a global, time-dependent effect — and mile 20 also happens to tick slightly uphill, the model has no way to separate "this mile is slow because of the grade" from "this mile is slow because everyone runs out of fuel around here regardless of the road."
2. **No individual physiology.** No VO2max, threshold, critical speed, training volume, weight, or age input anywhere in the tool — a 2:30 marathoner and a 5:00 marathoner running the same course get pacing shifted by the same generic percentages.
3. **No environment.** Temperature, humidity, wind, altitude, and sun exposure — often larger determinants of a realistic pace than a course's net elevation — aren't part of the tool at all.
4. **Elevation handling is coarse.** Even if EE responds to each mile's own average grade, a "1000ft in one sustained climb" course and an "1000ft across 80 short rollers" course are almost certainly treated identically if their per-mile average grades happen to match — there's no visible concept of climb length, repeated-effort loading, or cumulative eccentric damage from descents.
5. **No fueling integration**, no uncertainty/confidence range on the prediction, and no way to express *why* a given mile is paced the way it is beyond the strategy label.

This is a reasonable, honest tool for its scope — a printable pace band, not a training-science product — but it's a good baseline to build meaningfully past.

---

## Phase 2: Recommended Physiologically Accurate Model

The core idea: **replace "shift a base pace by a preset percentage" with "hold a physiologically meaningful quantity constant (or intentionally vary it) and solve for the pace that achieves it, mile by mile."** Concretely, that quantity is *fractional effort relative to critical speed*, adjusted for terrain-added metabolic cost, environmental cost, and accumulated fatigue state — not a canned percentage table.

### 2.1 Terrain — already effectively solved in this repo

`src/lib/grade-pace-physics.ts` already ports **Minetti et al. 2002**'s quintic grade-cost polynomial (`gradeAddedCostJPerKgM`) verbatim from the published coefficients, plus a Black et al. 2018 GAM-smoothed flat-ground cost curve (`flatCostJPerKgM`), and exposes both directions of the physics: `equivalentFlatSpeedForGradeMS` (pace mode: "what flat-ground effort does this grade pace represent") and `equivalentGradeSpeedMS` (effort mode: "what pace on this grade matches a flat-ground target effort"). This is already a materially better foundation than what FindMyMarathon appears to use — Minetti's polynomial spans the full ±45% grade range from actual treadmill data, versus the older/narrower Davies/Townshend work their FAQ cites. **No new grade-cost model needs to be built.** What's missing is the course-level aggregation on top of it (Phase 3).

### 2.2 Environment — already built, needs to be reused, not reinvented

`src/lib/environmental/` already has working `AdjustmentEngine<TInput>` implementations for heat, humidity, wind (including route-integrated wind via `route-wind-physics.ts`), and elevation, combined through `combine.ts`'s `combineAdjustments` / `predictedActualTime`. Per your instruction, the pacing engine should call into these engines rather than reimplement heat/humidity/wind physics. The one gap: today's engines return a *single total adjustment for a whole effort*, not a per-mile timeline — the pacing engine needs a thin wrapper that calls the same engines per-segment (or per-mile) using each segment's own local grade/heading, not new physics.

### 2.3 Physiology — the genuinely new part, and where this should beat every existing pacing tool

Four coupled sub-models, each independently swappable behind the same "effort in, pace out" contract:

**Glycogen depletion.** Two-compartment (liver + muscle) store, depleting at a rate driven by relative intensity (fraction of critical speed / %VO2max) per the classic carbohydrate-availability literature (Costill, Coyle). Below ~75-80% effort, fat oxidation covers a growing share of the cost and glycogen drains slowly; above that, it drains fast and roughly linearly with time-at-intensity. The store size scales with muscle mass (hence why `weight` is a useful optional input) and is reduced by poor fueling and increased by carbohydrate intake modeled in the fueling engine (2.6). "The wall" is what happens when the projected pace at a given mile would require the runner to draw down a compartment that's already near empty — instead of a fixed mile-20 slowdown, this becomes an emergent, runner-specific prediction.

**Cardiac drift.** At sustained sub-threshold effort, heart rate climbs over time and with heat even when pace holds steady (Coyle et al.'s cardiovascular drift work). Modeled as a slow function of duration and the same temperature/humidity inputs the environmental engines already compute, so a hot-day plan doesn't just get slower target paces — it gets an honestly higher predicted HR at the *same* effort, which is itself useful pacing feedback ("you'll feel like you're working harder even holding this pace").

**Durability / neuromuscular fatigue.** Extend the Critical Speed concept the site already supports for training paces into a depletable reserve during the race itself — essentially a marathon-scale version of Skiba et al.'s W′-balance model: a finite "reserve" bucket that drains when running above critical speed and slowly refills when below it. A `durability` rating (excellent/average/poor, informed by `longestRun` and `weeklyMileage` training inputs) sets how fast that reserve drains and how large it is, which is what should differentiate two runners targeting the same goal time but with very different training backgrounds.

**Downhill eccentric damage.** Because `grade-pace-physics.ts` already separates positive- and negative-grade cost, cumulative *negative* (eccentric) work over the course — roughly the integral of descent × body weight — can be tracked as a separate damage accumulator (per Millet et al.'s work on muscle damage from downhill running). A net-downhill course (Boston, CIM) should degrade late-race durability *beyond* what pure metabolic-cost accounting predicts; this is exactly the kind of effect a metabolic-cost-only model (which is probably closer to what FindMyMarathon has) cannot represent.

These four states (glycogen remaining, cardiac drift, durability reserve, cumulative eccentric damage) are the "Fatigue Engine" the brief asks for — not a single opaque "fatigue score," but four legible, independently-explainable numbers that combine into one.

### 2.4 Strategy, as effort curves rather than pace edits

Every named strategy (Even Effort, Negative Split, Boston Strategy, Hill Attack, etc.) becomes a **target relative-effort curve over race fraction** (e.g. "hold 82% of critical speed until mile 20, then release to 88%"), not a table of preset pace deltas. The physiology model then converts that effort curve into paces, mile by mile, already accounting for that mile's terrain and environment cost and the runner's current fatigue state. This is what makes "Custom Strategy" and course-specific strategies ("Boston Strategy" = conservative through the Newton hills, controlled surge after) meaningful without hand-authoring a new pace table for every course — the strategy only needs to define effort intent; the pipeline does the rest.

### 2.5 Risk profiles

A risk profile (Low/Moderate/High) sets the *ceiling* on how close to critical speed the effort curve is allowed to run in the first half, and how large a negative-split "release" is permitted late, given the runner's durability rating. This is the physiologically justified replacement for "arbitrary pace differences" the brief calls out — the start isn't slower "because Conservative Start says so," it's slower because going out any faster would draw the glycogen/durability reserves down a curve that's unlikely to sustain the goal pace to mile 26.

### 2.6 Fueling

A straightforward derived output, not a new model: given the glycogen depletion curve, goal duration, temperature/humidity (already computed), and runner size, recommend carbohydrate (g/hr), fluid (mL/hr), and sodium (mg/hr) targets, with caffeine timing suggested for the back third of goal times over ~3 hours. This should render as reminders attached to specific miles/aid stations, generated from the same fatigue-engine state rather than a static lookup table.

---

## Phase 3: Reuse Map — what Haarchive already has vs. what's net-new

This project turns out to inherit far more than expected. Building this as a greenfield feature would duplicate real, tested physics that already ships on the site.

| Capability the brief asks for | Status | Where |
|---|---|---|
| Grade-adjusted pace / energy cost of a slope | **Already built** (Minetti 2002 quintic + Black et al. 2018 flat-cost GAM) | `src/lib/grade-pace-physics.ts` |
| Heat/humidity adjustment | **Already built** | `src/lib/environmental/heat-engine.ts`, `humidity-engine.ts` |
| Wind adjustment (incl. route-integrated) | **Already built** | `src/lib/wind-physics.ts`, `route-wind-physics.ts`, `route-wind-engine.ts` |
| Altitude/elevation adjustment | **Already built** | `src/lib/environmental/elevation-engine.ts` |
| Combining multiple adjustment factors with confidence ranges | **Already built** | `src/lib/environmental/combine.ts` |
| GPX/TCX/FIT/Strava course import | **Already built** | `src/lib/route-import/` (`parse-gpx.ts`, `parse-tcx.ts`, `parse-fit.ts`, `parse-strava.ts`) |
| Distance/elevation-gain/loss/heading derivation from a route | **Already built** | `src/lib/route-import/route-summary.ts` (`summarizeRoute`) |
| Route import UI | **Already built** | `src/components/route-import-panel.tsx` |
| Total climb, average grade, grade *distribution*, longest/steepest climb, rolling index, hill frequency | **Net-new** — `summarizeRoute` gives gain/loss totals but no distributional or per-climb breakdown | New: course-analysis module |
| Glycogen depletion, cardiac drift, durability/W′-balance, eccentric damage | **Net-new** — no physiology-over-time model exists anywhere on the site yet | New: physiology module |
| Strategy → effort curve → pace conversion | **Net-new** | New: strategy + split-generator modules |
| Fueling recommendations | **Net-new** | New: fueling module |
| Mile/5K/10K/half splits + visualizations (pace, elevation, effort, fatigue, glycogen, HR, timeline) | **Net-new UI**, but built on the shared `tool-styles.ts` / persisted-field / chart conventions already used across every other calculator on the site | New: component |
| Monte Carlo finish-time simulation, probability of hitting goal | **Net-new** | Later milestone (Phase 6) |

The practical upshot: Phase 4/5 below is scoped almost entirely around the physiology + course-analysis + strategy + split-generation layers, wired to existing engines — not around rebuilding terrain or weather physics from scratch.

---

## Phase 4: Architecture

```
Target Time / Pace / VDOT / CS / Threshold  ─┐
Recent race, training inputs (optional)      ├──► Runner Profile
Weight, height, sex, age (optional)          ─┘         │
                                                          ▼
GPX / Strava / Garmin / official course  ──► Route Import  ──► Course Analysis
                                              (existing)        (net-new: climbs,
                                                                 grade distribution,
                                                                 rolling index)
                                                                        │
Temperature, humidity, wind, altitude,   ──► Environmental Engines      │
sun exposure                                 (existing, called            │
                                              per-segment)                 │
                                                       │                   │
                                                       ▼                   ▼
                                              ┌──────────────────────────────┐
                                              │   Terrain + Environment       │
                                              │   Cost Model (per mile)       │
                                              │   (existing grade-pace-       │
                                              │    physics.ts, existing       │
                                              │    environmental engines)     │
                                              └───────────────┬────────────────┘
                                                               ▼
Risk Profile + Strategy selection ──► Strategy Engine (net-new: effort curve)
                                                               ▼
                                              ┌──────────────────────────────┐
                                              │   Physiology / Fatigue Engine │
                                              │   (net-new: glycogen,         │
                                              │    cardiac drift, durability, │
                                              │    eccentric damage)          │
                                              └───────────────┬────────────────┘
                                                               ▼
                                                     Split Generator (net-new)
                                                               ▼
                                        Fueling Engine (net-new, reads glycogen state)
                                                               ▼
                                          Final Pace Band + Explanations + Charts
```

Every stage after Course Analysis consumes and produces plain data (no hidden state), so any stage is replaceable independently — e.g. swapping the durability model later doesn't touch the split generator, and a Monte Carlo mode wraps the whole pipeline (running it N times with sampled inputs) rather than being wired into any single module.

---

## Phase 5: TypeScript interfaces (sketch — not implementation)

```ts
// runner-profile.ts
export type RunnerProfile = {
  goal: { kind: "time" | "pace" | "recentRace" | "vdot" | "criticalSpeed" | "thresholdPace"; value: number | RaceResult };
  weightKg?: number;
  heightCm?: number;
  sex?: "male" | "female";
  age?: number;
  training?: {
    longestRunMeters?: number;
    weeklyMileageKm?: number;
    recentMarathon?: RaceResult;
    heatAcclimated?: boolean;
    altitudeAcclimated?: boolean;
  };
  durability?: "excellent" | "average" | "poor"; // derived from training if omitted
};

// course-analysis.ts — net-new, built on existing RouteSummary
export type ClimbSegment = { startMeters: number; endMeters: number; gainM: number; avgGrade: number; maxGrade: number };
export type CourseAnalysis = {
  totalDistanceM: number;
  totalClimbM: number;
  totalDescentM: number;
  avgGrade: number;
  gradeHistogram: { bucketGrade: number; distanceM: number }[]; // grade distribution
  climbs: ClimbSegment[];       // individual sustained climbs, not just totals
  longestClimb: ClimbSegment | null;
  steepestClimb: ClimbSegment | null;
  rollingIndex: number;         // climb-count / distance-normalized "choppiness" measure
  perMileGrade: number[];       // avg grade for each mile, feeds the cost model
};

// physiology-engine.ts — net-new
export type FatigueState = {
  glycogenRemainingFraction: number;   // 1.0 = full, 0 = bonk
  cardiacDriftBeatsPerMin: number;     // estimated HR add-on vs. mile 1 at same pace
  durabilityReserveFraction: number;   // W'-balance-style reserve, 1.0 = full
  eccentricDamageScore: number;        // cumulative downhill load, unitless index
};
export type MileFatigueDelta = {
  mile: number;
  effortFraction: number;       // fraction of critical speed targeted this mile
  state: FatigueState;          // state AFTER this mile
};

// strategy-engine.ts — net-new
export type EffortCurvePoint = { raceFraction: number; targetEffortFraction: number }; // 0-1, 0-1
export type PacingStrategy = {
  id: string; // "even-effort" | "negative-split" | "boston-strategy" | "custom" | ...
  label: string;
  buildEffortCurve(course: CourseAnalysis, risk: RiskProfile): EffortCurvePoint[];
};

// split-generator.ts — net-new, the orchestrator
export type MileSplit = {
  mile: number;
  paceSecPerMile: number;
  elapsedSeconds: number;
  elevationGainM: number;
  grade: number;
  effortFraction: number;
  estimatedHeartRate: number | null;
  fatigueState: FatigueState;
  fuelReminder: FuelReminder | null;
  explanation: string; // e.g. "Mile 16 is slower because the course climbs 3.8%..."
};
export type PacingPlan = {
  splits: MileSplit[];
  fiveKSplits: MileSplit[];
  tenKSplits: MileSplit[];
  halfSplit: MileSplit;
  twentyMileSplit: MileSplit;
  finish: MileSplit;
  totalTimeSeconds: number;
};

// environment-integration.ts — net-new thin wrapper around existing engines
export function costForSegment(
  segment: { grade: number; headingDeg: number; distanceM: number },
  conditions: WeatherConditions,       // reuse src/lib/environmental/fetch-weather-conditions.ts
  paceMS: number,
): EngineResult[]; // reuses existing heatEngine/humidityEngine/windEngine/elevationEngine
```

No implementation files are created yet — this is purely the shape the pipeline is designed around, so Phase 6's milestones have a concrete contract to build against and test independently.

---

## Phase 6: Incremental build roadmap

Given the brief explicitly wants incremental, tested delivery with swappable modules, and given how much of "Course Analysis" and "Environment" is already solved, the recommended build order is:

1. **Course Analysis module** — `climbSegments()`, grade histogram, rolling index, per-mile grade, built on the existing `summarizeRoute` output. Pure functions, easy to unit-test against a few real GPX files (e.g., a known hilly course and a known flat one) with hand-verified expected climb counts.
2. **Environment-per-segment wrapper** — call the existing heat/humidity/wind/elevation engines per mile instead of once for a whole race; no new physics, just re-plumbing existing, already-tested code.
3. **Terrain+environment cost model** — combine `grade-pace-physics.ts` and the per-segment environmental wrapper into one "cost of this mile at this pace" function. This alone, with a flat "even effort" strategy, is already a materially better pace-band tool than FindMyMarathon's EE mode (real Minetti physics + real weather, still with zero physiology).
4. **Physiology/fatigue engine** — glycogen, cardiac drift, durability reserve, eccentric damage, each as an independently testable pure function against published depletion-rate/drift-rate constants from the cited literature, with a documented "where this is a model, not a measurement" section (mirroring the honesty standard set by the Tinman calculator's report).
5. **Strategy engine** — start with Even Effort, Negative Split, Positive Split, and Boston Strategy (the ones with a clear, testable physiological rationale); leave the rest of the requested strategy list (Chicago Strategy, Hill Attack, Race the Last 10K, Custom) for a follow-up once the effort-curve contract is proven out.
6. **Split generator + fueling + UI** — mile/5K/10K/half tables, the pace/elevation/effort/fatigue/glycogen charts, and per-mile explanations, following the site's existing tool conventions (`tool-styles.ts`, `usePersistedField`, `SaveCalculationButton`).
7. **Later milestones** (explicitly deferred, not v1): GPX/Strava/Garmin upload wired into this pipeline (the import code exists — this is UI wiring), course/plan comparison, "what if" scenario toggles, Monte Carlo finish-time simulation with confidence intervals.

Steps 1–3 alone are a legitimate first shippable milestone: real course-aware, weather-aware pacing with zero physiology yet, already ahead of the FindMyMarathon baseline on terrain and environment. Step 4 is where this becomes something meaningfully different from every calculator currently in this space, per the ambition, and is also the highest-uncertainty, most research-heavy piece (the parts of Phase 2.3 above cite established literature but state constants there will need real validation, not just literature review).

**No code has been written yet.** Next step, if this direction looks right: start with milestone 1 (Course Analysis), including its unit tests, before touching anything else.
