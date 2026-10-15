# CV-Threshold Calculator: porting the v2.0 (2026-09-05) model

**Target:** [github.com/johnjdavisiv/cv-threshold-calculator](https://github.com/johnjdavisiv/cv-threshold-calculator) (John Davis, MIT licensed) — the source repo behind this codebase's Threshold, CV & VO2 Max Pace Calculator.
**Method:** MIT-licensed source port (not black-box) — the repo's evaluator (`scripts.js`) and model data (`cv_pieces_v2026-09-05.json`) were read directly, with attribution, per this codebase's standing rule that MIT-licensed sources may be read and ported rather than reverse-engineered blind.
**Trigger:** a routine audit of every externally-sourced tool on the site (prompted by "what about the other tools?") found that this codebase's original CV-Threshold port had fallen behind the source repo's own active development — the source project shipped a substantively different model since the original port, and this codebase was still serving the old one.
**Result:** `src/lib/cv-threshold-math.ts` rewritten against the new model, validated to floating-point exactness against 429 real golden test cases (9,009 individual checked values) from the source repo's own R `predict()` output, propagated through all three consumers (`cv-threshold-calculator.tsx`, `dashboard/page.tsx`, `marathon-pacing-calculator.tsx`), full type-check/lint/test suite green, and verified live in a browser.

---

## What changed in the source model

The original port (this codebase's first implementation) was fit on roughly 8,600 performances, as a 9-cell quantile-regression grid over age × distance × time. The new model (`cv_pieces_v2026-09-05.json`) is a different kind of model entirely, not just a re-fit of the old one:

- **Fit to 613,889 real race performances across 185,965 athlete-seasons** — several orders of magnitude more data than the original.
- **A sinh-arcsinh (shash) distributional GAM**, one per outcome (threshold/`cs_minus`, CV/`cs`, VO2max pace/`cs_plus`). Each outcome has four parameters — `mu` (location), `sigma` (scale), `eps` (skew), `delta` (tails) — every one its own tensor-product cubic-regression-spline surface in `(log10 distance_m, log10 time_s)`.
- **No age input at all.** The source repo's own commit message states this directly: the new model is fit at a fixed "college" fitness level. The original port's age input was a genuine enhancement over what the (then-current) source tool exposed — but that enhancement no longer has a model term underneath it in v2, so it was removed here rather than kept as a control that silently stopped doing anything.
- **Closed-form quantiles.** Between spline knots the surface is exactly a bicubic polynomial, so the shipped data file holds the 16 coefficients per knot cell directly (no interpolation error), and any quantile is:

  ```
  sigma = exp(log_sigma) + sigma_floor
  delta = exp(log_delta)
  q_p = mu + sigma * delta * sinh((asinh(z_p) + eps) / delta)
  speed_m_s = exp(q_p)
  ```

- **A real data hull**, not just min/max bounds — `mu` is evaluated at the query point exactly as entered (a cubic regression spline is linear beyond its outer knots, so this extrapolates in a principled way); the three spread parameters (`sigma`, `eps`, `delta`) are evaluated at the point clamped into the hull, because those surfaces are only well-behaved inside it. The hull itself is five (distance, fast-time, slow-time) vertices from 800m to 10K, interpolated log-log between them.

## The port

`scripts.js` (fetched from the source repo, MIT licensed) was read directly for its evaluator algorithm — cell lookup (`cellIndex`, "last break ≤ query point," clamped to the edge cells), piecewise-bicubic evaluation via Horner's method in both directions (`evalPiece`), hull-edge log-log interpolation (`hullEdge`/`hullBounds`), and the standard-normal quantile constants (`Z`) the source hardcodes for the seven percentile levels it exposes. This was ported into `src/lib/cv-threshold-math.ts` function-for-function, keeping the same structure so the TypeScript stays checkable against the JS original.

**Validated in Python first, against all 429 golden cases, to exact 0.0 error, before writing any TypeScript** — confirming the ported algorithm was correct in isolation from any TypeScript/JSON-parsing concerns. The golden cases (`tests/fixtures/cv-threshold-goldens.json`) are the source repo's own R `predict()` output: for each of 429 (distance, time) pairs, the real `mu`/`sigma`/`eps`/`delta` and all seven quantile speeds, for all three outcomes.

## Validation

`tests/lib/cv-threshold-math.test.ts` checks the TypeScript port against those same 429 golden cases directly (not just spot-checks): for every case and every outcome, the four shash parameters and all seven quantile speeds are asserted close to the golden value to 9 decimal places — 9,009 individual checked values total, both via the internal `predictOutcomeParams`/`quantileSpeed` functions and via the public `predictSpeeds` API. A separate assertion checks `hullStatusFor` agrees with each golden case's own `in_hull` flag. Every one of these passes.

## Propagating the API change

The new model's public API (`CvPiecesModel`, `predictSpeeds(model, distanceMeters, timeSeconds)` — no age argument, `CvThresholdPrediction = Record<CvOutcome, Record<QuantileKey, number>>` instead of the old `{thresholdSpeedMS, cvSpeedMS, vo2maxSpeedMS}` percentile-triple shape) touched three consumers:

- **`src/components/cv-threshold-calculator.tsx`** — age input removed entirely; a new `rangeLevel` control (80/90/95/off) replaced the old fixed-90%-only uncertainty display, matching the source calculator's own range chips.
- **`src/app/(app)/(protected)/dashboard/page.tsx`** — age computation/gating removed, `predictSpeeds()` call updated.
- **`src/components/marathon-pacing-calculator.tsx`** — age input, persisted-state field, and profile-load logic removed; every read of the old percentile-triple shape (`fitnessPrediction.cvSpeedMS`, `selectTrainingPaces()`'s consumers, the `simulateFinishTimes()` call, the `SaveCalculationButton` input snapshot, and two leftover UI strings that still said "or age"/"race performance, age, and marathon goal time") updated to the new `Record<CvOutcome, Record<QuantileKey, number>>` shape. The race-day simulation's `FitnessPercentiles {p10, p50, p90}` input is now built explicitly from `fitnessPrediction.cs.q10/q50/q90` rather than read off a field that no longer exists.

`src/lib/cv-threshold-model-server.ts` was updated to import the new data file (`public/data/cv-threshold-pieces-v2026-09-05.json`) and the new `CvPiecesModel` type; the old `public/data/cv-threshold-model.json` was removed after confirming (via a full-codebase grep) nothing still referenced it.

## Live verification

Verified in a real browser (Puppeteer against the actual installed Chrome, matching this codebase's own black-box methodology even though this port itself wasn't black-box):

- **CV-Threshold Calculator** (`/cv-threshold-calculator`): no age field present; 80%/90%/95%/Off range-level control renders and switches; a real 5K performance produces threshold/CV/VO2max paces with live uncertainty ranges; zero console errors.
- **Marathon Pacing Calculator** (`/marathon-pacing-calculator`): no age field, no stale "or age" copy anywhere; a real fitness performance (18:00 5K) and goal time (3:30:00) generate a full mile-by-mile pacing plan that lands exactly on the goal; the race-day simulation ("Show simulation") — the code path that consumes the raw `CvThresholdPrediction.cs` percentiles directly, rather than through `selectTrainingPaces()` — runs correctly and produces a sensible fast/typical/slow finish-time spread (3:27:33 / 3:30:05 / 3:33:23) centered on the goal; zero console errors throughout.

## Full validation suite

`npx tsc --noEmit -p .`, `npx eslint` on every changed file, `npx vitest run` (full suite, 1,778 passing + 1 pre-existing expected-fail unrelated to this change), and `npm run build` (production build) all pass clean.
