# Running with the Buffaloes — synthesis manifest

Source: `resources/books/Running with the Buffaloes _ a season inside with Mark -- Chris Lear -- First, 2011.pdf` (291 PDF pages; book's own printed pagination is pp. 1-263, starting at PDF page 21). **Citation convention: page numbers throughout this synthesis refer to the book's own printed pagination — `(Lear, Running with the Buffaloes, p. N)`.**

**STATUS: Complete.** Full book read (pp. 1-263, front matter through afterword/about-the-author) and full repository audit both done. This second pass reorganized the synthesis into the stricter deliverable structure a follow-up task requested — the file layout below is current.

## File layout

- `digests/digest-01.md` – `digest-12.md` — the full raw research archive, in book-page order. Every quote, workout number, and race-results table transcribed directly from the PDF this session. **Internal research material, not intended to become public Haarchive content directly** — cite `extraction.md` for the curated, page-cited claims instead.
- `extraction.md` — the primary analytical deliverable: Executive Summary, the Master Extraction Table (every worthwhile extraction, classified and prioritized), the Top 20 ranked extractions, Genuine Content Gaps, a structured (outline-only, not polished-prose) Coaching Library recommendation for Mark Wetmore, sensitive-material handling notes, and the Contradictions/Caveats section (WHAT HAPPENED / WHAT THE SOURCE CLAIMS / WHAT THE HAARCHIVE SHOULD SAY for each).
- `integration-map.md` — a focused, action-oriented table (Source Knowledge → Existing Haarchive Location → Action) derived from `extraction.md`'s higher-priority rows, using the actual current repository structure.
- `source-citations.md` — the clean citation database: one row per extraction ID, with page, claim, verbatim quotation where used, source type, confidence, and recommended use.

**Implementation boundary respected**: no production content (`sections.ts`, `coaches/data.ts`, or any live page) has been written or changed by this synthesis. Everything above is research/planning material for a future, separate implementation pass.

## Repository audit method and findings (grounding for `extraction.md`)

Audited directly by reading the actual files (not from memory, not by keyword-grep alone — per CLAUDE.md §13's own caution about narrow greps undermining a prior synthesis effort on this exact project):

- `src/lib/sections.ts` (3,769 lines) — confirmed six live taxonomy categories: `physiology`, `psychology`, `philosophy`, `practice`, `archive` (Library), `tools`. Read in full detail: `the-aerobic-base`, `mostly-easy-genuinely-hard`, `exercise-physiology`, `workout-library` (incl. its altitude subsection), `5k-training`, `marathon-training`, `strength-training`, `sports-psychology`, `goal-setting`, `self-talk`, `daily-practice`, `performing-under-pressure`, `for-coaches`, `recovery` (incl. RED-S subsection), `nutrition-and-fueling`, `the-philosophy-of-running`, and the `coaching-library`/`training-philosophy` category framing.
- `src/lib/coaches/data.ts` (2,350 lines) — confirmed complete current roster: **Lydiard, Daniels, Canova, Vigil, Tom Schwartz, Pfitzinger, Norwegian System (7 total). No Wetmore entry.** Lydiard's own entry read in full — confirmed it has no collegiate/multi-peak periodization content anywhere in its `philosophy`, `corePrinciples`, `periodization`, or `periodizationSummary` fields.
- `src/lib/athletes/data.ts` (299 lines) — confirmed complete current roster: **Peter Snell, Deena Kastor, Moses Mosop, Jakob Ingebrigtsen (4 total). No Adam Goucher or Kara Goucher profile** (Kara Goucher appears only as a passing anecdote inside `the-philosophy-of-running`, not as an Athlete Library entry). Per the file's own header comment, a new athlete entry requires that athlete's coach to already have a Coaching Library page — so a Goucher entry is contingent on a Wetmore entry existing first.
- `docs/lydiard-synthesis/synthesis-map.md` and `existing-coverage.md` — read in full. Confirmed zero mentions of Wetmore, University of Colorado, Boulder, or collegiate multi-peak periodization anywhere. Confirmed this prior work *did* independently flag a real tension between the site's pro-strength-training stance and Lydiard's own documented skepticism of lifting (§6/§2 of `synthesis-map.md`) — never yet published live — which this Buffaloes synthesis's strength-training finding (§7.1 of `extraction.md`) independently corroborates without duplicating.

Full topic-by-topic detail (what exists, where, and what it currently says) is preserved in the session transcript that produced this audit; the findings are folded directly into `extraction.md`'s `Existing Location` and `Relationship` columns and its Executive Summary, so it is not separately reproduced here.

## Digest coverage index

| Digest | Book pages | Contents |
|---|---|---|
| 01 | front matter + 1-15 | Roster, preseason day 1, Flagstaff run, training camp/goal-setting |
| 02 | 16-35 | Full periodization system (Lydiard-derived), "monster island" origin story, Magnolia Road |
| 03 | 36-55 | AT/fartlek sessions, "right stuff" talent framework, weight/nutrition, "three-week syndrome" |
| 04 | 56-75 | HR-based training, walk-on time trial psychology, Goucher's full HS development case study, hill tactics |
| 05 | 76-95 | Batliner injury arc begins, strength-training policy, Ponce's full life story, massage/recovery economics |
| 06 | 96-115 | Full team speech ("100 days to impress me"), Kenyan-marathoner humility story, automatic-qualifying training data |
| 07 | 116-135 | First race (Rocky Mountain Shootout), racing-frequency principle, Severy's breakthrough amid grief |
| 08 | 136-155 | Pre-Nationals race, Christopher Severy's death and the team's crisis response |
| 09 | 156-175 | Batliner's return-from-injury protocol, memorial service, "welcome to anaerobia" |
| 10 | 176-195 | Return to training, anti-rhetoric racing psychology, Big 12 Championship, Tessman's neuroma |
| 11 | 196-215 | "Master Blaster," body-composition cautions, real-time workout-abort decision, Reese's concealed injury, recruiting philosophy |
| 12 | 216-261 | Regionals, taper week, the 1998 NCAA Championship race, season self-evaluation, epilogue/afterword |

## Key cross-cutting threads (see `extraction.md` for the classified, prioritized version)

- **Periodization/training system**: fully specified in digest-02, reinforced throughout → `extraction.md` TR-1 through TR-11.
- **Goucher overreaching-risk arc**: digest-03 (22-mile run) → digest-04 (apparent cost) → digest-11/12 (leg issues, eventual pro-career injury pattern in epilogue) → largely narrative/historical, not separately extracted as a standalone principle beyond PH-2.
- **Christopher Severy's death and grief-support response**: digests 08-09 → `extraction.md` PS-9, PS-10, PS-11, CO-9. Requires the careful, non-exploitative treatment specified in `extraction.md` §6 and §10.
- **Body-composition/leanness-culture pattern**: digest-04 (Goucher), digest-11 (Batliner's diet + Wetmore's "skeleton" quote), digest-12 (Batliner criticized for weight gain) → `extraction.md` §7.2, three independent instances treated as one documented pattern.
- **"No miracles"/anti-rhetoric coaching psychology**: digest-06 → digest-10 → digest-12 → `extraction.md` PS-7, with real athlete pushback (Reese) preserved as genuine disagreement, not resolved.
- **Individualized/tiered workout prescription**: established digest-02-03, reinforced in nearly every subsequent digest → `extraction.md` TR-9, a structural constant of the whole program.


## Citation-format correction (post-implementation)

Production content originally cited Lear with page numbers (e.g. `(Lear, Running with the Buffaloes, p. 24)`), matching the Buffaloes task's own explicit page-citation instruction. The user later clarified this should match the site's actual, pre-existing live citation convention, which never cites page numbers for books (see e.g. existing `(Lydiard, Running to the Top)`, `(Fitzgerald, How Bad Do You Want It?)` citations elsewhere in `sections.ts`) -- author and title only. All production citations in `sections.ts`, `coaches/data.ts`, and `athletes/data.ts` were corrected to drop page numbers accordingly. The page numbers themselves remain intact in the digest files and `source-citations.md` below, since those are internal research/provenance archives, not published content, and the page-level detail remains useful there for anyone tracing a claim back to its exact source.
