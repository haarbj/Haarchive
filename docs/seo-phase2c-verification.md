# The Haarchive — Phase 2C: Post-Implementation SEO Architecture Verification

Status: **read-only verification. No application files were modified to produce this document.** Every claim below was independently re-verified against the current codebase (post-Phase-2B), including two automated checks (a Node script walking every glossary anchor against real heading ids, and a live curl of the running dev server's rendered HTML) rather than re-stating Phase 2A's or Phase 2B's own claims. `docs/seo-phase2a-architecture-analysis.md` is used as the baseline for comparison in §7, not as a source of truth.

**Headline finding**: Phase 2B did what it set out to do — real, contextual, working links now exist where Phase 2A found plain text. But independent verification also surfaced two things neither prior phase caught: **three same-destination duplicate links now appear within single paragraphs** (§3), and **a pre-existing, unrelated glossary anchor (`super-compensation`) is broken and was live on `the-aerobic-base` before Phase 2B ever started** (§4).

---

## 1. New internal-link graph

Verified via a combination of static grep (literal `href` strings in `glossary.ts`/`coaches/data.ts`), phrase-based search matching `section-linkify.tsx`'s actual `"X in Y"` matching logic (not just literal href substrings — see the methodology note below), and live rendering against the running dev server.

**Methodology note, stated explicitly because it changed my own results mid-audit**: a first pass searched for literal href substrings (e.g. `/recovery`) across `sections.ts`. That undercounts real connections, because `section-linkify.tsx` cross-references are written as plain English (`"see X in Y"`) and turned into hrefs only at render time — there is no literal `/recovery` string in the source for those. A second, corrected pass searched for the actual phrase pattern (`in <Section Title>`) sections.ts uses. The numbers below are from the corrected pass; anywhere Phase 2A's or Phase 2B's own framing undercounted a page's real connectivity because of this, it's flagged.

### Confirmed working (rendered, live-checked)

| Connection | Mechanism | Status |
|---|---|---|
| `training-philosophy` → `/coaching-library` | New sentence + `Link` in `training-philosophy-page.tsx` | ✅ Live-confirmed, renders once, correct anchor text |
| `the-philosophy-of-running`, `exercise-physiology` → `/athlete-library/peter-snell` | New glossary entry `peter-snell` | ✅ Live-confirmed on both pages (first-occurrence-per-page correctly applied) |
| `exercise-physiology`, `workout-library` (×2 dead phrases) → `/coaching-library/vigil`, `/coaching-library/norwegian-system` | Repaired glossary anchors (`altitude-training`, `norwegian-threshold-training`, `double-threshold`) | ✅ Live-confirmed rendering to real coach pages, not dead anchors |
| `how-to-start-running` → `/training-plans` | New whole-page glossary entry | ✅ Live-confirmed |
| `workout-library` → `/coaching-library/daniels`, `/coaching-library/canova` | Repaired/new glossary entries (`vdot`, `renato-canova`) | ✅ Confirmed via source; both are real, valid routes |
| Lydiard, Vigil, Tom Schwartz, Pfitzinger, Norwegian System coach pages → `training-philosophy`/`marathon-training`/`recovery`/`workout-library`/`tinman-calculator`/`data-and-analytics` | New `crossLinks` entries | ✅ All 11 new hrefs verified as real, existing routes (§4 methodology) |

**These are genuine contextual connections, not merely technically valid ones.** Every new link sits inside a sentence that is *already about* the linked target — e.g. "Peter Snell" is linked inside a sentence narrating his own Olympic double, not bolted onto an unrelated sentence for the sake of having a link. I did not find a single Phase 2B link that reads as inserted-for-SEO rather than inserted-because-the-prose-was-already-there.

### Still disconnected (verified, not fixed — correctly out of scope)

- `marathon-training` / `5k-training` → `/training-plans`: **not resolved**. Neither page's prose contains the word "Training Plans" as a page reference; the new glossary entry can only fire where the phrase already exists (currently just `how-to-start-running`). Phase 2B correctly declined to invent a sentence here.
- Life-stage content inside `recovery` (menstrual cycle, pregnancy/postpartum, Training Through the Decades): **not resolved** — see §6.
- `/coaching-library/pfitzinger` and Daniels-as-named-prose-subject: **partially resolved**. Pfitzinger gained an *outbound* crossLink to `marathon-training` (real win), but still has **zero inbound** contextual links from `sections.ts`, because no sentence anywhere names him. Not a Phase 2B miss — there's genuinely nothing to link from.
- `Deena Kastor`, `Moses Mosop`, `Jakob Ingebrigtsen`: **not resolved**, correctly — zero narrative-prose mentions exist anywhere in `sections.ts` (Kastor and Ingebrigtsen appear only inside a non-prose UI `topics` tag array, which `ContentBlocks` never renders through `linkifyContent`).

---

## 2. The two linking systems — partially resolved, correctly so

Phase 2A's finding: `glossary.ts`/`linkify.tsx` (covers `sections.ts` prose) and the Coaching/Athlete Library's own `crossLinks`/`coachSlug` arrays never intersected.

**Current status: partially resolved, and this is the architecturally correct outcome, not a shortfall.** Phase 2B did not build a new system (which would have been the wrong move — Phase 2A's own recommendation was explicitly to "extend `glossary.ts`, not build a new system"). It added 7 new glossary entries that manually bridge specific, verified prose mentions to real Coaching/Athlete Library URLs, and added 11 new `crossLinks` entries that manually bridge specific coach pages back to specific training-concept pages. Both directions of the bridge are now real. What's still true:

- **The two systems remain structurally separate code** — `glossary.ts` still has no awareness of `coaches/data.ts`, and vice versa. A new coach or a new prose mention of an existing coach requires a manual glossary entry going forward; nothing auto-discovers this. That's an accepted, deliberate tradeoff (curation over automation is the site's own stated design principle), not a defect.
- **The bridge is only as complete as the underlying content.** Where a coach is never named in `sections.ts` prose (Pfitzinger) or named only in a bibliography citation (Daniels), no bridge is possible without inventing a sentence — correctly not done.
- **The remaining disconnection is a content-coverage gap, not an architecture gap.** If Brody later writes a sentence in `marathon-training` naming Pfitzinger's medium-long-run approach, or writes anything in prose naming Deena Kastor, a mechanical follow-up (one glossary entry each) would resolve it in minutes — the *mechanism* to bridge them already exists and works.

**Verdict: Partially resolved.** Fully resolving it in the sense of "every named coach/athlete anywhere in prose links to their real page" is blocked on content, not code.

---

## 3. Over-linking audit — three confirmed issues, all pre-existing-generic-term collisions

Phase 2B's individual link choices were each independently justified (§1). But two *pairs* of glossary entries, evaluated together, now point at the same destination and both fire on the same page — in two cases, the same sentence. Confirmed by inspecting rendered HTML from the live dev server, not just source:

**1. `workout-library`, one sentence (source line ~1565):**
> "**Altitude training** compounds well with a threshold-heavy program... See **Joe Vigil: Altitude, Biomechanics, and the Whole Athlete** in Coaching Library for the standard six-to-twelve-week adaptation window..."

Both `<a>` tags resolve to `/coaching-library/vigil`. Confirmed via rendered HTML:
```html
...href="/coaching-library/vigil">Altitude training</a> compounds well...
...href="/coaching-library/vigil">Joe Vigil: Altitude, Biomechanics, and the Whole Athlete</a> in Coaching Library...
```
Root cause: `altitude-training` (a pre-existing generic-concept term, repaired by Phase 2B to point at a real page for the first time) and `joe-vigil` (a new Phase 2B entry) happen to share a destination. Neither entry is wrong on its own — but together, in this one sentence, they read as redundant, and a search engine sees two links with different anchor text pointing to the identical URL in the same block of prose, which dilutes rather than reinforces the anchor-text signal.

**2. `workout-library`, one sentence (source line ~1516):**
> "A **double threshold** day pairs two controlled interval sessions... and **Norwegian Threshold Training** in Coaching Library for where the format comes from."

Both resolve to `/coaching-library/norwegian-system`. Same root cause: `double-threshold` (repaired) and `norwegian-threshold-training` (repaired) are two different, legitimately-distinct-sounding glossary terms that happen to point at the same coach page.

**3. `research-library`, same page, two different blocks (source lines 661 and 676 — a body paragraph and a separate "Key Takeaways" callout item):**
Same `double-threshold` / `norwegian-threshold-training` pair, both resolving to `/coaching-library/norwegian-system`. Lower severity than #1/#2 (different blocks, not the same sentence), but still two links to the same destination on one page.

**Why the existing dedup logic didn't catch this**: `linkify.tsx`'s `linkedTermIds` Set prevents the *same term id* from linking twice on one page — and that protection works correctly (verified: no case anywhere of one term id firing twice). It does not, and was never designed to, dedupe by destination URL across *different* term ids. Two conceptually-distinct phrases that happen to share a target page are invisible to that guard.

**Not found, checked for specifically and ruled out:**
- No coach linked while merely cited bibliographically (Jack Daniels was deliberately excluded from the glossary for exactly this reason — verified still excluded).
- No link that reads as SEO-only rather than reader-useful — every new link sits in a sentence already about its target.
- No link competing with an existing glossary definition (the coach-name entries and concept entries are legitimately different definitions; the issue is shared destination, not duplicated meaning).
- No genuinely circular relationship (Lydiard's own `crossLinks` → `training-philosophy`, and `training-philosophy` → the `/coaching-library` *index*, not back to `/coaching-library/lydiard` specifically — a one-way loop through a hub page, not a tight redundant circle).

**If reconsidered** (not done — read-only phase): the cleanest fix for all three findings is the same pattern already used correctly elsewhere in `glossary.ts` for Canova and Vigil's own dual-alias entries — merge `altitude-training` into `joe-vigil`'s alias list (and `double-threshold` into `norwegian-threshold-training`'s), rather than keeping four separate term ids that resolve to two destinations. This is a glossary-file consolidation, not a content decision — see §8.A.

---

## 4. Broken internal links

An automated check (walking every `glossary.ts` entry's anchor against every real heading id in the target section, using the site's own `headingId()` function) plus a manual check of every `crossLinks`/glossary literal href against real routes.

### Confirmed broken

| Term | Href | Issue |
|---|---|---|
| `periodization` | `/coaching-library#the-pyramid` | No such anchor exists — `coaching-library` is a bespoke `ToolComponent` page (`CoachingLibraryHome`) with zero `id=` attributes anywhere in its source. **Pre-existing, flagged (not fixed) by Phase 2B.** |
| `eighty-twenty` | `/coaching-library#polarized-training-80-20-the-one-i-lean-on-most` | Same cause. **Pre-existing, flagged (not fixed) by Phase 2B.** |
| `super-compensation` | `/training-philosophy#why-response-regulated-recovery-actually-works` | No such anchor exists — `training-philosophy` is also a bespoke `ToolComponent` (`TrainingPhilosophyPage`) whose four real headings ("Many Systems, One Destination," "The Beliefs Underneath Every Workout," "From Belief to Race Day," "Six Ideas, Distilled") don't include this text anywhere. **Newly discovered in this phase — pre-existing, unrelated to Phase 2B, and currently live**: the term fires today on `the-aerobic-base` ("That's super-compensation, and it's the whole mechanism behind why training works...") and sends a reader to `/training-philosophy` with no scroll, landing at the top of the page instead of the promised explanation. |

All three share one root cause: at some point each target page moved from a `sections.ts`-driven `content` array (with real headings `section-linkify`/glossary could anchor to) to a bespoke `ToolComponent` (no headings tracked by the same mechanism), and the glossary entries pointing at their old anchors were never updated. This is worth naming as a pattern, not just three isolated typos: **any future page migrated from content-array to bespoke component needs its own glossary-anchor audit**, since nothing currently catches this automatically (confirmed: `npx tsc`, `eslint`, and `vitest run` all pass today despite these three broken anchors — none of the existing test coverage checks glossary hrefs against real anchors).

### Confirmed NOT broken (re-verified, not assumed)

- All `/coaching-library/[coach]` and `/athlete-library/[athlete]` hrefs in `glossary.ts` and `coaches/data.ts`: verified against real `slug` values in both data files — all valid.
- All 14 unique `crossLinks` hrefs across all 7 coaches: verified against real `sections.ts` slugs and real tool routes (`/cv-threshold-calculator`, `/tinman-calculator`, `/pace-percent-calculator`) — all valid, all live-return 200.
- No dangling `/training-plans/[plan]` references anywhere outside `training-plans/data.ts` itself (every plan link is generated dynamically from the data file, so there's no drift risk).
- No stale references to Kastor/Mosop/Ingebrigtsen athlete slugs anywhere with a typo or wrong path.

### Ambiguous / requires editorial judgment (not broken, not touched)

- None found this pass. Every href that resolves to a real route was judged either clearly correct or clearly a duplicate-destination concern (§3), not an ambiguous case needing Brody's call.

---

## 5. Pacing-tool cluster — Phase 2B did not touch it; independently found to be better-connected than Phase 2A's framing suggested

Phase 2B's scope explicitly excluded this cluster. Verified current state directly from each calculator component's own "related tools" links (a pre-existing pattern, not part of `sections.ts`/glossary at all):

| Tool | Links out to | Notes |
|---|---|---|
| Pace & HR (`pace-calculator`) | GAP, Pace Percent, Race Pace, HR Threshold + (via `FitnessModelComparisonNote`) CV-Threshold, Tinman | 6 outbound |
| CV-Threshold | Pace Percent, Race Pace, HR Threshold + (via note) Pace & HR, Tinman | 5 outbound |
| Tinman | Race Pace + (via note) Pace & HR, CV-Threshold | 3 outbound |
| Race Pace | CV-Threshold, Pace Percent, Pace & HR, Tinman | 4 outbound — the best-connected single node in the cluster |
| Pace Percent | CV-Threshold, Race Pace | 2 outbound |
| **Marathon Pacing** | CV-Threshold only (×2, same page) | 1 outbound, **zero inbound** from any sibling tool, `sections.ts`, glossary, or coach `crossLinks` |

**This is a more connected cluster than Phase 2A's "largely competing destinations" framing implied for five of the six tools.** `FitnessModelComparisonNote` (rendered on Pace & HR, CV-Threshold, and Tinman) provides real editorial differentiation — it names the other two tools' actual methods and states outright that disagreement between them is expected, not a bug. Race Pace, Pace Percent, and CV-Threshold each also carry their own "related tools" footer independent of that component.

**What's still true, and matches Phase 2A's core point**: this differentiation lives in shared UI components on three-to-five separate URLs, not as a single page a search engine can rank for the broad "which pace calculator should I use" query — the ranking-authority-split problem Phase 2A flagged is architecturally unchanged. **Marathon Pacing Calculator is the one genuine weak link** in this cluster: it's reachable but contributes nothing to and receives nothing from the rest of the cluster's cross-linking, a real, freshly-identified gap Phase 2A didn't call out by name.

Per the task's instruction, this phase does not propose a fix to the cannibalization question itself — only reports connectivity as it stands.

---

## 6. Life-stage content discoverability — still buried, confirmed with complete evidence this time

Re-ran the check Phase 2B did, but exhaustively this time: every phrase-based inbound reference to `recovery` anywhere in `sections.ts` (9 total, from `exercise-physiology`, `nutrition-and-fueling` ×3, `workout-library`, `strength-training` ×3, `resources`), not just a keyword grep for "menstrual"/"pregnan"/"postpartum"/"decades".

**Result: all 9 existing inbound references into `recovery` point at RED-S or the muscle-tone/strength-scheduling headings. Zero of them point at, or are anywhere near, "Training Across the Menstrual Cycle," "Pregnancy and Postpartum Running," or "Training Through the Decades."** This confirms Phase 2A's finding precisely, with more complete evidence than either prior phase gathered: `recovery` as a whole page is actually well-linked (9 real inbound contextual references, not weak), but that link equity flows specifically to RED-S and recovery-scheduling content — the three life-stage headings receive none of it.

**Legitimate existing entry points that could link to these topics, if a natural sentence already existed**: none found. I specifically checked `sports-psychology`'s Lorraine Moller passage ("she ran her fourth and final Olympics at 41... two decades of declining to stop") as a candidate — it's the only place on the site that discusses an athlete's competitive longevity into her 40s. On inspection, its actual point is psychological/persistence-focused, not about the physiological training adjustments "Training Through the Decades" covers; forcing a link there would connect two different ideas under a shared surface-level keyword ("decades"), not a genuine topical match. I'm stating this explicitly rather than silently deciding it either way: **no natural entry point currently exists for any of the three life-stage topics**, and per the task's own instruction, I'm not recommending a sentence be invented to create one.

---

## 7. Phase 2A vs. current state

| Phase 2A finding | Current status | Resolved? | Evidence |
|---|---|---|---|
| Two good linking systems don't talk to each other | Manually bridged in 7 glossary entries + 11 crossLinks, in both directions | **Partially** | §1, §2 — bridge works where content exists; Pfitzinger/Daniels/Kastor/Mosop/Ingebrigtsen still unbridgeable without new prose |
| `training-philosophy` doesn't link into Coaching Library | Fixed | **Yes** | §1 — live-rendered, confirmed |
| Training-concept pages rarely link back to the coach whose philosophy they describe | Fixed for Lydiard/Vigil/Norwegian System/Tom Schwartz/Pfitzinger dead-anchor phrases | **Partially** | §1 — the specific dead phrases Phase 2A implicitly relied on now resolve; pages that never named a coach still don't link to one (correctly) |
| Life-stage content in `recovery` is discoverability-buried | Unchanged | **No** | §6 — exhaustively re-confirmed, zero inbound links to the specific headings, no natural entry point exists elsewhere |
| Individual Training Plan pages are leaf nodes with weak inbound linking | Unchanged for the 10 individual plans; the `/training-plans` index itself gained inbound links (coach crossLinks + glossary) | **Partially** | §1, §4 (orphan section below) — index improved, leaf pages untouched (no prose names a specific plan) |
| Pace & HR / CV-Threshold / Tinman: real overlap, ranking-authority problem unsolved | Unchanged — out of scope for Phase 2B by design | **No** (not attempted) | §5 |
| Athlete Library entries (Snell's Waiatarua Circuit, Kastor, Mosop) under-linked from training-concept pages | Snell: fixed. Kastor/Mosop: unchanged | **Partially** | §1 — Snell now has 2 genuine inbound prose links; Kastor/Mosop still have zero, correctly (no prose names them) |
| `marathon-training`/`5k-training` don't link to Training Plans | Unchanged | **No** | §1 — no natural sentence exists on either page; Phase 2B correctly declined to invent one |
| Marathon Training / Workout Library / Training Plans correctly differentiated, not cannibalizing | Unchanged, re-confirmed | **N/A — was already fine** | Not re-litigated this phase; no new evidence contradicts it |
| `/coaching-library` is close to a pillar without knowing it (comparison tooling exists, prose case not yet made) | Unchanged — explicitly out of scope for Phase 2B and this phase | **No** (not attempted) | Editorial decision, not mechanical |

**New findings this phase that Phase 2A did not surface:**
- Three same-destination duplicate links introduced by combining two independently-reasonable Phase 2B glossary decisions (§3).
- A third, pre-existing, currently-live broken glossary anchor (`super-compensation`) unrelated to anything Phase 2B touched (§4).
- The pacing-tool cluster is more connected than Phase 2A's language implied for 5 of 6 tools, with Marathon Pacing Calculator as the one genuinely isolated node (§5).
- `trail-and-ultra-training` has zero phrase-based inbound contextual links from anywhere else in `sections.ts` — a real near-orphan Phase 2A's own analysis didn't call out explicitly (§8 below).

---

## 8. Internal-link equity — qualitative classification

Based on contextual/editorial inbound links only (nav, category grids, and the sitemap provide baseline reachability for every page regardless of this classification, and aren't double-counted here — see the caveat under "Near-orphan" below).

**Strongly connected:**
- `workout-library` — 11 phrase-based inbound references from other sections, the site's densest single hub.
- `recovery` (as a whole page) — 9 inbound references, though see §6 for why this doesn't extend to three of its own headings.
- The Coaching Library's internal self-graph (21 `coachSlug` cross-references across `crossLinks`/`otherCoachesCritique`/`relatedPhilosophies`) — unchanged from Phase 2A, still dense.

**Well connected:**
- `nutrition-and-fueling` (5 inbound), `marathon-training` (4, plus new Pfitzinger/Lydiard crossLinks), `5k-training` (4 — corrected upward from an earlier flawed href-substring check that read 0), `the-aerobic-base` (3, plus dense glossary concept-anchors).
- `/coaching-library/vigil`, `/coaching-library/norwegian-system` (3 contextual inbound each, plus their own dense outbound crossLinks and Athlete Library ties).
- `training-philosophy` — gained a real outbound link this phase; already had 3 inbound whole-page references.

**Moderately connected:**
- `research-library`, `data-and-analytics` (2 phrase-based inbound each — genuinely useful pages, just not prose hubs).
- `/coaching-library/lydiard`, `/coaching-library/canova` (2 contextual inbound each, very dense own outbound crossLinks and notableAthletes/critique network).
- `/coaching-library/daniels`, `/coaching-library/tom-schwartz` (1 contextual inbound each via `vdot`/coach-name glossary entries, solid own outbound links including a dedicated calculator each).
- `athlete-library/peter-snell` — moved here this phase from near-orphan (1 new glossary inbound + 3 real narrative mentions + a full case study inside Lydiard's own page).
- `strength-training` (1 inbound) — real but thin.
- `/training-plans` (index) — meaningfully improved via 5+ coach crossLinks and the new glossary entry, though still index-level, not plan-level.

**Weakly connected:**
- `/coaching-library` (index) — 1 new contextual inbound (from `training-philosophy`); relies mostly on nav/category-grid reachability, appropriate for an index page per the task's own "not every page needs many links" caveat, but weaker than the individual coach pages it hosts.
- Pace Percent Calculator, Marathon Pacing Calculator's one-way relationship to CV-Threshold — connected to the cluster but not from it.

**Near-orphan** (technically reachable via nav/category grid/sitemap, essentially zero contextual/editorial inbound links):
- `/athlete-library` (index) — 0 contextual inbound found anywhere.
- `deena-kastor`, `moses-mosop`, `jakob-ingebrigtsen` — 0 contextual inbound each; only reachable via the index and their own coach's `notableAthletes` array (same-library, not cross-system).
- `/coaching-library/pfitzinger` — 0 contextual inbound from `sections.ts` (gained an outbound link this phase, but nothing points to it).
- `trail-and-ultra-training` — 0 phrase-based inbound references anywhere in `sections.ts`, and no glossary entry targets it either.
- The 10 individual Training Plan pages — 0 direct inbound links from any prose; only reachable via the `/training-plans` index itself.
- **Marathon Pacing Calculator** — 0 inbound from any sibling tool, `sections.ts`, or coach `crossLinks`.

**A page belonging in "near-orphan" is not automatically a problem.** An index page (`/coaching-library`, `/athlete-library`, `/training-plans`) legitimately draws most of its equity from navigation rather than prose — that's the correct pattern for a directory-style page, and Phase 2A's own §5 makes the same point about category landing pages. The genuine concerns in this list are the individual leaf pages that have real, substantive, citable content and still get nothing: Kastor/Mosop/Ingebrigtsen's case studies, Pfitzinger's marathon-specific system, `trail-and-ultra-training`'s real depth (confirmed by Phase 2A §10 to be substantively covered), and each individual training plan.

---

## 9. Final recommendations

### A. Mechanical (Claude Code can implement later without editorial judgment)

1. **Consolidate the two duplicate-destination glossary pairs** (§3): merge `altitude-training`'s alias into `joe-vigil`'s entry, and `double-threshold`'s alias into `norwegian-threshold-training`'s entry — the same one-term-multiple-aliases pattern already used correctly for Canova and Vigil's own dual-phrase entries. Removes 2 term ids, keeps all existing link coverage, eliminates all 3 same-page duplicate-destination instances found in §3.
2. **Fix the `super-compensation` broken anchor** (§4): either point it at a real heading inside `training-philosophy-page.tsx` (none currently match "response-regulated recovery" — would need Brody to confirm which of the 4 real headings, if any, is the right target) or repoint it to `the-aerobic-base`'s own supercompensation content, where the term is actually defined in the live prose already (it's currently linking *away from* the page that actually explains it). This second option may cross into a content/editorial call rather than a pure mechanical fix — flagging both options rather than picking one.
3. **A repeatable automated check**: the Node script used in §4 (walk every glossary anchor against real heading ids per target section) caught a bug neither Phase 2A nor Phase 2B found. Worth adding as a real test in `tests/lib/` (there's already `section-linkify.test.ts` as a natural neighbor) so a future broken anchor fails CI-equivalent validation instead of silently degrading.

### B. Editorial (Brody's decision)

1. Whether `super-compensation` should point at `the-aerobic-base` (where the concept is actually explained) or a new/different anchor on `training-philosophy` — a content-ownership question, not just a broken-link fix.
2. Whether the `/coaching-library/pfitzinger`, Athlete Library, and `trail-and-ultra-training` near-orphan findings (§8) are worth a future, narrowly-scoped Phase 2D specifically to add sentences naming them where genuinely relevant — versus leaving them as they are. Everything already flagged in Phase 2A's own B/C roadmap (race-pace pillar, coaching-library pillar treatment, polarized-training pillar, life-stage restructuring, pace/CV/Tinman cannibalization, altitude content, return-to-running content) remains untouched and unrecommended-on by this phase, per the task's explicit instruction.

### C. Content (requires creating or substantially rewriting content)

1. Marathon Pacing Calculator's isolation from the rest of the pacing cluster (§5) could be addressed with a "related tools" footer matching the pattern the other five tools already use — this is more a content/UI-copy decision (what to say about the relationship) than a mechanical one, since it should probably explain *why* Marathon Pacing is different (a mile-cost/environmental model, not a fitness-prediction model) rather than just adding bare links.
2. Individual Training Plan pages and Kastor/Mosop/Ingebrigtsen's case studies remain unlinked because no existing sentence names them — the only way to genuinely fix this (not just technically fix it) is new prose that already exists for a real editorial reason (e.g., if `marathon-training` is ever revised and happens to want a concrete case study, Kastor/Mosop are the natural citation) — not a linking task on its own.

Nothing above should be read as new instructions — per the task's constraints, this phase does not implement any of it, including the Mechanical items.

---

**Phase 2C complete — verification only; no files modified.**
