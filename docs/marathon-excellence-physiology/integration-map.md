# Integration Map — Marathon Excellence for Everyone, Part V physiology synthesis

Consolidates the P0 ("essential") candidates from `extraction.md` §1–11 into concrete, page-level edits. P1/P2/P3 candidates are listed in `extraction.md` but intentionally excluded here — this map is scoped to P0 only, per the task's own phased gate. Nothing in this file has been written into `src/lib/sections.ts` yet; this is the plan Phase 7 (production edits) executes against.

Columns: **Existing page** (exact file/section) · **New subsection?** · **Proposed heading** · **Content type** · **Primary source** (Davis chapter) · **Scientific sources** (peer-reviewed/established evidence) · **Attribution style** · **Cross-links**.

Attribution styles used (fixed vocabulary, per task spec):
- "Research suggests..." — established, independently-verifiable science
- "A useful way to conceptualize this is..." — a genuinely useful model/framework, not a hard fact
- "Davis proposes..." — Davis's own original synthesis or application, not independently sourced
- "Davis synthesizes the literature as..." — Davis's honest, careful summary of real research, credited to him for the synthesis work itself
- "The evidence is mixed..." — genuinely contested or context-dependent

---

## Phase 4 conflict-audit finding (resolved before this map was written)

**`exercise-physiology`'s existing "Fast-Twitch, Slow-Twitch, and the Acid/Alkali Balance" subsection (and, adjacent to it, "Steady State and Oxygen Debt") is genuinely outdated content**, not merely a gap. Both currently state the pre-1980s model directly: oxygen debt "alongside lactic acid," muscle fibers that "thrive in a mildly alkaline system," high-intensity training pushing pH "toward acidic" as the operative fatigue mechanism. This is exactly the framing chapters 22–23's lactate-shuttle correction (AE-4/AE-5) supersedes.

**Resolution — extend, don't delete.** The page already has a live precedent for handling exactly this situation gracefully: "Oxygen Debt: The Original Estimate vs. the Corrected One," an `advanced` callout that keeps Lydiard's original 15–18L estimate on the page while showing Snell's revised ~4L figure, framed as "the specific numbers changed, the underlying logic didn't." Row 1 below applies that identical pattern to the acid/alkali claim: keep the existing paragraph (it's real, attributed, Lydiard-sourced coaching history, and its second half — buffer hard sessions with easy volume — survives the correction), and add a new adjacent callout that names what modern exercise physiology actually found. This is a **correction layered onto existing content**, not a rewrite of it — consistent with CLAUDE.md §13 ("preserve existing functionality," "avoid unnecessary rewrites").

---

## 1. `exercise-physiology` — lactate/energy-systems correction and expansion

| # | Existing page | New subsection? | Proposed heading | Content type | Primary source | Scientific sources | Attribution | Cross-links |
|---|---|---|---|---|---|---|---|---|
| 1 | `exercise-physiology`, immediately after "Fast-Twitch, Slow-Twitch, and the Acid/Alkali Balance" | No — new callout appended to the existing subsection, matching the adjacent Snell-correction callout's own pattern | *(callout, no heading — same convention as the Snell callout)* | Research callout (`advanced` variant, matching its neighbor) | Davis ch. 22–23 (AE-4/AE-5) | Brooks lactate-shuttle hypothesis (Brooks, 2009/2018 — real paradigm shift, independently verified this pass, see `source-citations.md` §A) | "Research suggests..." | None needed — self-contained correction |
| 2 | `exercise-physiology`, new subsection before "Steady State and Oxygen Debt" | Yes | "What Lactate Actually Is (and Isn't)" | Physiology explainer | Davis ch. 22 (AE-1, AE-2, AE-3, AE-6/FUEL-6) | ATP hydrolysis (foundational biochemistry, not Davis-specific); lactate shuttle hypothesis (Brooks) for the fuel-not-waste reframing | "Research suggests..." for the shuttle mechanism; "A useful way to conceptualize this is..." for the acetyl-CoA convergence framing | Links forward to "Why Anaerobic Running Is 19 Times Less Efficient" (existing) and the new callout in row 1 |
| 3 | `exercise-physiology`, new subsection before "Steady State and Oxygen Debt" | Yes | "The Oxygen Delivery Pipeline" | Physiology explainer | Davis ch. 23 (OD-1) | Standard respiratory/cardiovascular physiology (lungs → hemoglobin → heart → capillaries → mitochondria), not Davis-specific | "A useful way to conceptualize this is..." | Cross-link to `the-aerobic-base`'s "60,000 Miles of Plumbing" (the adaptations to this same pipeline — this new passage is the pipeline itself, that page is what training does to it) |

