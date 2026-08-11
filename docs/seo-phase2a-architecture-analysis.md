# The Haarchive — Phase 2A: SEO Architecture & Topical Authority Analysis

Status: **read-only analysis. No application files were modified to produce this document.** Every claim below was verified directly against the current codebase as of this writing (line-cited where useful). `docs/seo-audit.md` is used as historical context only — three of its specific findings are corrected below based on what's actually in `sections.ts` today, not what it said before.

**The single most important finding of this pass**: the prior audit's three "confirmed content gaps" — trail/ultra running, pregnancy/postpartum running, and masters/aging running — are **all three already covered**, in real, well-cited depth, not stubs. This isn't a guess or a partial credit; the actual prose is quoted below. The likely explanation: this is exactly the material the podcast-synthesis effort (`docs/podcast-synthesis/synthesis-map.md`) flagged as "digested from a credentialed source, not yet written up" (Karen Rueff on pregnancy, Carmen Troncoso on masters physiology, Jason Koop on ultra) — it appears that write-up happened at some point after the SEO audit was drafted. This is the clearest possible demonstration of why this phase re-verifies everything instead of trusting the prior document.

---

## 1. Current content map

44 total entries in `sections.ts` (8 categories + 36 sections/tools), verified via direct line-numbered extraction, not estimated:

| Category | Sections |
|---|---|
| **Getting Started** | `how-to-start-running` |
| **Foundations** | `training-philosophy`, `the-philosophy-of-running` |
| **The Science** | `exercise-physiology`, `the-aerobic-base`, `research-library`, `data-and-analytics` |
| **Coaching & Training** | `coaching-library`, `athlete-library`, `marathon-training`, `workout-library`, `trail-and-ultra-training`, `strength-training`, `5k-training`, `training-plans` |
| **Recovery & Fueling** | `nutrition-and-fueling`, `recovery` |
| **Mental Performance** | `sports-psychology`, `goal-setting`, `self-talk`, `daily-practice`, `performing-under-pressure`, `for-coaches` |
| **Writing & Resources** | `articles`, `resources`, `contact` |
| **Tools** | `heat-tracker`, `pace-calculator`, `environmental-calculator`, `gap-calculator`, `pace-percent-calculator`, `cv-threshold-calculator`, `race-pace-calculator`, `hr-threshold-calculator`, `tinman-calculator`, `marathon-pacing-calculator` |

Plus, outside `sections.ts`: 7 Coaching Library pages (`coaches/data.ts`), 4 Athlete Library pages (`athletes/data.ts`), 10 Training Plan pages (`training-plans/data.ts`), an unknown-but-real number of database-backed Articles (published-status articles, discovered dynamically — not a fixed count in code, not guessed here), and the Questions system (community-submitted, admin-answered, some flagged as FAQ).

**Topical relationships determined from actual content, not navigation labels** — three real groupings emerged that don't map 1:1 onto the category structure:
- **The "life-stage and life-circumstance" cluster** (menstrual cycle, RED-S, pregnancy/postpartum, aging) all lives inside one page — `recovery` — not spread across dedicated pages. This is a real finding: strong content, weak discoverability, addressed in §7 below.
- **The pacing-methodology cluster** (Pace & HR, CV-Threshold, Tinman, Race Pace, Pace Percent, Marathon Pacing) spans 6 of the 10 Tools pages plus supporting prose in `data-and-analytics` and `research-library` — the site's single densest technical cluster.
- **The coaching-history/technique cluster** added by this session's own Lydiard synthesis work (technique/footwear content now in `workout-library`, biography now in `the-philosophy-of-running`) doesn't have its own category home and is spread across three different pages by design (matches existing content, not miscategorized — see §5).

---

## 2. Search-intent map

Primary intent each major page should own (one each, per the instruction) — classified from actual content, no invented search-volume data:

