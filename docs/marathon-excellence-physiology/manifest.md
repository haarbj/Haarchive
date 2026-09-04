# Manifest — Marathon Excellence for Everyone, Part V physiology synthesis

**Source**: John J. Davis, *Marathon Excellence for Everyone*, Part V ("The Science of Marathon Performance"), chapters 22–34. Text supplied directly by the user in chat, in chunks, not read from a PDF/physical copy on this machine.

**Status of Phase 1 (source identification)**: incomplete. Edition, publication year, publisher, and ISBN have not been provided. No page numbers have been given for any passage. See `source-citations.md`'s header for how this is being handled pending user direction — this is a real, open question, not an oversight.

## Chapters received and processed

| Chapter | Title | Received | Extraction done | Notes |
|---|---|---|---|---|
| Part V intro | (framing) | ✅ | ✅ | Framing only, no extractable claims |
| 22 | Understanding Aerobic Energy Production for the Marathon | ✅ | ✅ | |
| 23 | The Oxygen Delivery System and the Four Fuels for Aerobic Energy | ✅ | ✅ | Includes Figure 23.1 (four-fuel diagram) |
| 24 | Muscle Fibers: Fast-Twitch, Slow-Twitch, and Intermediate | ✅ | ✅ | |
| 25 | Key Physiological Metrics: Heart Rate, Oxygen Consumption, and Lactate | ✅ | ✅ | Mostly definitional setup for ch. 26; case-study athlete's own numbers not extracted as general facts |
| 26 | Whole-Body Physiological Responses to Different Speeds | ✅ | ✅ | Figures 26.1–26.11 received (not reproduced). Richest chapter so far — see extraction.md §5 |
| 27 | The Three Domains of Intensity and the Causes of Fatigue | ✅ | ✅ | Real, established moderate/heavy/severe framework — see extraction.md §6 |
| 28 | Measures of Intensity: VO2max, Heart Rate Zones, Pace Percentages, and Perceived Effort | ✅ | ✅ | Figures 28.1–28.3, Table 28.1 received (not reproduced). See extraction.md §6 |
| 29 | The Four Components of Marathon Fitness | ✅ | ✅ | **Directly overlaps existing Joyner/Breaking2 content in `exercise-physiology`** — see extraction.md §7's duplication warning. Figures 29.1–29.6 received (not reproduced) |
| 30 | Physiological Roots of Maximal Oxygen Uptake (VO2max) | ✅ | ✅ | See extraction.md §8 |
| 31 | Physiological Roots of Maximal Metabolic Steady-State (SSmax) | ✅ | ✅ | Contains the strongest single item in the whole extraction (2018 twin study) — see extraction.md §8 |
| 32 | Physiological Roots of Running Economy | ✅ | ✅ | **Directly overlaps existing "Don't Fix Your Form" content in `research-library`** — see extraction.md §9's duplication warning |
| 33 | Physiological Roots of Resilience | ✅ | ✅ | Complete. Figure 33.1 + resilience-percentile figure received (not reproduced). Contains the localized-central-fatigue finding, independently verified — see extraction.md §11 |
| 34 | Integrating Marathon Science Into Marathon Training | ✅ | ✅ | Table 34.1 received (not reproduced, likely copyrighted). See extraction.md §10 |

**All 13 physiology chapters (22–34) now fully extracted.** `integration-map.md` is now complete: all 24 P0 candidates consolidated into 18 concrete page-level edits across `exercise-physiology`, `nutrition-and-fueling`, `research-library`, and `marathon-training`.

## Phase 4 — existing-content conflict audit (complete)

One genuine "outdated Haarchive content" finding, resolved: `exercise-physiology`'s "Steady State and Oxygen Debt" and "Fast-Twitch, Slow-Twitch, and the Acid/Alkali Balance" subsections use the pre-1980s "lactic acid causes fatigue via a debt to be repaid" model directly (the text literally says "oxygen debt alongside lactic acid" and frames muscle fatigue as an acid/alkali balance problem) — exactly the framing chapters 22–23's lactate-shuttle correction (AE-4/AE-5) supersedes. Resolution: extend rather than rewrite, following the page's own existing precedent (the adjacent "Oxygen Debt: The Original Estimate vs. the Corrected One" callout already does "here's the older number, here's what was later found" once) — see `integration-map.md`'s "Phase 4 conflict-audit finding" section and row 1 for the exact treatment. No other existing-content conflicts found; all other P0 items are either genuine content gaps or extensions of compatible existing material.