**Why not `the-aerobic-base` instead for rows 2–3:** `the-aerobic-base` already opens directly into capillary/mitochondrial *adaptation* content: adding a pipeline-anatomy primer there would displace its own opening. `exercise-physiology` currently has no equivalent foundational-mechanism section before jumping into Steady State — these two rows fill that real gap in the page that actually lacks it, and the cross-link handles the connection both ways.

---

## 2. `exercise-physiology` — VO2max and SSmax refinement (extends existing sections, doesn't replace them)

| # | Existing page | New subsection? | Proposed heading | Content type | Primary source | Scientific sources | Attribution | Cross-links |
|---|---|---|---|---|---|---|---|---|
| 4 | `exercise-physiology`, extends "VO2 Max Is Two Adaptations Sharing One Name" | No — added paragraphs to the existing subsection | *(same heading, expanded)* | Physiology explainer | Davis ch. 30 (V30-1, V30-2, V30-4, V30-5) | Hemoglobin mass as primary VO2max driver; plasma-volume vs. hemoglobin-mass training response; red-cell 4-month lifespan; max HR trained-decrease (~3–7%, Zavorsky-line review) — all independently verified this pass | "Research suggests..." | None new |
| 5 | `exercise-physiology`, new subsection after "VO2 Max Is Two Adaptations Sharing One Name" | Yes | "What Actually Drives Your Sustainable Pace Ceiling" | Physiology explainer | Davis ch. 31 (V31-1 through V31-4, V31-6, V31-7) | Capillary density (2–3x trained vs. untrained), mitochondrial density vs. function as separately-trained variables (volume-driven density, a 2018 review of 1,200+ subjects, independently verified), lactate-shuttle protein density (monocarboxylate transporters) | "Research suggests..." | Cross-link to existing threshold/critical-power content in `data-and-analytics` and `workout-library` |
| 6 | `exercise-physiology`, inside the new subsection from row 5, as a standalone research callout | No (nested in row 5's subsection) | "Nature vs. Training: What a Pair of Identical Twins Shows" | Research callout (`research` variant) | Davis ch. 31 (V31-5) | 2018 identical-twin study, mid-50s twins, one sedentary/one lifelong runner — 94% vs. 40% slow-twitch fiber composition, 30% higher VO2max, better resting HR/lipids in the trained twin (likely Bathgate et al., independently matched this pass — see `source-citations.md`, still flagged not-fully-confirmed) | "Research suggests..." | None new |
| 7 | `exercise-physiology`, inside row 5's subsection | No | *(short paragraph, no separate heading)* | Training application caveat | Davis ch. 31 (V31-8) | Intensities above 100% VO2max blunting the gene-expression response that drives lactate-shuttle adaptation — flagged in `source-citations.md` as not independently verified against a primary source; state cautiously | "Davis synthesizes the literature as..." | Cross-link to the existing "Applying This: Sequencing Aerobic Base and VO2 Max Work" passage |

---

## 3. `exercise-physiology` — new "Three Domains of Intensity" subsection

| # | Existing page | New subsection? | Proposed heading | Content type | Primary source | Scientific sources | Attribution | Cross-links |
|---|---|---|---|---|---|---|---|---|
| 8 | `exercise-physiology`, new subsection (placement: after the lactate/energy-systems content from Group 1, before muscle-fiber content) | Yes | "Three Domains of Intensity, Not a Simple Easy/Hard Split" | Model-framework | Davis ch. 27–28 (DOM-1, DOM-3, DOM-4, DOM-6) | Whipp/Jones/Poole moderate-heavy-severe intensity-domain tradition — real, established exercise-physiology framework, not Davis's invention (Davis's book folds a 4th "very heavy" domain some literature uses into his 3-domain model — noted as a simplification, not an error) | "A useful way to conceptualize this is..." | Cross-link to existing `data-and-analytics` threshold-zone content and the existing "Central vs. Peripheral Fatigue" subsection (fatigue mechanism differs by domain — DOM-3/DOM-4 map directly onto that existing content) |
| 9 | `exercise-physiology`, inside row 8's subsection | No | *(paragraph within the domains subsection)* | Comparison/caveat | Davis ch. 27–28 (M-1, M-2, M-6) | %VO2max vs. %HRR vs. %5K-pace as intensity proxies — %HRR measurably tracks %VO2max more accurately than %HRmax; 5K-pace-based ranges are tighter/better-correlated with LT1/SSmax than %VO2max-based ranges | "Research suggests..." | Cross-link to existing pace/HR calculator tools (Pace % Calculator, HR Threshold Calculator) as the practical application of this |