| Page | Primary intent | Notes |
|---|---|---|
| `how-to-start-running` | **How-to** | Beginner progression, concrete week-by-week |
| `the-philosophy-of-running` | **Informational** (narrative/editorial) | Vignettes, not instructions |
| `exercise-physiology` | **Reference/Informational** | Mechanism-first explainer |
| `the-aerobic-base` | **Informational**, leaning **Research** | Adaptation timeline + real study citations |
| `research-library` | **Research** | Explicitly a study-summary page |
| `data-and-analytics` | **Reference/How-to** | "How to use HR/pace data," zone tables |
| `coaching-library` (index) | **Comparative** | The comparison table is the actual content, not a list |
| Individual coach pages | **Profile/entity** + **Comparative** | Both at once — see §7 |
| `athlete-library` (index) + individual pages | **Profile/entity** | Case-study framing, not biography |
| `marathon-training` | **How-to** | Session-by-session prescriptive |
| `workout-library` | **Reference** | Named, categorized workout catalog |
| `trail-and-ultra-training` | **How-to** | Effort-based training + race-day specifics |
| `strength-training` | **How-to** | Concrete protocol |
| `5k-training` | **How-to** | Season/week structure for a specific distance |
| `training-plans` (index + 10 plans) | **Training plan** | Its own distinct intent type, correctly separate from "how-to" prose |
| `nutrition-and-fueling` | **Reference/How-to** | Numbers-forward (g/h, ratios) |
| `recovery` | **Reference**, fragmenting into several distinct sub-intents — see §7 | |
| `sports-psychology` + siblings | **Informational** | Concept explainers with frameworks |
| `for-coaches` | **How-to**, audience-shifted (coach, not athlete) | |
| Tools (calculators) | **Tool/calculator** | Each answers "compute X for me" |
| Individual articles | **Informational** (essay register) | See §9 for overlap risk |
| Questions | **Community/question** | Long-tail, see §9 |
| `/faq` | **Reference** | Short-answer format |

---

## 3. Keyword cannibalization analysis

### Pace & HR / CV-Threshold / Tinman — re-verified independently, not assumed

**Confirmed real overlap, but already partially mitigated on-page.** All three answer a version of "predict my training paces from one recent race result," confirmed from their actual `mission` text:
- Pace & HR: *"Understand what your race result says about your fitness, where your training zones fall, and how your current ability translates across distances."*
- CV-Threshold: *"Predict threshold, critical velocity, and VO2 max training paces (with uncertainty ranges, not just one number) from a single 800m-10K performance."*
- Tinman: *"...a performance rating, 30 equivalent race predictions, and paces for all 13 training zones from one recent race."*