Two confirmed exact duplications (not re-added anywhere): the Joyner/Breaking2/Kipchoge content (ch. 29) already exists in `exercise-physiology`; the Radcliffe 15%-economy citation (ch. 32, Jones 2006) already exists in `research-library`'s "Don't Fix Your Form" section.

## Phase 7 — production edits (complete)

Citation convention confirmed by the user: author + title only (no page numbers), matching the `daniels-synthesis` precedent.

All 18 rows from `integration-map.md` written into `src/lib/sections.ts`, with two placement corrections found during implementation (the map's own plan, not a re-litigation of the Phase 4 audit):
- Rows 10–11 (RQ-based fueling mechanism, Fatmax caveat) were mapped to `nutrition-and-fueling`, but on inspection the actual crossover-point/FASTER-study content they extend lives in `exercise-physiology`, not `nutrition-and-fueling` — both landed there instead, right after their respective existing paragraphs.
- WB-7 (the "14 definitions of LT2" / baseline+1.5mM refinement), originally folded into the new intensity-domains subsection per the map's own consolidation note, turned out to have a precise existing home: `data-and-analytics`'s "How Precise Does Threshold Intensity Actually Need to Be?" section (~line 884 pre-edit), which already covers the population-average-vs-individual-range point this refines directly. Given its own home, it got a standalone paragraph there instead.

Verification: `npx tsc --noEmit -p .` clean, `npx eslint src/lib/sections.ts` clean, `npm run test` (1650 passed, 1 pre-existing expected fail, unrelated), `npm run build` clean (no errors on `exercise-physiology`, `data-and-analytics`, `research-library`, or `marathon-training`). Cross-reference phrasing checked against real heading/section-title text for every "see X in Y" link added.

## Phase 8 — P1/P2 curation pass (complete, executive decision)

After Phase 7 shipped all P0 items, the user asked for an executive decision on the remaining 58 P1/P2 candidates in `extraction.md` (no P3s exist). Rather than implement all 58, ~20 were selected on editorial judgment: genuine standalone value, extends content just shipped rather than duplicating it, avoids Davis's own case-study-specific numbers (explicitly non-generalizable per his own book's framing), and avoids content dense enough to work against the site's "why before what" readability. Implemented:

