# Phase 4 report — `resources/Lydiard/` synthesis

## What happened, in short

All 25 files in `resources/Lydiard/` (23 PDFs, 2 JPGs, ~587 pages) were read
in full across 14 delegated digestion batches, then synthesized into a
content plan (`synthesis-map.md`). Before editing, the plan was re-verified
against the *actual current content* of `src/lib/sections.ts` (not just the
narrow "Lydiard"/"Livingstone" grep that seeded the original synthesis
map) — and that re-verification found the site already covers the large
majority of what looked "novel" in the digests. The real remaining gaps
were much narrower than first estimated, and the edits reflect that: three
targeted additions rather than a bulk rewrite.

## Why the scope narrowed so much

The original `existing-coverage.md` was built by grepping `sections.ts` for
the literal strings "Lydiard" and "Livingstone." That missed a large amount
of content already on the site that's sourced from modern researchers
*cited by their own names* — Stephen Seiler, RED-S/Mountjoy, the FASTER
study, Achten et al., Bossi et al., Tønnessen et al. Reading the actual
`the-aerobic-base`, `data-and-analytics`, `nutrition-and-fueling`, and
`workout-library` sections directly (not just grepping two names) turned
up:

- **`the-aerobic-base` / `research-library`** already cover Seiler's
  polarized-training research in real depth: the two-poles/threshold-trap
  framing, Kristiansen's and Kipchoge's training logs, the Seiler & Sylta
  2017 4×16/8/4-minute study, and a periodization-order study (cited as
  Bossi et al. — the same underlying finding as the "Sylta" study several
  digests flagged as novel).
- **`data-and-analytics`** already covers session-RPE (Foster's scale, with
  the identical 270-vs-420 worked example), the 37-cyclists HRmax-formula
  unreliability study, threshold precision (2.3–3.0 mmol/L vs. the textbook
  4.0), and cardiac drift.
- **`nutrition-and-fueling`** already covers RED-S in real depth (in
  `recovery`, cross-linked from here), the Tim Noakes reversal, and — more
  rigorously than the clinic-deck material in the folder — the AIS
  "Supernova" trial showing low-carb/fat-adapted race-walkers actually
  performed *worse* despite higher fat-oxidation, directly complicating the
  simpler "fat-adaptation is an edge" framing several `resources/Lydiard/`
  clinic decks present less critically.
- **`exercise-physiology`** already has the corrected oxygen-debt ceiling
  (Snell's ~4L revision), the fat/carb crossover point, and the FASTER
  study's exact fat-oxidation numbers (1.54 vs. 0.67 g/min).
- **`workout-library`** already covers hill circuits, the three named hill
  types, downhill technique, and interval-structuring logic that amounts to
  the same "work-bout duration and total accumulated time matter more than
  rest length" finding Seiler's Vienna decks present as new research.

None of that is a criticism of the digestion work — the digest agents did
exactly what they were asked (extract and tag against a coverage list they
were given), and the coverage list was the thing that undersold the site.
Flagging this here because it materially changed what Phase 3 actually
did, relative to the synthesis map presented as a checkpoint.

## What was genuinely missing, and what got added

**1. Running technique and footwear philosophy — a confirmed total gap,**
the single most substantive addition. New content in `workout-library`
(three new headings, inserted after "The Descent Is Part of the Session"):
"Technique Comes Before Energy Systems" (Lydiard's own sequencing —
technique has to come before energy-system training, a real nuance against
his popular reputation as purely an aerobic-volume coach), "Running Tall,
Not Sitting in a Bucket" (the "sitting in a bucket" posture cue and the
"Thud vs. Spring" footstrike framing), and "What Lydiard Actually Wanted
From a Shoe" (canvas-shoe history, "second layer of skin," skepticism of
expensive hi-tech shoes, and his rejection of orthotics — "the orthotics
are for the shoes, not the feet"). All direct quotes cite
`(Lydiard, Running to the Top)`, matching the site's existing citation for
his own words; one framing point cites `(Borg, Champions Everywhere)`,
the secondary source that assembled the Lydiard quotes.