These are genuinely the same core question, answered by three different models (Riegel's formula, a statistical fit, and an independently reverse-engineered fatigue curve). **What's already handled**: `src/components/fitness-model-comparison-note.tsx` is rendered on all three pages, explicitly naming the other two tools, explaining the method each uses, and stating outright that disagreement between them "is not a bug in either one." This is a real, already-shipped answer to *user* confusion.

**What's not handled, and is a distinct problem from user confusion**: three separate URLs, three separate `<title>`s, three separate pages all plausibly ranking for the same or adjacent queries in Google is a *ranking-authority* problem, not a UX problem — the comparison note doesn't change how a search engine evaluates three competing pages. **Verdict: HIGH, not Critical.** Real and worth addressing eventually, but not urgent, because the on-page mitigation means it isn't actively confusing or misleading anyone today. **Which page should own the broader intent**: none of the three cleanly should — they're genuinely different models, not a primary/detail relationship. This argues for a pillar that ranks for the broad query and routes to all three with the model-selection framing already written in `fitness-model-comparison-note.tsx`, rather than picking a winner (see §4).

### Aerobic base / polarized training

`the-aerobic-base` and `research-library` both cover polarized training with real overlap: `the-aerobic-base` covers it from an adaptation/physiology angle (capillary/mitochondrial growth, the 60,000-mile-network framing), `research-library` covers it from a *research-evidence* angle (Seiler's actual studies, the Bossi periodization-order study, the NTNU double-threshold study). **Verdict: MEDIUM, not a real problem.** This reads as intentional and correct division of labor (mechanism page vs. evidence page) rather than duplication — each page cites *different* specific studies and makes a distinct point. It's still worth linking them more explicitly to each other and to a shared pillar (see §4), since a reader landing on either one via search has no obvious signal that the other half of the story lives on a sibling page.

### Marathon training / workout library / training plans

Confirmed **not a cannibalization problem**. `marathon-training` is prescriptive advice (how to structure a buildup), `workout-library` is a reference catalog (named, reusable sessions), `training-plans` is literal day-by-day plans. These are three different intent types (how-to / reference / training-plan) answering the same broad topic from genuinely different angles, and `marathon-training` already cross-links into `workout-library` for specific sessions rather than duplicating them (confirmed in its own prose, e.g. its "Norwegian Threshold Training" and "Advanced Periodization" cross-references). **Verdict: Not actually a problem.**

### 5K training / workout library / strength training

Confirmed **not a cannibalization problem**, same reasoning — `5k-training` cites `workout-library` and `strength-training` rather than re-explaining their content (its own "Strength Is Part of the Program" heading points to `strength-training` for the actual mechanism rather than repeating it). **Verdict: Not actually a problem.**

### Coaching philosophy / Training philosophy

Real, but narrow, overlap: `training-philosophy` is now a small, distinct rendered page (its own `ToolComponent`, per its `sections.ts` comment) about *belief systems in general* — individualization, long-term development, decision frameworks. The Coaching Library is about *specific named coaches'* belief systems. These answer different intents (general framework vs. comparative/entity) and shouldn't be merged — but `training-philosophy` doesn't currently link into the Coaching Library at all despite being the obvious conceptual on-ramp to it. **Verdict: LOW as cannibalization, but a real missed internal-link opportunity** (see §6).

### Recovery / Nutrition

Confirmed **not a cannibalization problem** — `recovery`'s RED-S coverage and `nutrition-and-fueling`'s energy-availability content already cross-reference each other explicitly (`nutrition-and-fueling` links to `recovery` for RED-S three separate times, confirmed in Phase 1's own findings). This is a model example of how the site *should* handle a topic that legitimately touches two pages.

---

## 4. Pillar opportunities

The three previously-suggested candidates, re-evaluated, plus independently-identified alternatives.

### 1. Polarized / Aerobic-Base Training — CONFIRM as a pillar candidate
- **Search intent**: informational, broad ("polarized training," "80/20 running," "how much easy running should I do")
- **Existing support**: `the-aerobic-base`, `research-library`'s Seiler material, `data-and-analytics`'s zone content, indirectly the whole Coaching Library (several coaches' philosophies are explicitly polarized-training-adjacent)
- **Why it deserves a pillar**: this is the single most research-dense, most differentiated cluster on the site, and it's currently split across two pages with no page asserting "here is the Haarchive's complete position on this," which is exactly the gap a search engine (and a serious reader) rewards
- **Can it mostly synthesize existing material?** Yes — nearly entirely. This would be a genuinely low-content-risk pillar to build.
- **What's genuinely new**: an editorial through-line connecting mechanism → evidence → how a reader should actually apply it, which doesn't currently exist as one coherent argument anywhere

### 2. Choosing a Coaching Philosophy — CONFIRM as a pillar candidate, with a specific caveat
- **Search intent**: comparative ("which running coaching method is right for me")
- **Existing support**: the comparison table, timeline, genealogy diagram, and genome-compare tooling already built for the Coaching Library (`coach-comparison-table.tsx`, `coaching-timeline.tsx`, `coach-genome-compare.tsx`, `family-tree.tsx`) — real, structured comparison infrastructure already exists
- **Why it deserves a pillar**: per §7 below, the Coaching Library's *index* page is already close to this, but it's rendered by a directory-style home component, not framed as an answer to "which philosophy should I pick" — see §5's distinction between index and pillar
- **Caveat**: this may not need a *new* page at all — see §5's recommendation to strengthen `/coaching-library` itself rather than add a URL
- **What's genuinely new**: very little — this is close to a re-framing exercise on top of existing components, not new content

### 3. Marathon Training — DOWNGRADE from the original three
On closer inspection, `marathon-training` is already a strong, focused how-to page with a clean relationship to `workout-library` and `training-plans` (§3 above). It doesn't show the same "split across multiple competing pages with no unifying page" pattern that makes the other candidates genuinely need a pillar. **Recommendation: don't prioritize this one** — it's already functioning close to pillar-like on its own, just under a section-page template rather than a dedicated pillar treatment. Revisit only if the polarized-training and coaching-philosophy pillars are built first and there's still appetite for a third.

### 4. Race-Pace Prediction / "Which Pace Calculator Should I Use" — NEW candidate, independently identified
- **Search intent**: comparative + tool
- **Existing support**: `fitness-model-comparison-note.tsx` already contains the exact editorial framing this pillar would need (three genuinely different models, here's when each one's approach matters), just not surfaced as its own destination
- **Why it deserves a pillar**: this is the most concrete, lowest-effort pillar opportunity on the entire site — the differentiating content is *already written*, just trapped in a shared component rendered small on three tool pages instead of being the actual subject of a page
- **What it would need**: expand the existing comparison note into a real page: when Riegel's formula is a fine approximation vs. when the statistical CV model's uncertainty ranges matter vs. when Tinman's fatigue-curve approach fits, plus links out to all three tools
- **Effort**: lowest of any candidate here — almost entirely synthesis of existing text

### 5. Life-Stage Training (menstrual cycle / RED-S / pregnancy & postpartum / masters) — NEW candidate, the most significant finding of this analysis
- **Search intent**: informational, several distinct sub-intents bundled (see the caveat below)
- **Existing support**: all of it — this content already exists, in depth, inside `recovery` (§1, §10)
- **Why it deserves consideration**: this is genuinely excellent, credentialed-feeling content (real citations: Mountjoy et al. 2014, Sims' *Roar*, McNulty et al. 2020, ACOG Committee Opinion No. 804, Attia's *Outlive*) that's almost certainly under-discovered because it's buried as the last four headings of a general `recovery` page, not because it doesn't exist
- **Important caveat**: pregnancy/postpartum running, training across the menstrual cycle, and masters/aging training are three genuinely different search intents and different audiences — bundling them into one pillar risks diluting all three rather than strengthening any of them. **This is not a single pillar candidate; it's three separate, smaller opportunities that share one structural problem (buried inside a general page).** Recommend evaluating whether each deserves its own dedicated section (a content/IA decision, not something to decide in this read-only pass) rather than force-fitting them into a single "life stages" pillar for its own sake.

---

## 5. Existing category pages: authority page, index, or weak hybrid?

Evaluated directly against their actual rendered structure (`[slug]/page.tsx`'s category branch — a title, mission, and a grid of member links, confirmed in code):

- **All 8 category landing pages (`the-science`, `coaching-and-training`, etc.) are navigation/index pages, not topical authority pages**, and this is fine — they're doing exactly the job a category page should do (help a reader find the right section), not trying to also be a pillar. No category page currently overreaches into pillar territory or underreaches into being a broken directory.
- **`/coaching-library` is the one page on the site closest to already being a pillar without knowing it** — it's not a plain link list, it renders a comparison table, timeline, and genome-compare tooling (`CoachingLibraryHome`), which is real comparative content, not navigation. **Recommendation: this is the strongest case anywhere on the site for "strengthen an existing page into a pillar without a new URL"** — it would need editorial framing/prose making the comparative case explicitly (the tables already do it visually; the page doesn't yet do it in words), not new infrastructure.
- **`/athlete-library`'s index is a plainer directory** than `/coaching-library`'s — no comparison table, just case studies grouped by coach. This is appropriate given the different intent (entity/reference, not comparative — see §8), not a weakness.
- **No category or index page should become a new pillar URL** — every genuine pillar candidate in §4 is either better served by strengthening `/coaching-library` (§4.2) or by a new page that doesn't have an obvious existing-page host (§4.1, §4.4). This directly satisfies the "don't create a new page when an existing one could serve the role" instruction for exactly one of the four pillar candidates; the other three don't have an existing page shaped correctly to absorb the role.

---

## 6. Internal linking architecture

**What `glossary.ts` + `linkify.tsx` + `section-linkify.tsx` already accomplish** (verified, not assumed — see `CLAUDE.md` §7 for the original technical documentation this session already produced): 62 curated glossary terms auto-link to their one real defining anchor on first mention; a separate regex layer auto-links any `"see X in Y"` phrase already written in prose against every section's own title and headings. This is a real, working, differentiated internal-linking system — most sites in this space have none of this.

**Its actual scope, verified**: it only runs inside `ContentBlocks`-rendered content (i.e., `sections.ts` prose). It does **not** reach the Coaching Library, Athlete Library, Training Plans, or Questions — each of those has its own bespoke template and does its own manual cross-linking (`crossLinks` arrays, `coachSlug` references, etc.), confirmed by direct inspection: 7 coaches each carry their own `crossLinks`/`relatedPhilosophies`/critique arrays (21 total `coachSlug` references across the library — real, dense interlinking, just a separate mechanism from the glossary system), and all 4 athlete pages carry `crossLinks` back to their coach. This is a genuine architectural finding: **two good linking systems that don't talk to each other**, not one system with gaps.

**Strongly connected clusters**: the Coaching Library (dense self-referential linking via `crossLinks`/`otherCoachesCritique`/`relatedPhilosophies`), the pacing-calculator cluster (via `fitness-model-comparison-note.tsx` plus direct links already documented elsewhere), nutrition/recovery (explicit RED-S cross-references both directions).

**Weakly connected / orphan risk**:
- `training-philosophy` doesn't link into the Coaching Library despite being its obvious conceptual predecessor (§3).
- The Coaching/Athlete Library linking system and the glossary/section-linkify system never intersect — a `sections.ts` page mentioning "Lydiard" or "polarized training" auto-links to a glossary anchor or a same-system section, never to the actual Coaching Library page for that coach or the research backing that concept. This is the single highest-leverage internal-linking finding in this analysis: dozens of prose mentions of named coaches and researchers across `sections.ts` are plain text today when they could resolve to real, already-existing pages.
- The newly-discovered life-stage content in `recovery` (§4.5) receives whatever inbound links `recovery` itself gets as one generic page — nothing points a reader specifically toward "pregnancy and postpartum running" or "training through the decades" from anywhere else on the site, because those headings didn't exist when the rest of the site's cross-references were written.
- Individual Training Plan pages (10 of them) appear to be leaf nodes — reachable from `/training-plans`, but not clearly linked *from* `marathon-training` or `5k-training`'s own prose even though those pages describe exactly the kind of structured plan the Training Plans feature provides.

**Pages that link out heavily but receive little back**: `marathon-training` and `workout-library` both link outward extensively (to each other, to `data-and-analytics`, to Recovery) but neither the Coaching Library nor the Training Plans system links back into them despite being thematically adjacent.

---

## 7. Coaching Library — analyzed on its own terms, not generic "coach profile" SEO

This is a real editorial structure, not a directory of bios, and the analysis reflects that. Per `coaches/types.ts` (already fully documented in this session's `CLAUDE.md`), every coach page carries: a historical-context block (why the system emerged, what it replaced), even-handed criticism/response pairs, a `strongestArgument` field, an `otherCoachesCritique` array (a *different*, named coach's real documented position, never fabricated), `relatedPhilosophies` (naming both what's shared and what genuinely differs), a `genome` (10-axis illustrative profile), decision scenarios, and workout reactions (the same fixed workout, reacted to differently per coach — a genuinely distinctive comparative device).

- **Individual coach pages**: function simultaneously as profile/entity pages (a reader searching a coach's name lands correctly) and as nodes in a comparative structure (a reader arrives with comparative intent and the page itself argues, criticizes, and cross-references). This dual function is a strength, not something to simplify into one or the other.
- **Comparison functionality**: real and structured (`coach-comparison-table.tsx`, `coach-genome-chart.tsx`/`coach-genome-compare.tsx`), not a feature name attached to a static table.
- **Links between coaches**: dense (§6) — 21 `coachSlug` cross-references across 7 coaches.
- **Links from coaching philosophy → training concepts**: real — e.g. the Lydiard page's `crossLinks` point to `workout-library` and `exercise-physiology` (confirmed in this session's own earlier work on that entry).
- **Links from training concepts → coaching philosophies**: this direction is weaker — `workout-library`, `marathon-training`, etc. don't consistently link back to the specific coach pages whose philosophy underlies a given technique, even where the prose names that coach (e.g., Lydiard-attributed hill work in `workout-library` doesn't link to `/coaching-library/lydiard`).
- **Would a "choosing a coaching philosophy" page genuinely add value?** Yes, per §4.2 — but the analysis in §5 is the more important finding: this is very likely better executed as strengthened prose on `/coaching-library` itself than as a new URL, since the comparative infrastructure the page would need already exists there.

---

## 8. Athlete Library — analyzed separately

- **Search intent satisfied**: profile/entity, confirmed by the page's own stated design goal (its `sections.ts`/data-file comment: "How coaching philosophies actually showed up in real athletes' training — not biographies, applications"). This is deliberately not a biography page.
- **Should these be treated primarily as entity/reference pages?** Yes, and that's the correct, deliberate framing already in place — each athlete was selected specifically *because* their coach already has a Coaching Library page (confirmed via the athletes data file's own comment), so the connection to training concepts is structural, not incidental.
- **Connection to training concepts**: real but narrower than the Coaching Library's — `physiologicalEmphasis` keys into a shared `PHYSIOLOGY_TOPICS` map (same canonical map coaches use, confirmed in code), so an athlete page can link to the same physiology concepts a coach page does, but doesn't currently link into the broader prose sections (`marathon-training`, `workout-library`) the way a coach page's `crossLinks` do.
- **Does the case-study content create useful topical authority?** Yes — e.g. Peter Snell's page includes a real, specific `famousSessions` entry (the Waiatarua Circuit, with a direct quote from his own autobiography) that's genuinely unique content no generic running site has. This is real topical-authority material, currently under-linked (nothing outside the Athlete Library points to it).
- **Would additional internal links strengthen the training clusters?** Yes, directly — this is a concrete, low-effort linking opportunity: `marathon-training` discussing long-run-embedded race-pace work could link to Deena Kastor's or Moses Mosop's case study; `workout-library`'s hill-training content could link to Peter Snell's Waiatarua Circuit entry.

---

## 9. Questions and Articles

**Questions**: `linkedSectionSlug` (confirmed in `questions/types.ts`) is real, already-built infrastructure for a question to link into a foundational page — but whether it's actually populated on real question rows isn't determinable from a code-only read (that's data, not architecture). The mechanism is verified to exist; its current utilization isn't. **This is exactly the kind of long-tail entry point search engines reward** (a specific, naturally-phrased question ranking for a long-tail query, then routing a reader into the deeper foundational page) — the plumbing is there, whether it's being used is a content/data question for a later phase, not an architecture gap.

**Articles**: the `articles` section's `articleSlugs: []` is confirmed, by reading `[slug]/page.tsx`'s own logic, to function as a truthy flag gating a live database query, not an actual allowlist — so this being empty does not mean zero articles are indexed or discoverable; every published article is discovered dynamically regardless of this array's contents. The real open question — whether individual articles reinforce existing topic clusters or create duplicate intent with foundational `sections.ts` pages covering the same ground — **can't be answered from code alone**, since article content lives in the database, not the repository. This is a genuine blind spot in a code-only architecture pass, stated plainly rather than guessed at.

---

## 10. Content gaps — re-evaluated against current code, not the prior audit

| Topic | Prior audit said | Actual current state | Verdict |
|---|---|---|---|
| Trail/ultra running | TRUE GAP | `trail-and-ultra-training` exists, `lastUpdated: 2026-07-27`, covers effort-based RPE training, power-hiking climbs, technical-terrain psychology, downhill technique, and ultra-specific fueling with real Western States exit-survey data and Koop's *Training Essentials for Ultrarunning* cited | **ALREADY COVERED** |
| Pregnancy/postpartum running | TRUE GAP ("almost certainly") | A full, real section inside `recovery`: ACOG guidance, the "140bpm ceiling" myth explicitly debunked, relaxin/joint-laxity, heat management, postpartum 6-week clearance, urinary leakage and pelvic-floor PT, diastasis recti, prolapse — genuinely specific, credentialed-feeling content | **ALREADY COVERED** (see §4.5 on discoverability, which is a real, separate issue) |
| Masters/aging running | TRUE GAP | "Training Through the Decades" inside `recovery`: VO2max decline mechanism (peripheral vs. central), Attia's *Outlive*/Centenarian Decathlon framing, decade-by-decade recovery-spacing guidance, the case for starting strength work in your 30s | **ALREADY COVERED** (same discoverability caveat) |
| Which pace-prediction model to use | Not previously flagged | Real comparative content exists (`fitness-model-comparison-note.tsx`) but only as a shared component on three tool pages, not its own page | **PARTIALLY COVERED** — content exists, dedicated destination doesn't (§4.4) |
| Choosing a coaching philosophy broadly | Previously assumed to need a new pillar | Comparison infrastructure (table, genome-compare, timeline) already exists on `/coaching-library` itself | **PARTIALLY COVERED** — the page exists and has the tools, it doesn't yet make the argument in prose (§5) |
| Injury return-to-running protocols specifically | Not previously flagged | `recovery` covers injury *diagnosis* (tendon/nerve/bone-stress patterns, PEACE & LOVE) in real depth, but a dedicated, staged "how to actually return to running after time off" protocol wasn't found | **PARTIALLY COVERED** — diagnosis is strong, structured return-to-run progression is thin |
| Altitude training/racing | Not previously flagged | One passing mention only (confirmed via grep, "altitude training": 1 hit), no dedicated treatment | **TRUE GAP**, but low priority — narrow audience relative to the rest of the site |
| Youth/adolescent-specific physiology (distinct from high-school racing tactics) | Not previously flagged | High school racing/team context is covered well (`5k-training`'s "varsity level" content), but adolescent-specific training-load/growth-plate physiology as its own topic wasn't found | **NOT WORTH BUILDING as a dedicated page right now** — the practical racing/coaching content that matters most for this audience already exists; a separate pediatric-physiology deep-dive would be a narrow, low-traffic addition relative to everything else in this document |

**Explicit application of the gap-vs-no-gap standard from the brief**: none of the above three "ALREADY COVERED" findings should be interpreted as "the Haarchive has a page with this exact title" — the actual test is whether the search intent and conceptual area are addressed, and by that standard all three are addressed substantively. The real, remaining problem for all three isn't content, it's **discoverability** — see §4.5 and §6.

---

## 11. Proposed SEO architecture for the strongest clusters

Not a rigid hierarchy — the clearest relationships found, per cluster:

```
POLARIZED / AEROBIC-BASE TRAINING
→ PILLAR (new, §4.1): synthesizes mechanism + evidence into one argument
  → SUPPORTING: the-aerobic-base (mechanism), research-library (evidence)
  → DEEP-DIVE: data-and-analytics (zone math), Coaching Library entries whose
    philosophy is polarized-training-adjacent
  → TOOLS: data-and-analytics' zone tables, hr-threshold-calculator
  → QUESTIONS/ARTICLES: long-tail "how much easy running should I do" questions,
    if/when linkedSectionSlug is populated toward this cluster

COACHING PHILOSOPHY
→ PILLAR (existing page, strengthened, §4.2/§5): /coaching-library itself
  → SUPPORTING: training-philosophy (currently unlinked — should point here)
  → DEEP-DIVE: each of the 7 individual coach pages
  → CASE STUDIES: Athlete Library entries (already structurally tied to a coach)
  → TOOLS: none directly, by design — this cluster is comparative/editorial

RACE-PACE PREDICTION
→ PILLAR (new, §4.4): expands fitness-model-comparison-note.tsx's own framing
  → TOOLS: Pace & HR, CV-Threshold, Tinman (the three competing models)
  → SUPPORTING: data-and-analytics (threshold-finding methodology)
  → DEEP-DIVE: research-library, if/where each model's underlying research is cited

LIFE-STAGE TRAINING (menstrual cycle / RED-S / pregnancy-postpartum / masters)
→ Three separate small clusters currently sharing one host page (recovery), not
  one pillar (§4.5) — each would need its own supporting/deep-dive structure if
  ever split out; a content/IA decision outside this phase's scope, not a
  recommendation being made here

MARATHON TRAINING
→ Already functions close to a self-contained cluster; no restructuring
  recommended (§4.3)
  → SUPPORTING: workout-library (named sessions), training-plans (day-by-day)
  → CASE STUDIES: Deena Kastor, Moses Mosop (Athlete Library) — currently
    under-linked from this cluster (§8)
```

---

## 12. Final report

### A. Executive summary — the 8 most important findings

1. **The prior audit's three confirmed content gaps are all already covered.** Trail/ultra, pregnancy/postpartum, and masters/aging running all have real, well-cited content inside `sections.ts` today. The problem was never content — it's that this doesn't match what the podcast-synthesis map (written earlier) predicted was still missing, and the SEO audit inherited that stale characterization without re-checking `sections.ts` directly.
2. **The real problem with that life-stage content is discoverability, not existence** — it's the last four headings of a general `recovery` page, with no inbound links from anywhere else pointing a reader (or a search engine) toward it specifically.
3. **The Pace & HR / CV-Threshold / Tinman overlap is real but already partially solved** — a shared component explains the methodological difference on all three pages. The unsolved half is a pure ranking-authority problem, not a user-confusion problem.
4. **The single lowest-effort, highest-value pillar opportunity is race-pace-prediction comparison** — the actual differentiating content already exists in `fitness-model-comparison-note.tsx`, just not as its own destination.
5. **`/coaching-library` is already most of the way to being a pillar** — it has real comparison tooling (table, genome-compare, timeline); it just doesn't yet argue its own case in prose. This is the clearest example anywhere on the site of "strengthen, don't create."
6. **Two good internal-linking systems exist and don't talk to each other** — `glossary.ts`/`linkify.tsx` covers `sections.ts` prose; the Coaching/Athlete Library's `crossLinks`/`coachSlug` system covers itself. Neither reaches the other, so a `sections.ts` page naming a coach never links to that coach's actual page.
7. **Training-concept pages link to Coaching Library philosophy less than the reverse** — coach pages link out to techniques; technique pages rarely link back to the coach whose philosophy is being described.
8. **Marathon Training, 5K Training, and Workout Library are not cannibalizing each other** — they're a correctly-differentiated how-to/reference/plan split, already cross-linking appropriately. This is worth stating plainly since it was one of the areas flagged for independent verification and the honest finding is "this is working."

### B. Current topical map — see §1

### C. Search-intent map — see §2

### D. Cannibalization report

| Pair/group | Rank | Why |
|---|---|---|
| Pace & HR / CV-Threshold / Tinman | **HIGH** | Real overlapping intent, real competing URLs; user confusion already mitigated, ranking-authority split is not |
| Aerobic base / Research library | **MEDIUM** | Real topical overlap but genuinely different framings (mechanism vs. evidence), not duplicated content |
| Training philosophy / Coaching Library | **LOW** (as cannibalization) | Different intents, but a real missed-link problem, not a competing-page problem |
| Marathon training / Workout library / Training plans | **Not actually a problem** | Confirmed correct differentiation (how-to / reference / plan) |
| 5K training / Workout library / Strength training | **Not actually a problem** | Same pattern, confirmed via explicit existing cross-references |
| Recovery / Nutrition (RED-S) | **Not actually a problem** | Model example of correct two-way cross-referencing |

### E. Pillar opportunities, ranked

| Pillar | SEO potential | Existing content support | User value | Effort |
|---|---|---|---|---|
| Race-pace prediction comparison | High | Very high (content already written) | High | **Lowest** |
| Coaching philosophy (strengthen `/coaching-library`, no new URL) | High | Very high (tooling already built) | High | **Low** |
| Polarized/aerobic-base training | High | High (two full pages of source material) | High | Medium |
| Life-stage training (3 separate smaller opportunities) | Medium individually | High (content exists) | High for the specific audiences | Medium-High (an IA decision first, content work second) |
| Marathon training pillar | Low priority | Already strong as-is | Already served | N/A — not recommended now |

### F. Internal-linking opportunities, ranked by impact

1. **Bridge the two linking systems** — when `sections.ts` prose names a coach or researcher already in the Coaching Library, link to that real page instead of leaving it as plain text. Highest-leverage single change identified in this analysis.
2. **Link `training-philosophy` → `/coaching-library`** — the obvious, currently-missing conceptual bridge.
3. **Link training-concept pages back to the specific Coaching Library page whose philosophy they describe** (e.g., Lydiard-attributed hill work in `workout-library` → `/coaching-library/lydiard`).
4. **Surface the life-stage content from more than one entry point** — at minimum, link from wherever the site currently discusses training volume/nutrition by gender or age.
5. **Link Athlete Library case studies from the training-concept pages they illustrate** (Snell's Waiatarua Circuit from `workout-library`'s hill content; Kastor/Mosop from `marathon-training`).
6. **Link Training Plans from `marathon-training`/`5k-training`'s own prose**, not just from the Training Plans index.

### G. Content gaps — see §10 for full table; summary:
- **TRUE GAP**: altitude training/racing (low priority, narrow audience).
- **PARTIALLY COVERED**: race-pace-model comparison as its own page; coaching-philosophy comparison in prose form; structured return-to-running progression.
- **ALREADY COVERED**: trail/ultra, pregnancy/postpartum, masters/aging.
- **NOT WORTH BUILDING**: dedicated adolescent-physiology page (the practically useful content for that audience already exists elsewhere).

### H. Recommended future architecture — see §11

### I. Implementation roadmap (categorized only — nothing here is being done in this phase)

**1. Safe mechanical changes Claude Code could make (once explicitly authorized in a future phase):**
- Adding cross-links from `sections.ts` prose to existing Coaching/Athlete Library pages where a coach/athlete is already named in text.
- Adding the `training-philosophy` → `/coaching-library` link.
- Adding Training Plans links from `marathon-training`/`5k-training`.

**2. Changes requiring Brody's editorial judgment:**
- Whether to build the race-pace-prediction pillar and where it should live (a new top-level page? Under Tools? Under The Science?).
- Whether and how to strengthen `/coaching-library`'s own prose into a pillar.
- Whether the life-stage content should be split out of `recovery` into its own page(s) or left in place with better inbound linking — this is an information-architecture decision, not a technical one.
- Whether the polarized-training pillar is worth building now versus later.

**3. New content requiring deliberate planning:**
- Any dedicated altitude-training content, if pursued at all (explicitly low priority here).
- A structured return-to-running-after-injury progression, if the current diagnosis-only coverage is judged insufficient.

---

**Phase 2A complete — no files modified.**