- **`exercise-physiology`**: FUEL-7/FUEL-8 (lactate shuttle destinations — 75% oxidized by other tissues incl. the heart, fast-twitch/slow-twitch fiber lactate-borrowing), FUEL-2 (muscle glycogen's metabolic locality), MF-2 (fast-twitch fibers' greater damage susceptibility despite more force), MF-3 (fast-twitch fibers' glycolysis-only fuel constraint), MF-5 (fiber-type continuum caveat), V31-10 (training above vs. at SSmax, retest-drift caveat)
- **`data-and-analytics`**: M-4 (cardiac drift, 10–15% with no VO2 change — explains the 30-min-TT's final-10-minutes averaging convention), M-7 (RPE's real correlation ranges to LT1/SSmax, instantaneous vs. session RPE distinction)
- **`workout-library`**: V31-9 (float recovery intervals, new standalone subsection)
- **`nutrition-and-fueling`**: V30-7 (iron/ferritin — hemoglobin mechanism + prevalence fact, framed strictly as general education, explicit "not a diagnosis" line, doesn't duplicate the page's existing supplementation-caution paragraph)
- **`research-library`**: RE-8 (Bolt asymmetric-gait anecdote), RE-9 (self-optimization is for efficiency, not injury prevention — a genuine caveat that cuts against the section's main argument)
- **`marathon-training`**: FC-5 (multiplicative four-component math), FC-7 (SSmax as power output, not pace), RES-3 (80,000-marathoner field-study corroboration of RES-2's lab finding), RES-4 (deterioration is metabolic not biomechanical, cross-linked to Don't Fix Your Form), RES-7 (muscle-damage biopsy findings), RES-6 (training to resist glycogen-depletion fatigue requires marathon-pace-specific volume, not just a fueling plan), RES-14 (diagnostic heuristic: resilience as the likely gap for runners strong at 5K/10K/half but underperforming the marathon)

Explicitly excluded, with reasoning: WB-1/8/9/12 and M-3/5/8 (WB-9 is Davis's own case-study athlete's numbers, explicitly non-generalizable; the rest are deep methodological detail with low reader-facing payoff), FC-2/3/6 (numeric elaboration with diminishing returns once FC-5/FC-7 are in), V30-3/6 (V30-6 flagged not-independently-verified, real risk of stating an unconfirmed structural-cardiac claim too flatly), V31-4/6/7 (already covered by the P0 SSmax subsection), RE-1–7 (mostly already-covered ground per the ch. 32 duplication warning, or conflicted/thin evidence), RES-1/10/12 (meta-caveats or sparse-evidence speculation with low actionable value), TR-2–4 (redundant with the resilience section's own closing synthesis), MF-1 (soleus-vs-vastus fiber percentages, a fun fact without a clear teaching point), FUEL-1/3/4 (small-effect trivia or fairly deep beta-oxidation biochemistry with lower payoff than what's already shipped), PM-1 (duplicate of V30-5, already shipped in Phase 7), DOM-2/5 (already covered by DOM-3/4 in the Phase 7 domains subsection), M-6 (duplicate, already shipped in Phase 7).

Verification: `npx tsc --noEmit -p .` clean, `npx eslint src/lib/sections.ts` clean, `npm run test` (1650 passed, 1 pre-existing expected fail), `npm run build` clean. Cross-reference phrasing re-checked against real heading/section-title text.

**All P0 and curated P1/P2 items are now shipped.** Remaining, deliberately unimplemented P1/P2 items stay documented in `extraction.md` for any future session that wants to revisit the exclusion calls above.

## Phase 0 — Haarchive existing-coverage audit (relevant to chapters 22–23)

Inspected directly (`grep`/`Read` against the live `src/lib/sections.ts`, not assumed from memory):

- **ATP/energy-system yield math**: `exercise-physiology` already has the "36 vs. 2 ATP, aerobic vs. anaerobic per glucose molecule" comparison (Morehouse & Miller, *The Physiology of Exercise*), used to explain why hard, oxygen-starved running burns fuel and fatigues faster. Does not currently distinguish blood-glucose glycolysis (net 2 ATP) from muscle-glycogen glycolysis (net 3 ATP) — Davis's ch. 22 makes exactly this distinction.
- **Lactate/threshold**: extremely well-developed existing content across `exercise-physiology`, `data-and-analytics`, and `workout-library` — individualized lactate-threshold ranges (2.3–3.0 mmol/L vs. the textbook 4.0 population average), critical power/critical velocity as a sharper concept than threshold, Fitzgerald's 5-zone system, heart-rate-based threshold estimation (30-min time trial, talk test), the "threshold zone is a trap" framing from Seiler. **No existing content anywhere found on**: the ATP-hydrolysis mechanism itself, the G6P→pyruvate→lactate pathway, monocarboxylate transporters / the lactate shuttle mechanism (between fibers, or to blood/liver/kidneys), acetyl-CoA as the convergence point for all four fuels, or the modern "lactic acid" terminology correction. This is genuinely new territory for the site, not a duplicate risk.
- **Oxygen delivery**: `the-aerobic-base` (in `exercise-physiology`) covers the *adaptations* to the oxygen-delivery system in real depth — capillary density (60,000-mile network estimate, Swedish-vs-Kenyan quadriceps capillary counts), mitochondrial growth, stroke volume, the "deflection point." It does **not** currently walk the pathway itself (lungs → hemoglobin → heart → capillaries → diffusion → mitochondria, and the return trip) as a standalone explainer — the existing content assumes that pipeline as background rather than describing it. This is a real gap Davis's ch. 23 opening could fill without duplicating the adaptation content already there.
- **Fuel sources**: `nutrition-and-fueling` already covers the crossover point (untrained ~50% capacity on fat before switching to carb, trained ~80%), FASTER study fat-oxidation rates, carb-loading targets, glycogen depletion/IL-6 signaling. It does **not** currently explain *why* carbohydrate is oxygen-cheaper than fat (the RQ-based ATP-per-liter-O2 argument) — the existing content explains *when* the fuel switch happens and how training shifts it, not the underlying biochemical reason carbohydrate reliance increases at higher intensity independent of glycogen availability. Also no existing content on the glycogen-bound-water hydration fact, or on the liver-vs-muscle glycogen enzyme distinction (why one muscle can't borrow another muscle's glycogen).
- **Fiber types**: `exercise-physiology` already has a solid three-fiber-type breakdown (Type I / IIA / IIB — capillarization, fuel preference, force, trainability) sourced to Karp via Livingstone. Chapters 22–23 only mention fiber type in passing (glycolytic vs. oxidative fibers, in the lactate-shuttle discussion); the real comparison point is ch. 24, not yet received.
- **VO2max**: `exercise-physiology` already has a genuinely sophisticated take ("VO2 max is really the product of two separable adaptations" — aerobic/capillary vs. anaerobic-chemistry/buffering, trained on very different timescales). Chapters 22–23 don't touch VO2max directly; real comparison point is ch. 30, not yet received.

See `extraction.md` for the full candidate table from chapters 22–23.
