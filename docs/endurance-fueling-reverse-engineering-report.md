# Reverse-engineering the GW Endurance Fueling Calculator

**Target:** [goranwinblad.se/endurancefuelingcalculator/](https://goranwinblad.se/endurancefuelingcalculator/) — Göran Winblad's Endurance Fueling Calculator.
**Method:** black-box statistical inference from real collected input/output pairs, driving a real Chrome instance against the live page's own UI.
**Result:** an independent TypeScript implementation (`src/lib/endurance-fueling-math.ts`) covering five of the tool's outputs — suggested carb rate, fluid loss estimate, fluid intake target, sodium loss estimate, and sodium target — validated against 324 real collected queries. A sixth output (the cumulative fluid total over a full session) was investigated but deliberately **not** shipped; see "What's not included" below. One correction is documented in its own section below: the fluid intake target was missed entirely in the first investigation pass and added in a follow-up pass after a side-by-side comparison with the live tool caught the gap.

---

## A note on access

Unlike this codebase's other reverse-engineered calculators, this page is not currently free and unauthenticated. On first visit it shows a migration banner announcing the tool is moving to a paid, Patreon-login-gated platform (`gwendurancefueling.com`), and dismissing that banner reveals the entire calculator — every input, every output, the full product database — blurred and blocked behind a second gate: a password field ("Use the password you received when you signed up").

This was flagged and reported rather than worked around silently, matching this codebase's own standing rule for target selection. The site owner already holds legitimate purchased access to this specific tool and explicitly authorized using that access for this black-box collection — a deliberate, informed exception made by the person who owns the access, not a workaround found unilaterally. Every query was still driven entirely through the real rendered UI, submitting real inputs and reading only displayed output — the same method used for every other calculator in this codebase's reverse-engineering work. No source code, JavaScript bundle, or embedded data file was read at any point.

## The dataset

324 (input → output) pairs, collected across several passes:

- **The core carbs grid** (20 rows): every combination of the tool's 5 heart-rate-zone options × 4 GI-training-level options.
- **Fine-grained marginal sweeps** (97 rows): temperature 0–40°C at every whole degree (41 rows), body weight 40–140kg in 2kg steps (51 rows), and the 5 HR zones in isolation (5 rows) — each sweep holding the other inputs fixed at a reference point, to characterize one input's effect at a time before testing combinations.
- **10 held-out cross-validation combinations**, testing weight × temperature × zone triples never seen during the marginal sweeps.
- **120 randomized full-input-space queries** (weight, temperature, zone, GI training level, and duration all drawn together), used as the primary held-out validation set for every output below.
- A duration sweep (22 rows, 15-minutes-to-24-hours) used only to investigate the cumulative fluid-total behavior — not part of the shipped model; see below.
- **A follow-up fluid-target correction pass** (55 rows: a 41-point temperature sweep at every whole degree, a 9-point body-weight sweep, and a 5-point HR-zone sweep), collected after the gap described in "Correction: the fluid intake target" below was found.

## Step 1 — Mapping which inputs affect which outputs

Before any grid search, each of the calculator's five inputs (duration, HR zone, body weight, temperature, GI training level) was varied independently against the two headline numbers shown on the page, to find the real dependency structure rather than assuming one:

| Output | Duration | HR zone | Body weight | Temperature | GI training |
|---|---|---|---|---|---|
| Suggested carbs (g/hr) | no effect | **drives it** | no effect | no effect | **drives it** |
| Fluid loss estimate (mL/hr) | no effect | **drives it** | **drives it** | **drives it** | no effect |
| Sodium loss estimate / target (mg/hr) | no effect | no effect | no effect | **drives it** | no effect |

This is a genuinely useful finding on its own: the tool's "science-informed" carb suggestion is driven purely by effort intensity and gut tolerance (not scaled by body size or session length), while fluid needs scale with size, intensity, and heat but not gut training, and sodium needs are driven by heat alone.

## Step 2 — Suggested carbs (g/hr): an exact lookup table

The full 5×4 grid, confirmed to **zero error** across all 120 randomized validation queries:

| HR zone | Not GI Trained | Moderately Trained | Well Trained | High Carb Machine |
|---|---|---|---|---|
| 50–60% | 35 | 40 | 45 | 120 |
| 60–70% | 45 | 55 | 65 | 120 |
| 70–80% | 65 | 75 | 85 | 120 |
| 80–90% | 75 | 90 | 105 | 120 |
| 90–100% | 85 | 100 | 115 | 120 |

Two structural notes worth naming: "High Carb Machine" is a genuine override, not a coincidentally-high table cell — it returns exactly 120 regardless of HR zone, matching the calculator's own copy ("You can handle 120g/hr or more regardless of intensity"). And the "Not"/"Well" columns are a symmetric offset around the "Moderate" column at every zone (±5 at the two easiest zones, ±10 at the middle two, ±15 at the hardest two) — a clean, deliberate design, not an artifact of the fitting process.

## Step 3 — Fluid loss rate (mL/hr): a temperature curve plus two additive offsets

The temperature dependency was measured at every whole degree from 0–40°C (the calculator's own tested range) and plateaus at both ends — flat at 300mL/hr from 0–2°C, flat at 2,000mL/hr from 35–40°C. Body weight turned out to collapse into exactly **three buckets**, not a continuous scale: ≤54kg → 600mL/hr baseline, 55–80kg → 700mL/hr, ≥81kg → 800mL/hr (at the reference temperature/zone). HR zone contributes its own offset, from 595mL/hr at the easiest zone up to 840mL/hr at the hardest.

Combining these additively — `fluidLoss = tempCurve(temp) + weightOffset(weight) + zoneOffset(zone)`, floored at the observed 300mL/hr minimum — validated against the 10 held-out cross-combinations and the 120-query randomized set:

- RMSE: 80mL/hr (roughly 5–8% of a typical 600–2,000mL/hr rate)
- Worst single-point error: 260mL/hr

This residual is real and reported honestly, not hidden: the three inputs most likely don't combine *exactly* additively inside the real calculator (a genuinely full 3D grid across weight × temperature × zone would be needed to resolve the remainder), but additive was the best single structural hypothesis tested, and the residual error is small relative to the practical range fueling plans operate in.

## Step 4 — Sodium: two independent temperature-only curves

Both the sodium loss estimate and the sodium target turned out to be **exact functions of temperature alone** — confirmed to zero dependence on body weight or HR zone, and zero error against all 120 randomized validation queries once modeled as lookup tables. The target is deliberately, consistently lower than the loss estimate at every temperature (matching the calculator's own stated reasoning: sodium's role during exercise is to support fluid absorption and thirst, not to fully replace losses 1:1) — but the ratio between the two isn't constant across temperature, so this codebase reproduces both as independently measured curves rather than inventing a fixed replacement fraction.

## Correction: the fluid intake target

The first pass of this investigation captured a fluid *loss* estimate (Step 3) but missed a second, separate quantity the calculator also displays: a fluid intake **target**, deliberately lower than the loss estimate, with its own "Target: Xml" line next to "Est. loss: ~Yml/hr" — the same target/loss structure already correctly captured for sodium (Step 4). The regex used to parse the page's rendered text only matched a `Target: Xmg` pattern (sodium's unit) and never a `Target: Xml` pattern (fluid's unit), so the fluid target line was silently skipped every time, and the loss estimate was shipped as if it were the number the calculator actually recommends drinking — nearly double the real target in typical conditions.

This was caught by a side-by-side comparison against a fresh live session of the source calculator, not by anything in the original validation process — a reminder that black-box validation against a fixed, one-time dataset can still miss an entire output the collection script never asked about, however clean the fitted model for what it *did* collect looks in isolation.

A follow-up sweep (temperature 0–40°C at every whole degree, plus independent body-weight and HR-zone sweeps to check for dependence) found the fluid target is, like sodium's, a **temperature-only curve with zero dependence on body weight or HR zone**:

- Flat at 300mL/hr from 0–17°C
- Rises from 350mL/hr at 18°C up to a 1,600mL/hr ceiling from 35°C onward
- Two small (50mL) blips at 55kg body weight and at the 90–100% HR zone, most likely rounding noise rather than a real weight/zone effect — every other one of the 9 weight points and 5 zone points landed exactly on the flat temperature-only curve

`fluidTargetMlPerHour()` was added as a new export, the UI was updated to show the target as the primary "Fluid" figure (matching how the source calculator itself presents it, with the loss estimate as supporting context), and the session-schedule/DIY-drink-recipe math (added separately for the site's own tool, not part of the reverse-engineered model) was switched from the loss estimate to the correct target. Verified directly against the live calculator at the same inputs after the fix: predicted 300mL/hr against an actual 300mL/hr target, an exact match.

## What's not included: the cumulative fluid target

The page also shows a session-total fluid target (e.g. "700mL total over 2.5h") that is **not** simply `rate × duration` — the calculator visibly under-replaces at shorter durations and approaches full replacement at very long ones, consistent with its own stated philosophy that "a small, controlled fluid deficit... does not harm performance."

A duration-only "replacement fraction" curve was fit against a sweep at one fixed (weight, temperature, zone) reference point, and it fit that single sweep reasonably (RMSE ~0.047 in fraction units). But validated against the 120-query randomized set — where weight, temperature, and zone all vary alongside duration — that same curve produced a median relative error of ~18% and errors up to 35% at combinations of high temperature and long duration. That's not a small, honestly-reportable residual the way the fluid-rate model's 5–8% is; it indicates the true relationship involves a real interaction between duration and the hourly rate (or some other factor) that a duration-only curve can't capture, and resolving it properly would need a dedicated 2D (duration × rate) investigation this report doesn't attempt.

Rather than ship a function that looks validated but silently fails by a third on realistic inputs, this codebase's `endurance-fueling-math.ts` **does not include** a cumulative fluid-total function. The per-hour rate (Step 3) is the shipped, validated primitive; multiplying it out for a full session — with whatever replacement-fraction judgment call a caller wants to make — is left to whoever builds on this module next, with this limitation stated explicitly rather than discovered later.

## Implementation

- **`src/lib/endurance-fueling-math.ts`** — `suggestedCarbsPerHour()`, `estimatedFluidLossMlPerHour()`, `fluidTargetMlPerHour()`, `estimatedSodiumLossMgPerHour()`, and `sodiumTargetMgPerHour()`. Pure TypeScript, no runtime dependencies.
- **`tests/lib/endurance-fueling-math.test.ts`** — validates every function against `tests/fixtures/endurance-fueling-dataset.json` (261 of the 324 collected rows; the 22-row duration sweep used only for the not-shipped cumulative-total investigation above is excluded from the fixture since no shipped function consumes it).
- **`src/lib/fueling-products.ts`** — a real fuel-product catalog, DIY homemade-drink chemistry, and session-schedule math, layered on top of the reverse-engineered rates above for this site's own live tool. None of this was reverse-engineered (no third-party model to fit) — see that file's own header for the full reasoning and sourcing.

This is a separate module from `src/lib/marathon-pacing/fueling-engine.ts`, which already exists in this codebase and answers a related but different question: that module applies widely-published ACSM/ISSN sports-nutrition consensus guidance (a citable body of evidence) to a marathon-pacing pipeline. This module instead reproduces one specific third party's own undisclosed formula, which is why it needed the black-box treatment at all — the same reasoning documented in the Altitude-Adjusted-Pace report for why that module doesn't unify with this codebase's existing, differently-sourced altitude module either. Whether/how this new module gets wired into any UI is a separate product decision, not made here.
