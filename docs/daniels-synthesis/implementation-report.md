# Implementation Report — *Daniels' Running Formula* Integration

Research artifacts: `extraction.md`, `integration-map.md`, `source-citations.md`, `digests/digest-01.md`–`digest-12.md` (all in this directory). Source: Jack Daniels, *Daniels' Running Formula*, 4th edition (Human Kinetics, 2022), read directly from `resources/books/daniels running formula.pdf`.

**UPDATE — full book now read.** This report originally covered only chapters 1-10 plus marathon concepts (§"Reading scope" below, preserved as-is for the historical record). A follow-up pass, requested directly, completed chapters 11-18 (800m through triathlon), the appendix, and the glossary/index. See **"Chapters 11-18 Extension"** near the end of this report for what that pass found and implemented. Everything in the original sections below remains accurate for the first pass; nothing in it was revised.

**Citation format note**: per explicit user direction (given mid-session, after discovering the source PDF has no printed page numbers to cite honestly), citations use author + book title only — `(Daniels, Daniels' Running Formula)` — matching this site's own pre-existing live citation convention for books. This also required retroactively fixing page-numbered citations added earlier this session during a preceding *Running with the Buffaloes* integration; that fix is documented in `docs/buffaloes-synthesis/manifest.md`'s own "Citation-format correction" note and is unrelated to, but disclosed alongside, this report. (The follow-up chapters 11-18 pass later discovered, via the book's own index, that the source PDF does contain real underlying page numbers not visibly rendered in the individual page images read — noted for completeness in digest-12, but the citation-format decision was not revisited.)

---

## Implemented (original pass, chapters 1-10 + marathon concepts)

### Reading scope (disclosed upfront, per the task's own instruction to prefer fewer strong integrations)

Chapters 1-10 (Essentials, Training Principles, Physiological Profiles, Types of Training, VDOT, Environment/Altitude, Treadmill, Fitness Training, Season-Tailored Training) were read in full. Chapter 16 (Marathon) was read for concept-level material, with its extensive weekly-table data explicitly not reproduced. Chapters 11-15 and 17-18 (800m through triathlon, event-specific application chapters), the appendix, and the glossary were, at that point, **not yet read** — a deliberate scope decision at the time, made after confirming (via chapter 11's own opening pages) that these chapters reapply the same core E/M/T/I/R + VDOT + four-phase-season framework per event, layered with historical/athlete color. That scope was later extended on request — see the Extension section below.

### Production changes

- **`data-and-analytics`** (`src/lib/sections.ts`) → expanded the existing, single VDOT mention with the epistemic clarification that VDOT is a "pseudo VO2 max" derived from race performance, not a lab measurement, plus its real, stated scope limits (less reliable across distant event predictions; shouldn't be used from a poor-conditions time). *Why*: directly answers the task's own explicit VDOT research question and closes a real gap in the site's only prior VDOT reference. *Citation*: (Daniels, Daniels' Running Formula).
- **`research-library`** ("VO2 Max Doesn't Decide Who Wins") → added one new paragraph crediting Daniels' own coined term, vVO2max, as the named framework behind the site's already-existing Prefontaine/Shorter/Clayton/Radcliffe case studies, with his own two real tested examples (a 15%+ VO2max gap between teammates who ran within seconds of each other; three elite women with a 13-point VO2max spread and nearly identical 3000m times). *Why*: the underlying claim was already thoroughly covered — this is deliberately the **only** addition made here, to avoid re-explaining an already-well-evidenced point (see Duplication Audit below). *Citation*: (Daniels, Daniels' Running Formula).
- **`workout-library`** → four additions: (1) extended the altitude subsection (already carrying Vigil and, from the prior Buffaloes integration, Wetmore) with Daniels' own real, quotable skepticism that altitude explains elite performance at all, plus his quantified VO2max-vs-performance altitude tradeoff (~13% vs. ~6-8%) and the physiological-vs-competitive-acclimatization distinction, creating a genuine three-way disagreement; (2) extended the existing interval-structuring content with Daniels' distinct physiological reasoning for I-pace work-bout duration (VO2max takes ~2 min to reach, ~11 min ceiling, maximize accumulated time at VO2max) and the "only two structural shapes of training" reframe; (3) a new subsection, "Putting a Number on Total Training Stress," describing Daniels' per-zone training-load points system. *Citation*: (Daniels, Daniels' Running Formula) throughout.
- **`exercise-physiology`** → two new subsections: "Comparing Men's and Women's Running Economy Fairly" (a real methodological correction: compare at equal %VO2max, not equal pace) and "Breathing Rhythm as a Real-Time Pacing Signal" (the CO2-not-O2 mechanism, Daniels' named 4-4/3-3/2-2/1-1 ratio system with real worked ventilation numbers, and the practical 2-2-through-two-thirds-of-a-race pacing check). *Citation*: (Daniels, Daniels' Running Formula).
- **`marathon-training`** → four additions: (1) Meb Keflezighi's real 9-day training-cycle example, illustrating that marathon training cycles don't have to run on a calendar week; (2) a new subsection, "How Much of Each Pace Is Actually Enough," giving Daniels' real per-zone volume caps (R/I/T/M/L as percentages or absolute caps of weekly mileage) plus a table-free pace-differential shortcut; (3) Daniels' more granular, distance-scaling recovery-day rule (1 easy day per 3,000-4,000m raced), added alongside (not replacing) the existing Lydiard-sourced two-week marathon-recovery guidance as an independent, corroborating, more general rule. *Citation*: (Daniels, Daniels' Running Formula).
- **`for-coaches`** → four additions: (1) a new opening subsection, "Gather the Same Information Every Time: The Runner Profile," describing Daniels' real, complete 9-question athlete-intake questionnaire; (2) "A Healthy Team Beats a Few Peak Performers," a second, independent coach's voice (alongside the existing Wetmore material from the Buffaloes integration) on the real tradeoff between team-wide health and individual peak fitness; (3) a new subsection, "Daniels' Twelve Laws of Running," condensing his full 12-item framework, paired with his real, quotable "first you are a person, second a student, third a runner" quote. *Citation*: (Daniels, Daniels' Running Formula).
- **`5k-training`** → one new subsection, "Most Race Mistakes Happen in the First Mile," adding Daniels' distinct causal framing (the field collectively follows an early fast pace into the same mistake, so the runner who doesn't is the real beneficiary) alongside the site's existing "don't go out too fast" content, without restating it. *Citation*: (Daniels, Daniels' Running Formula).

### Coaching Library

**Jack Daniels already had a Coaching Library entry** (confirmed by direct inspection before any work began) — this task therefore enriched the existing entry rather than creating a duplicate, per the task's own conditional instruction ("If he does not [exist]... If yes, add him"). Specific enrichments to `src/lib/coaches/data.ts`:
- `corePrinciples`: added "Build a season backward from the goal race, not forward from day one" and "Include real resistance training as a standing part of the week, not an afterthought" — the second one is a real, disclosed correction (see Contradictions/Caveats below), since the book states directly that Daniels "encourage[s] all runners to include resistance training," a fact the existing entry's principles list omitted.
- `periodization` / `periodizationSummary`: replaced the previous generic four-phase description (Base / Early Quality / Peak Quality / Taper, described only vaguely) with the real, named B/FIP → IQ → TQ → FQ structure and an explicit statement of Daniels' actual backward-planning methodology (deciding the peak phase first, then working back). This is a genuine accuracy upgrade, not just an addition — the previous version didn't reflect the real depth of the system despite the book being the entry's own primary source.
- `misunderstandings`: added two new entries — "VDOT is a measured VO2max" (real, false) and "Daniels doesn't believe in strength training" (real, false, with the book's own stated resistance-training endorsement as the correction).

### Athlete Library

**No new entries added.** The task's own instruction is explicit: "A passing mention or result is insufficient... if an athlete is not substantial enough for a profile, leave them out." Every athlete named in the chapters actually read (Jim Ryun, Peter Snell — already a site entry via Lydiard, Alberto Juantorena, Joaquim Cruz, Jarmila Kratochvílová, Meb Keflezighi) appears only in brief historical-color passages or a single photo caption, not the kind of sustained, multi-paragraph training/psychology/recovery detail the existing four (soon five, post-Buffaloes) Athlete Library entries are built from. Meb Keflezighi's real 9-day-cycle detail (the single richest athlete-specific data point found) was used directly in `marathon-training` instead, where it stands on its own without needing a full profile page to support it.

---

## Intentionally Not Implemented

- **VO2max-vs-running-economy as competing performance predictors, and age-predicted max heart rate's unreliability** — both are real, well-evidenced Daniels arguments, and both were **deliberately excluded as re-explanations**, because the site already covers each thoroughly with its own strong, independently-sourced case studies (Prefontaine/Shorter/Clayton and Radcliffe's 12-year case for the first; a real 37-trained-cyclist dataset for the second). This is the single most important disciplined decision in this integration — see the Duplication Audit below for the full reasoning. The only fragment of either idea actually integrated is the vVO2max name-credit (above).
- **A real, field-usable max-HR self-test protocol** (repeated hard 2-minute efforts until HR plateaus) — a genuinely distinct, complementary practical technique, not a re-explanation of the underlying claim, but ultimately left out for this pass given its narrow scope and the absence of a clearly ideal existing location; noted in `extraction.md` as P2/optional for a future pass if the site's max-HR content is expanded.
- **The generic white/red/blue/gold training-plan tiers and the full event-specific weekly tables** (chapters 8, 11-18) — not reproduced or described in structural detail, both because of the explicit copyright-handling instruction and because the site's own Training Plans tool (five interactive volume tracks, per CLAUDE.md) already serves this exact function architecturally better than a static description of Daniels' own tables would.
- **The 180 steps/minute cadence research and the hemoglobin-performance estimate** — real, genuine, but narrower and lower-priority than the other physiology material gathered; left in the digest archive as P2/P3 rather than forced into production content.
- **The speed-versus-endurance diagnostic concept** (comparing 400m/800m/1500m times) — the underlying idea is real and reusable, but it's built entirely around a specific, copyrighted lookup table; describing the concept without the table felt thin enough on its own that it was left out rather than added as a weak, table-free stub.
- **R-pace's group-training breakdown and its economy-training purpose** — real, but narrow refinements of content already covered adequately; left as P2/optional in the extraction table rather than integrated.
- **A new top-level taxonomy category or new page** — never seriously considered; every genuine gap this synthesis found fit inside the existing four-domain structure and existing pages, several by enriching a page or entry that already existed (Daniels' own Coaching Library page, `data-and-analytics`'s existing VDOT mention) rather than creating new standalone content.

---

## Contradictions / Caveats

- **Altitude training's actual causal role.** A real, three-way, unresolved disagreement now exists across the site once this integration is live: Joe Vigil treats altitude as a real, structured training lever requiring a defined relocation/adaptation protocol; Mark Wetmore (from the prior Buffaloes integration) lives and trains at altitude but calls its specific physiological benefit "debatable"; Jack Daniels is actively, rhetorically skeptical that altitude explains elite performance at all. This is preserved as a genuine disagreement among three real, successful coaches, not resolved in any direction, per the task's own explicit instruction not to silently reconcile competing frameworks.
- **Strength training's place in Daniels' own system.** The existing Coaching Library entry's `corePrinciples` previously omitted resistance training entirely, even though the book states directly that Daniels "encourage[s] all runners to include resistance training in their weekly program" and provides a specific circuit. This was a real, disclosed gap in the existing entry (not something this synthesis introduced) and has been corrected with a new core principle and a new `misunderstandings` entry — a small, honest fix, not a large restructuring, since the book's own emphasis on this is genuinely secondary to its core VDOT/pace-zone content.
- **Team-selection philosophy vs. peak individual fitness.** Daniels' own stated preference (a broadly healthy team over a few athletes at peak fitness and others injured) directly, independently corroborates a real tension already documented from Wetmore's program in the Buffaloes integration — presented in `for-coaches` as a second, separate coach's voice on the same real tradeoff, not a restatement of Wetmore's own story.

---

## Epistemic Audit

- **Coaching-vs-science distinction preserved throughout.** Every Daniels-derived claim added to production content is attributed either to "Coach Jack Daniels" by name or to "(Daniels, Daniels' Running Formula)," and physiologically-flavored claims (the altitude VO2max/performance split, the breathing-ventilation numbers, the economy-comparison methodology) are presented as his own stated reasoning/testing, not as independently established, peer-reviewed fact. Nothing was upgraded from "Daniels says" to "research shows."
- **VDOT is never presented as an exact physiological measurement** — the entire `data-and-analytics` addition exists specifically to state the opposite explicitly.
- **No anecdote is presented as causal evidence.** The Coaching Library `periodizationSummary` enrichment explicitly states that "a single season's outcome can't isolate the periodization system's own contribution from the athletes' own talent, an experienced coaching staff, or simple recruiting" (language already present from the site's own existing convention, preserved and extended, not removed).
- **No training pace or sample schedule is presented as universally optimal** — the per-zone volume caps and pace-differential shortcut in `marathon-training` are framed as "a real, stated coach's own guardrails," not physiological limits, and Meb Keflezighi's 9-day cycle is framed as one real example, not a template to copy.
- **Conflicting philosophies remain scoped**, per the altitude three-way disagreement above.
- **Direct quotations are exact**, transcribed from the book's own text as read this session (verified against `source-citations.md`), never invented or strengthened.
- **No unsupported athlete detail was invented** — the decision not to add any new Athlete Library entries is itself the direct consequence of this discipline; no thin profile was built to fill a gap.
- **No scientific claim is misattributed to Daniels** — where the site's existing content already correctly attributes a finding to its original researcher (Achten et al. on the crossover point, Spencer/Gastin/Payne on energy-system splits, etc.), none of that attribution was touched or blurred by the new Daniels material sitting nearby.

---

## Chapters 11-18 Extension

Full raw notes: `digests/digest-08.md`–`digest-12.md`. Full extraction/integration/citation detail: `extraction.md` §6, `integration-map.md`'s "Chapters 11-18 extension" table, `source-citations.md`'s matching section.

### What was read

All of chapters 11 (800m), 12 (1500m-2 miles), 13 (5K/10K), 14 (Cross Country), 15 (15K-30K), the marathon chapter's remaining introductory material (six named program structures, the chapter's own epigraph), 17 (Ultradistance), and 18 (Triathlon), plus the appendix (pure pace-conversion tables) and the glossary/index. This completes a full read of the book.

### Implemented

- **`5k-training`** — two new subsections: **"The Race Starts Two-Thirds Through"** (a distance-scaled racing-execution heuristic for 5K/10K, a concrete mile/1500m pacing template, and the precise race-distance-to-%vVO2max data set spanning 1500m through 10K) and **"A Real Case for Starting Conservative"** (a real, first-person, quantified national-championship case study — an entire team started dead last through 400m on a deliberately conservative pace and won the team title, plus the quantified team-scoring argument for why mid-race passing outweighs a finishing kick). *Why*: RC-8 in particular is the single strongest new extraction from the full-book read — a real, numbered demonstration of a principle the site already stated in the abstract. *Citation*: (Daniels, Daniels' Running Formula).
- **`workout-library`** — one new paragraph, added directly to the existing three-way altitude disagreement (Vigil/Wetmore/Daniels), connecting Daniels' own reasoning for why cross country's uneven terrain breaks pace-based interval prescription in the same way altitude does, and why time-based prescription is the shared fix. *Why*: a genuine bridging insight between two already-integrated ideas, not a restatement of either. *Citation*: (Daniels, Daniels' Running Formula).
- **`recovery`** — one new paragraph added directly after the existing Guillaume Millet/Tor des Géants sleep-deprivation research, adding a real, independent, practitioner-level corroboration: professional ultrarunner Magda Lewy-Boulet's own deliberate practice of night/sleep-deprived training runs, reported via Daniels' own interview with her. *Why*: a different *kind* of source (lived athlete practice, not another lab study) reinforcing an existing, real finding. *Citation*: (Daniels, Daniels' Running Formula; quote attributed directly to Magda Lewy-Boulet).
- **`the-philosophy-of-running`** — one new closing vignette, "With Your Brain, Then With Your Heart," built around the marathon chapter's own epigraph. *Why*: a strong, standalone, unifying quote that ties together the racing-execution content already built from this and the prior Buffaloes pass, without restating any of it. *Citation*: (Daniels, Daniels' Running Formula).
- **`for-coaches`** — one new paragraph added directly after the existing "Individualized Plans vs. a Shared Team Template" content, adding a second, independent instance of the uniform-team-treatment critique (a real quote about mismatched mile-ability warm-ups, plus Daniels' own personally-lived example from modern pentathlon/Army training). *Why*: reinforces an existing principle with two new, real, independently-sourced instances rather than just repeating it. *Citation*: (Daniels, Daniels' Running Formula).

### Intentionally not implemented (extension)

- **Two confirmed duplicates**, excluded per the task's own instruction against re-explaining existing content: power-hiking steep ultra climbs (already covered in `trail-and-ultra-training`), and the "train the gut" ultra-fueling framing (substantially overlapping with existing GI-distress/fueling content in the same section).
- **All triathlon-specific content** (chapter 18) — the site has no triathlon page, and creating one is out of scope for this synthesis; documented in digest-12 only.
- **The "Alien Training" 2-week repeating-cycle alternative** and the **six named marathon-program-structure typology** — both real and genuine, but judged narrower/lower-priority than the items actually implemented, consistent with "prefer fewer strong integrations over many weak ones." Left as P2/optional in `extraction.md` §6.
- **R-pace-as-a-welcome-break** (a real psychological nuance on R-pace training) and **an explicit model of intellectual humility** (Daniels deferring to Magda Lewy-Boulet rather than guessing at ultra training) — both real, both judged too narrow to warrant their own standalone addition; the second is implicitly present in how the sleep-deprivation corroboration above is attributed (to Lewy-Boulet directly, not asserted as Daniels' own claim).

### Contradictions / caveats (extension)

No new contradictions were introduced by this extension — the three-way altitude disagreement (Vigil/Wetmore/Daniels) already documented in the original pass was extended with one connecting insight, not complicated further.

### Epistemic audit (extension)

- The sleep-deprivation corroboration in `recovery` is explicitly attributed to **Magda Lewy-Boulet's own account**, not presented as Daniels' own claim or as further scientific evidence beyond what Millet's research already establishes — the distinction between "a real athlete's practice" and "a research finding" is preserved in the prose itself ("A real ultrarunner's own training practice backs this up from the athlete's side, not just the research").
- The national-championship case study in `5k-training` is presented as a real, specific, first-person account from the book, with real numbers, not generalized into a universal claim that starting conservatively always produces a last-to-first result.
- No page numbers were introduced despite the appendix/index confirming the source does have them internally — the citation-format decision from earlier in this session was deliberately not revisited.

---

## Testing (final, covering both passes)

- **`npx tsc --noEmit -p .`** — clean, no errors.
- **`npx eslint src/lib/sections.ts`** — clean, no errors or warnings.
- **`npx vitest run`** — full suite: **130 test files, 1362 tests passed, 1 expected fail** (the same pre-existing expected failure noted throughout this session, unrelated to this work). No new failures introduced by either pass.
- **`npm run build`** — succeeded after both passes. All routes listed normally with no new build errors.
- **Rendered-page inspection (Playwright)**, first pass: confirmed `/coaching-library/daniels`, `/for-coaches`, `/exercise-physiology`, `/workout-library`, `/marathon-training`, `/5k-training`, `/research-library`, and `/data-and-analytics` all return HTTP 200; confirmed the enriched Daniels Coaching Library page renders correctly; confirmed new headings appear correctly in page tables of contents.
- **Rendered-page inspection (Playwright)**, extension pass: confirmed `/5k-training`, `/workout-library`, `/recovery`, `/the-philosophy-of-running`, and `/for-coaches` all return HTTP 200; confirmed "A Real Case for Starting Conservative" and "With Your Brain, Then With Your Heart" both render with correct heading hierarchy, table-of-contents entries, and citation text.

---

## Commit Status

No changes have been committed to git. All edits (`src/lib/sections.ts`, `src/lib/coaches/data.ts`) remain in the working tree, alongside the uncommitted changes from the prior *Running with the Buffaloes* integration earlier in this session, ready for review together or separately.