---

## 4. `nutrition-and-fueling` — RQ-based fueling mechanism and Fatmax caveat

| # | Existing page | New subsection? | Proposed heading | Content type | Primary source | Scientific sources | Attribution | Cross-links |
|---|---|---|---|---|---|---|---|---|
| 10 | `nutrition-and-fueling`, extends the existing crossover-point content | No — added paragraph | *(existing crossover heading, expanded)* | Physiology explainer | Davis ch. 22 (FUEL-5) | Respiratory-quotient physiology: carbohydrate ~7% cheaper per liter of O2 than fat (RQ 1.0 vs. ~0.7; thermal-equivalent-of-oxygen figures ~5.05 vs. ~4.69 kcal/L O2) — century-old, well-established physiology, independently verified this pass | "Research suggests..." | None new — this is the "why" underneath the site's own existing "when" (crossover point) content |
| 11 | `nutrition-and-fueling`, near the existing FASTER-study passage | No — added caveat paragraph | *(existing "What a Diet Does to Peak Fat-Burning Rate" heading, expanded)* | Caveat | Davis ch. 26/28 (WB-11) | Fatmax (pace of maximal absolute fat-oxidation rate) is not a reliable, reproducible measurement — varies 15%+ test-to-test even in the same athlete | "The evidence is mixed..." | None new |

---

## 5. `research-library` — running economy / motor-learning extension (duplication-aware)

| # | Existing page | New subsection? | Proposed heading | Content type | Primary source | Scientific sources | Attribution | Cross-links |
|---|---|---|---|---|---|---|---|---|
| 12 | `research-library`, extends the existing "Don't Fix Your Form: Run More and Let It Fix Itself" section | No — added paragraph, explicitly NOT a new duplicate section | *(existing heading, expanded)* | Standard prose, with a cross-domain link out | Davis ch. 32 (RE-10) | External vs. internal attentional focus in motor learning — Gabriele Wulf's research program (UNLV), Constrained Action Hypothesis/OPTIMAL theory; general principle well-established, Davis's specific application to running economy is self-flagged by Davis as thin | "Research suggests..." for the general attentional-focus finding; "Davis proposes..." for its specific application to running form cues | Cross-link to `sports-psychology` if a motor-learning subsection exists there, otherwise this stays self-contained |

**Explicit non-duplication note:** the Joyner/Breaking2/Kipchoge content (ch. 29, FC-1 territory) and the Radcliffe 15%-economy-improvement citation (ch. 32, same Jones 2006 source already on the site) are **not** re-added anywhere — both are exact duplicates of existing `exercise-physiology`/`research-library` content, per `extraction.md` §7 and §9's duplication warnings.

---

## 6. `marathon-training` — new resilience / late-race-deterioration subsection

This is the single largest genuinely-new block of content in the whole synthesis — Davis's ch. 29–34 "resilience" material has no real existing counterpart on the site (unlike VO2max and running economy, which already have developed pages).