**2. Dedicated Lydiard biography — confirmed gap** (the site covers the
*jogging movement's* history — Halberg, Bowerman, East Germany — but not
Lydiard's own backstory). New vignette in `the-philosophy-of-running`, "A
Shoe-Factory Dropout Who Became His Own Guinea Pig": his own origin story
(the Jack Dolan 5-mile run, self-experimentation up to 250 mi/week, Lawrie
King's breakthrough win), then Halberg and Snell's Rome 1960 results, and
the Mexico/Finland coaching years culminating in Viren's Munich 1972
double-double. Cites `(Lydiard, Athletic Training, 1999 Lecture Tour)` — a
1999 Brooks/ATF lecture-tour guide, first-person Lydiard, genuinely
distinct from *Running to the Top*.

**3. Peter Snell's 1961-62 buildup — a strong, previously-uncaptured
narrative example.** New vignette in `the-philosophy-of-running`, "A
Marathon, Ten Weeks Before a World Record": Snell running an actual
marathon mid-buildup (bonking at 24 miles, the "clean bowled" cricket
anecdote), then the world mile record ten weeks later — with Snell's own
later-career physiologist framing of *why* long, moderate running supports
speed. Cites `(Livingstone, in Moller, Running Times, 2009)` for the
narrative detail and includes Snell's own direct quote from the same
piece.

**4. Coaching-philosophy material for `for-coaches` — confirmed gap.** Two
new headings: "'Response Regulated, Not Number Regulated'" (the Lydiard
Foundation's own correction of the popular "rigid mileage" caricature) and
"Anaerobic Training Doesn't Build Speed. It Counteracts It." (John Davies's
misconception-correction quote and 3-week/4th-week-decision protocol, plus
Ron Daws's "good training and bad training look exactly the same on
paper" axiom). Cites `(Lydiard Foundation, First Steps)` and
`(Davies, in Lydiard, Athletic Training, 1999 Lecture Tour)`.

## What was deliberately left out, and why

- **Low-carb/ketogenic nutrition material** (Cucuzzella's and Defty's
  clinic-deck framing, the FASTER study presented less critically than the
  site's existing Supernova-trial treatment): skipped. The site's existing
  nutrition coverage is more rigorous and already presents this exact
  tension (fat-adaptation raises fat-oxidation ceiling, but the AIS trial
  found it can hurt race-pace performance). Re-adding a less critical
  version of the same material would have been a downgrade, not an
  addition.
- **General US public-health epidemiology, personal health-memoir material**
  (statins, telomeres, earthing, individual blood-panel self-experiments):
  skipped as out of scope for a running-coaching site, per the synthesis
  map's own P3 designation.
- **Modern polarized-training / interval-science research** (Seiler's
  Vienna decks, the Sylta periodization-order study): skipped as
  already covered — see above.
- **RED-S, session-RPE, HRV, threshold-precision material**: skipped as
  already covered — see above.
- **The extensive Auckland-club/masters-running roster, the "Lydiardzone"
  geographic trivia, the Rod Dixon/KIDSMARATHON material, the full "Other
  Views of the Lydiard Way" magazine sidebar**: judged genuinely
  interesting but a lower-value use of the two thin pages (`getting-started`,
  `foundations`) that could actually hold new material without becoming
  bloated. Left out rather than force-fit.
- **The Marcellin College weekly training templates, the "Hop Off the
  Intensity Escalator" event-pace-ceiling table**: real, concrete, unused
  material — genuinely worth adding at some point, but `workout-library` is
  already the site's most detailed page and absorbing three new headings
  in this pass; didn't want to push a single page much further in one
  sitting. Flagging as a good next increment rather than skipping silently.

## Disagreements preserved, not flattened

- Lydiard himself was skeptical of weight training for distance runners
  ("I don't want fellows... for distance runners, weight lifting is not an
  efficient means of training," from the *Sports Illustrated* piece) — in
  real tension with the site's existing favorable heavy-low-rep-lifting
  coverage (itself drawn from Livingstone). Not added to the site this
  pass, since `strength-training` wasn't touched, but noting it here so
  it isn't lost: a future pass on that page should acknowledge this as a
  genuine disagreement within the Lydiard lineage, not silently pick a
  side.
- The oxygen-debt-ceiling number: the site already cites "~4 liters" via
  Snell; one folder source (the *Jogging: The Lydiard Way* editorial
  layer) gives "~5 liters." Not changed, since the site's existing figure
  is already the more specific, directly-sourced one — flagging the
  discrepancy here rather than treating it as settled.

## Verification

- `npx tsc --noEmit -p .` — clean.
- `npx eslint src/lib/sections.ts` — clean.
- `npx vitest run` — full suite, 99 files / 842 tests, all passing (including
  `tests/lib/sections.test.ts` and `tests/lib/section-linkify.test.ts`).
- Cross-checked against the Phase 1 manifest: all 14 batches / 25 source
  files were digested; nothing was skipped at the digestion stage. What's
  "left out" above was a deliberate synthesis decision after reading the
  actual site content, not a gap in what got read.
