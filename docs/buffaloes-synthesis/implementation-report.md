# Implementation Report — *Running with the Buffaloes* Integration

This documents what was actually built from `extraction.md` / `integration-map.md` / `source-citations.md`, what was deliberately left out and why, and the verification performed. Every production change below is a real, committed-to-disk edit (not yet git-committed — see note at the end); nothing here was written before the research phase in `extraction.md` was complete, per the task's own implementation boundary.

---

## Implemented

### P0

- **TR-1 (multi-peak periodization)** → `src/lib/sections.ts`, `workout-library` section, new subsection **"Periodizing a Season With More Than One Peak."** Explains the general structural problem (a college season needs 3+ peaks a year; Lydiard's own model assumes one), then presents Wetmore's real 5-phase system as one documented answer, with the "modified Lydiardism, not a new philosophy" distinction stated explicitly per the task's own instruction, and an explicit caveat that one program's outcome can't isolate the periodization system's own causal contribution.

### P1

- **CO-3 (longitudinal evaluation) + CO-4 (abort a session mid-workout)** → `for-coaches`, new subsections **"Evaluate the Pattern, Not the Day"** (folding both together, since they're the same underlying principle applied to interpretation vs. real-time action) — includes the "100 days to impress me" policy, its application to both an unusually good and an unusually bad session, and the real mid-workout session-abort example.
- **PS-10 / CO-9 (crisis-response framework)** → `for-coaches`, new subsection **"Responding to a Team Crisis."** Fully generalized: no retelling of Christopher Severy's death, no identifying narrative detail. States the transferable structure (direct/in-person delivery, tiered support, room for informal peer processing, transparent decision-grounding, deliberate resumption of structure, separating private coach reaction from public communication) and preserves one piece of real, professionally-sourced content (a team psychologist's non-linear-grief guidance) as a direct, attributed quote. Cross-linked from `sports-psychology`'s existing injury-as-grief content.
- **PS-6 (four-factor talent framework)** → `sports-psychology`, new subsection **"A Four-Part Read on What It Takes,"** explicitly labeled as this coach's own framework, not a universal claim, with both the self-applied and athlete-applied examples from the book.
- **CO-1 (athlete-owned goals)** → `for-coaches`, new subsection **"Explaining the Goal Isn't the Same as Letting Athletes Own It,"** placed immediately after and explicitly distinguished from the existing "Demand Sincerity, Explain the Why."
- **CO-2 (unequal coaching attention)** → `for-coaches`, new subsection **"Attention Isn't Distributed Equally, and Pretending Otherwise Doesn't Help,"** paired explicitly with the real, demonstrated pathway for a lower-priority athlete to earn more attention, per the task's instruction not to normalize neglect.
- **TR-5 (training-purpose taxonomy)** → `workout-library`, new subsection **"A Workout's Purpose Isn't Always Aerobic or Anaerobic,"** generalized as a real training-design category (not "Wetmore's exact prescription"), with the book's neuromuscular-300s session as one concrete example.
- **TR-8 (altitude nuance)** → `workout-library`, added directly to the existing "Altitude, in Short Blocks or Long Stays" subsection: Wetmore's own "debatable" framing of his program's altitude benefit, explicitly labeled a coaching hypothesis, paired against (not replacing) Joe Vigil's altitude-relocation model already on that page.
- **RC-1 (hill-racing tactics)** → `5k-training`, new subsection **"Racing a Hilly Course: Conserve Up, Roll Down,"** placed among the page's other racing-tactics content, with the explicit caveat that it's a reasoned exception, not an absolute rule.
- **PS-2 (negative self-talk under fatigue)** → `self-talk`, new subsection **"Trained Self-Talk Doesn't Guarantee Silence Under Fatigue,"** an honest complication of the page's existing self-talk-works case, not a contradiction of it.

### Secondary integrations implemented

- **CO-6** (prior success as a recruit buy-in barrier) → `for-coaches`, folded into the existing patience/teaching-different-learners paragraph, extending the site's existing "curse of talent" content with a specific mechanism.
- **CO-11** (talent ≠ automatic captaincy) → `for-coaches`, folded into the existing Wooden rotating-captaincy paragraph as a complementary consideration.
- **PS-9** (grief is non-linear, professionally sourced) → `sports-psychology`, added directly to "Rebuilding After Injury Is Its Own Mental Skill," extending the existing Cheadle & Kuzma framework with an independent, real, professionally-guided corroborating case.

### Contradictions / caveats implemented, per the task's explicit instruction not to present these as positive advice

- **Strength training** → `strength-training`, new `research`-variant callout **"A real, scoped dissent: not every successful high-volume program agrees,"** placed directly after the page's strongest pro-lifting quote. States the volume-specific scope explicitly, notes it corroborates (not duplicates) Lydiard's own already-flagged skepticism, and does not conclude the page's existing pro-lifting case is wrong.
- **Body composition / RED-S** → `recovery`, new `mistake`-variant callout **"A documented, real example of what the wrong side of this tradeoff looked like,"** placed directly after the existing "who's actually at risk" RED-S callout. States plainly that this is historical documentation of harmful coaching practice, not a technique — never presents a caloric target as actionable, never frames leanness as optimization.
- **Historical doping context, injury concealment, NSAID use** → **not separately integrated as standalone content.** On review, none of these passed the "would this be useful, standalone knowledge to a reader who's never heard of the book" test on their own — see "Intentionally not implemented" below for the reasoning on each.

### Coaching Library

- **`src/lib/coaches/data.ts`** — full Mark Wetmore entry added, matching the existing 7-entry data model exactly (every required field populated, `evidenceStrength` omitted deliberately — see below). Philosophy explicitly framed as "modified Lydiardism," not an invented new system. Includes three real, substantive `criticisms` (strength training, the season's real injury rate, the body-composition culture), with the third one's `response` field explicitly *not* defending the criticism, per `extraction.md`'s own recommendation and the task's instruction that this criticism should be "framed as a documented historical criticism rather than defended." `otherCoachesCritique` uses only real, existing Coaching Library members (Daniels, Vigil, Norwegian System) with good-faith inferences grounded in each coach's own actual documented position — no fabricated critique, and no critique attributed to a coach outside this library (Frank Gagliano, quoted in the book, isn't a Coaching Library member, so wasn't used here). `primarySources` lists only Lear's book — no invented additional sources. `relatedPhilosophies` names both shared ground and genuine difference for Lydiard, Vigil, and Norwegian System, per the task's instruction to make distinctions rather than treat them as interchangeable.

### Athlete Library

- **`src/lib/athletes/data.ts`** — Adam Goucher added. This required an explicit judgment call (task step 9): the book documents him in enough real, durable, cross-checkable detail (a complete high-school-through-collegiate development arc, a specific coach-applied evaluation framework, real training data, real race results, and an honestly-documented professional-career coda) to meet the same bar as the four existing entries, so a thin, results-only profile was not the right call — a real, substantive one was. The body-composition/leanness material connected to him specifically (see `extraction.md` §7.2) was deliberately **excluded** from his individual page: including it there would have made his own body-image experience a named, personal case study, which conflicts with the Athlete Library's own stated "educational, not celebrity-focused" purpose. That material stays exactly where it belongs: presented critically, in `recovery`'s RED-S content, without naming him specifically in a personal-profile context.
- Kara Goucher was **not** added — she appears in the book only as a passing mention in an unrelated podcast-sourced anecdote already on the site (`the-philosophy-of-running`), not as subject matter of this synthesis, so there was no real, durable Buffaloes-specific material to build a page from.

---

## Intentionally not implemented

- **PS-13 ("90% mental" pushback)** — real and interesting, but the site's existing "90% mental" discussion (in `sports-psychology`'s injury-as-grief content) is about a different claim (injury recovery specifically) than Wetmore's claim (overall performance generally); conflating the two risked misrepresenting both. Left out rather than forced into a place it didn't actually fit.
- **RC-6 (verbal in-race gamesmanship) and RC-7 (peer physical intervention mid-race)** — real, but each is a single documented instance without enough independent corroboration to state as a general principle beyond "this happened once, in this book." Marked P3/narrow in `extraction.md`; genuinely more interesting-detail than reusable-knowledge on their own.
- **PL-1 / PL-2 (a dominant athlete suppressing teammates' sense of possibility; reframing success as "brand new" each season)** — real and reasonably interesting, but narrower and more speculative (a coach's own unverified psychological theory about his roster) than the other Philosophy-domain extraction that did make it in (PS-14, "callousing"). Left in the digest archive rather than forced into `the-philosophy-of-running` alongside a stronger, more load-bearing addition.
- **CO-5, CO-7, CO-8, CO-10 (self-limiting authority on a symbolic vote; rejecting the "buy your team" explanation; course-scouting-as-coach-labor; closed-loop self-correction)** — CO-10 is folded implicitly into the Wetmore coach entry's own `dailyLife.mistakes` and `criticisms` fields rather than added as separate `sections.ts` content, since it's really a fact about this specific coach, not a generalizable coaching technique distinct from CO-3/CO-4 already covered. CO-5, CO-7, and CO-8 were judged too narrow/single-instance to earn their own subsection anywhere per the task's explicit "prefer one strong subsection over five weak callouts" instruction — they remain in the digest archive.
- **Historical doping context (§7.6), injury concealment (§7.5), NSAID use (§7.4) as standalone content** — all three are real and all three are already *referenced* implicitly (the injury-concealment lesson is folded into the crisis-response and evaluation content's framing around honest disclosure; NSAID use and doping culture didn't clear the bar of "useful without the book" on their own, given how narrow and dated each is). Not added as separate sections, consistent with the task's instruction not to let historical material overwhelm transferable knowledge.
- **A new top-level taxonomy category or new page** — never seriously considered; every genuine gap this synthesis found fit inside the existing four-domain structure and existing page types, consistent with `extraction.md`'s own gap analysis.

---

## Sensitive material — confirmed

- **Christopher Severy's death was not retold anywhere.** The `for-coaches` crisis-response section and the `sports-psychology` grief extension both describe a real, structured response and quote one piece of professional guidance directly, but neither names circumstances, cause, or narrative detail beyond what's needed to attribute the quote (a real crisis inside a real, named program). Confirmed by direct re-read of both new sections after writing them.
- **Oscar Ponce's personal story was not integrated anywhere** in production content — it never passed the "useful without the book" test on review, and using it would have risked exactly the kind of personal-hardship-as-narrative-color the task explicitly warned against. It remains, respectfully summarized, only in `digests/digest-05.md`.
- **Body-composition material was critically framed, not reproduced as technique**, in both its `recovery` callout and the Wetmore coach entry's `criticisms` field — confirmed no caloric target, weight number, or leanness framing appears anywhere in production content without an explicit "this is a documented harmful pattern" framing attached in the same sentence or callout.
- **Injury concealment (Tom Reese's story) was not normalized.** It isn't cited by name anywhere in production content; the underlying lesson (why athletes hide injuries from coaches) is present only implicitly, folded into the crisis-response and evaluation-methodology content's emphasis on honest disclosure, never as an example to emulate.
- **NSAID use was not presented as advice anywhere** — it wasn't integrated as standalone content at all (see "Intentionally not implemented" above).

---

## Epistemic audit — confirmed

- **No coach philosophy is presented as scientific evidence.** Every Wetmore-sourced claim in production content is attributed either to "a University of Colorado program under coach Mark Wetmore" or directly to Wetmore by name, with a page citation, and framed as a coaching position, hypothesis, or documented practice — never as an established physiological finding. The altitude-nuance addition (TR-8) explicitly labels itself "a working coach's own hypothesis, not established physiology."
- **No anecdote is presented as causal evidence.** The multi-peak periodization section explicitly states a single program's outcome "can't isolate the periodization system's own contribution from athletes' own talent, an experienced coaching staff, or simple recruiting."
- **Historical claims are labeled historically.** The RED-S callout and the Wetmore coach entry's third criticism both use "documented," "era-specific," and "historical" language explicitly, and neither presents the practice as current or endorsed.
- **Source citations are present** on every substantive Wetmore-derived claim added to production content, using the book's own printed page numbers from `source-citations.md` — no guessed or invented page numbers.
- **No quotation was invented or altered in meaning.** Every direct quote added to production content was checked against the transcription in `source-citations.md` / the relevant digest file before use.
- **Unsupported details were not invented.** Notably: Goucher's exact professional-career dates and results beyond what the book documents were left out; Wetmore's `activeYears.end` is set to `null` (still active) based on the book's own 2003 afterword showing him still coaching, not a claim about his current status beyond what's confirmed; `evidenceStrength` was omitted entirely from the Wetmore coach entry (matching the precedent already set by the Tom Schwartz entry) rather than assigning a numeric rating to a profile built from a single work of journalism rather than exercise-science research.

---

## Testing

- **`npx tsc --noEmit -p .`** — clean, no errors.
- **`npx eslint src/lib/sections.ts src/lib/coaches/data.ts src/lib/athletes/data.ts`** — clean, no errors or warnings.
- **`npx vitest run`** — full suite: **130 test files, 1362 passed, 1 expected fail** (the pre-existing expected failure, unrelated to this work). One real failure was caught and fixed during this process: `tests/lib/coach-athlete-links.test.ts` flagged that the Wetmore entry's "Hill Repeats" `signatureWorkouts.workoutLibraryHref` pointed to an anchor on `/5k-training` rather than `/workout-library` (the field is specifically validated against Workout Library headings only) — fixed by removing that href and adding an in-text cross-reference instead, consistent with the type's own documented convention of omitting a guessed/invalid anchor rather than shipping one.
- **`npm run build`** — succeeded. `/coaching-library/[coach]` and `/athlete-library/[athlete]` both render dynamically per-slug (not part of the static-generation list shown in build output, which only enumerates the SSG'd `training-plans` and `athlete-library` paths — the athlete-library route *is* SSG'd and the build output confirms 5 athlete paths generated, up from 4, confirming `adam-goucher` built successfully). No new TypeScript or build errors introduced.
- **Rendered-page inspection (Playwright)**: confirmed `/coaching-library/wetmore` and `/athlete-library/adam-goucher` both render with the full standard template (all sections present, correct visual hierarchy, no layout breakage); confirmed the new `workout-library` heading anchor resolves and scrolls correctly and appears in the page's table of contents; confirmed the new `for-coaches` crisis-response section, the `strength-training` dissent callout, and the `recovery` RED-S historical callout all render with correct heading hierarchy, citation text, and appropriate callout styling. All ten touched pages (`/coaching-library/wetmore`, `/athlete-library/adam-goucher`, `/workout-library`, `/5k-training`, `/for-coaches`, `/sports-psychology`, `/self-talk`, `/recovery`, `/strength-training`, `/the-philosophy-of-running`) returned HTTP 200.

---

## Note on committing

Per this session's standing instruction not to commit without being asked, none of the changes above have been committed to git. They exist as working-tree edits across `src/lib/sections.ts`, `src/lib/coaches/data.ts`, and `src/lib/athletes/data.ts`, ready for review.