| # | Existing page | New subsection? | Proposed heading | Content type | Primary source | Scientific sources | Attribution | Cross-links |
|---|---|---|---|---|---|---|---|---|
| 13 | `marathon-training`, new subsection | Yes | "Why Marathon Pace Erodes Late, Even When VO2max and Economy Don't Change" | Physiology explainer | Davis ch. 29, 33 (FC-1, FC-4) | Frank-Starling mechanism (foundational cardiovascular physiology, explicitly not Davis-specific) as one contributor; resilience defined as the fraction of SSmax an athlete can sustain for the full marathon | "A useful way to conceptualize this is..." for the four-component framing; "Davis proposes..." for naming resilience as a distinct, trainable fourth component | Cross-link to `exercise-physiology`'s existing Joyner/Breaking2 content (the three-variable model this extends) and the new SSmax subsection (row 5) |
| 14 | `marathon-training`, inside row 13's subsection, as a research callout | No | "What a 1991 Study Found After 42 Kilometers" | Research callout (`research` variant) | Davis ch. 33 (RES-2) | A 1991 lab study (oxygen cost measured at 15/32/42km) found ~5% rise in oxygen cost of running by the full marathon distance — flagged in `source-citations.md` as not yet independently verified against the primary source; state with appropriate hedging | "Davis synthesizes the literature as..." | None new |
| 15 | `marathon-training`, inside row 13's subsection | No | *(paragraph, no separate heading)* | Physiology explainer | Davis ch. 33 (RES-5) | Localized glycogen depletion at "triad junctions" — a real, specific, physically-isolated muscle-fiber microstructure implicated in late-race calcium-handling/force-production failure | "Research suggests..." | Cross-link to `nutrition-and-fueling`'s existing glycogen-depletion/carb-loading content |
| 16 | `marathon-training`, inside row 13's subsection | No | *(paragraph, no separate heading)* | Research callout / caveat | Davis ch. 33 (RES-8, RES-9) | Downhill-running research model reliably reproduces 4–7% economy deterioration; training implication (high-mileage blocks + long-run exposure builds resistance to this) | "Research suggests..." for the deterioration finding; "Davis proposes..." for the specific training-response claim | None new |
| 17 | `marathon-training`, inside row 13's subsection, extends the existing central/peripheral fatigue framing (cross-linked to `exercise-physiology`, not duplicated there) | No | *(paragraph, no separate heading)* | Research callout (`research` variant) | Davis ch. 33 (RES-11) | Post-marathon central fatigue is muscle-localized, not generalized whole-body tiredness — a specific, real, independently-matched paper ("Fatigue is specific to working muscles: no cross-over with single-leg cycling") | "Research suggests..." | Cross-link to `exercise-physiology`'s existing "Central vs. Peripheral Fatigue: When the Muscle Itself Gives Out" subsection — this is a marathon-specific extension of that page's general framework, not a competing explanation |
| 18 | `marathon-training`, closing paragraph of row 13's subsection | No | "Training the Fourth Component" | Training application | Davis ch. 33–34 (RES-13, TR-1) | Synthesis point: all three of resilience's physiological roots (glycogen/triad-junction depletion, cardiac drift, muscle damage) point toward the same training answer — high mileage and long-run exposure, not a fundamentally different workout type | "Davis proposes..." (this specific synthesis/naming is his) | Cross-link to `workout-library`'s existing long-run guidance |

---

## Summary — page-by-page edit count

| Page | New subsections | Extended existing subsections | Total P0 rows addressed |
|---|---|---|---|
| `exercise-physiology` | 3 (rows 2, 3, 8) | 3 (rows 1, 4, 5–7 nested) | AE-1/2/3/4/5/6, FUEL-6, OD-1, V30-1/2/4/5, V31-1/2/3/4/5/6/7/8, DOM-1/3/4/6, M-1/2/6 |
| `nutrition-and-fueling` | 0 | 2 (rows 10, 11) | FUEL-5, WB-11 |
| `research-library` | 0 | 1 (row 12) | RE-10 |
| `marathon-training` | 1 (row 13) | 4 nested (rows 14–18) | FC-1, FC-4, RES-2, RES-5, RES-8, RES-9, RES-11, RES-13, TR-1 |

All 24 P0-priority items from `extraction.md` are accounted for above except **MF-4** and **PM-2** (both ch. 24–25, muscle-fiber/lactate-balance detail) and **WB-4, WB-7, WB-10** (ch. 26 terminology/measurement notes) — on review, these five are better characterized as **supporting detail folded into the rows above** (MF-4 and PM-2 belong inside row 2's "What Lactate Actually Is" subsection as supporting mechanism; WB-4/7/10 belong inside row 8/9's intensity-domains subsection as terminology/measurement caveats) rather than separate rows of their own, since none of the five stands alone as an independent page edit. This is noted explicitly rather than silently dropped.

---

## What this map deliberately excludes

- Every P1/P2/P3 candidate in `extraction.md` (useful-but-optional or not-worth-it material) — deferred, not rejected; revisit only if explicitly asked.
- Any of Davis's tables, figures, or long-form quotations — none are reproduced anywhere in this map, per the task's explicit copyright guidance.
- Individualized medical/nutrition advice from the ferritin/iron-deficiency sidebar (V30-7) — general-education framing only if it's ever added (currently not included above; it's a P1 candidate per `extraction.md`, not P0).
- Any actual edit to `src/lib/sections.ts` — this map is the plan; Phase 7 (production writing) is a separate, not-yet-started step.

## Before Phase 7 begins

- Confirm the citation convention with the user: this map follows the `daniels-synthesis` precedent (author + title, chapter number as internal provenance only, no page numbers) since Davis's edition/page numbers were never supplied — flagged as still not explicitly user-confirmed for this specific synthesis, carried over from `source-citations.md`'s open header note.
- Re-verify the still-open items in `source-citations.md`'s "Not yet verified" list before stating them as flatly as the rows above currently do, especially rows 6 (twin study), 7 (V31-8 gene-expression claim), and 14 (RES-2 1991 study).
