# Framework seeds

Verified source data for the five marathon frameworks, the 5K Crash Course, and the post-race templates, loaded into the Program layer by `scripts/seed-framework-programs.ts`. This file is the manifest: what each file is, where it came from, and every place the committed copy deliberately differs from what arrived.

## Why these files are committed verbatim

Each JSON file is a verified transcription of the Marathon Excellence 18-week web PDFs (marathonexcellence.com, imperial), cross-checked against Kindle screenshots, with every PDF/Kindle disagreement already settled **in the file itself** — see each file's own `conflicts_resolved` array (31 conflicts across the five frameworks; the PDF won all of them). They are committed as-is rather than hand-transcribed into typed TypeScript so that the thing in version control is the thing that was verified. All interpretation lives in one pure, tested module instead: `src/lib/private-coaching/framework-seed.ts`, covered by `tests/lib/private-coaching/framework-seed.test.ts`.

| File | Contents | Loaded as |
|---|---|---|
| `canyon.json` | 18 weeks, peak 40/50 mi, general 1–10 / supportive 11–14 / specific 15–18 | 1 program, 2 volume variants, 126 sessions |
| `mesa.json` | 18 weeks, peak 55/65 mi, general 1–8 / supportive 9–13 / specific 14–18 | 1 program, 2 volume variants, 126 sessions |
| `ridge.json` | 18 weeks, peak 70/80 mi, general 1–7 / supportive 8–12 / specific 13–18 | 1 program, 2 volume variants, 156 sessions (AM/PM doubles) |
| `peak.json` | 18 weeks, peak 85/95 mi, general 1–6 / supportive 7–12 / specific 13–18 | 1 program, 2 volume variants, 181 sessions |
| `summit.json` | 18 weeks, peak 100/110/120 mi, general 1–6 / supportive 7–11 / specific 12–18 | 1 program, 3 volume variants, 211 sessions |
| `crash-course.json` | 3 levels x 4 weeks, effort-based, week-4 5K time trial | 3 separate programs, 28 sessions each |
| `post-marathon-recovery-program.md` | ~6-week post-race arc (rest → return to running → return to training) | Not yet loaded — Part H |
| `post-season-review-questionnaire.md` | Structured post-race reflection | Not yet loaded — Part H |

Every framework authors **126 day slots** (18 x 7, Monday-first). Ridge, Peak and Summit carry more *sessions* than slots because they use AM/PM doubles — which is why `program_days`' uniqueness key includes `session_slot` (see `20261013050000_private_coaching_program_volume_variants.sql`).

## Deviations from the files as received

Only two, both recorded here on purpose:

1. **`peak.json` week 8 note.** The received file read "A gentle down week — *Tornado* trims volume less aggressively than lower plans." `Tornado` is the source plan name, and the naming rule is that source plan names (Breeze, Wind, Gale, Tornado, Hurricane) exist only in each file's `source_plan_name` field as a build reference and never appear in stored or displayed content. Week notes are coach-visible, so this one occurrence was renamed to "— Peak trims volume less aggressively than lower frameworks." A product-name substitution; no training content changed. A test asserts no source plan name reaches any stored program field.

   **Scope of that rule: the coaching Program layer only.** The public Training Plans section (`src/lib/training-plans/data.ts`, routes like `/training-plans/breeze-18`) deliberately still uses the source plan names as its public track names and URL slugs. Those pages predate the Canyon→Summit rebrand, the rebrand was decided for the new product surface, and renaming them would mean URL redirects and the SEO churn that comes with them. That is its own migration if it ever happens, not an incidental change from inside this seed. **Do not "fix" the public pages to match these framework names.**

2. **`post-season-review-questionnaire.md`.** Fixed one typo in the received text ("Would you cahange anything" → "change"). This file is athlete-facing copy, not a cited source.

Nothing else was edited. The five JSON files are otherwise byte-identical to what was delivered, and the two markdown files are verbatim apart from that typo.

## What the loader does and does not derive

Rules are stated and tested in `framework-seed.ts`; the short version:

- **Prescription text is stored verbatim** in `program_days.notes` and is never parsed into structured steps. "10 x 3 min at 90–92% 5k pace with 45 sec jog" carries a rep count, a pace range, a rest length and an implied warm-up/cool-down, and splitting that means choosing per workout which range was "really" meant.
- **No seeded day gets a pace percent**, so no seeded workout resolves into a literal pace against the athlete's fitness estimate — it renders as prose. This follows from the sources: every pace-targeted session states its warm-up and cool-down in the same string, so a *day-level* percent would claim the whole 11–12 miles ran at the main set's pace. The honest home for these targets is step-level, which means authoring the warm-up / main set / cool-down split per day. Real follow-up, deliberately not approximated here.
- **Difficulty is preserved verbatim** in `program_days.difficulty_label` ("8.5–9/10"). `planned_rpe`/`planned_rpe_max` are integers and cannot hold a half point, so they carry the *containing envelope* (7.5 → 7..8) — wider than the source, never narrower, never a rounded single value the source didn't claim.
- **Day of week comes from array position**, never the day label: these files label days "M T W T F S S", where Tuesday/Thursday and Saturday/Sunday are the same character. The arrays are Monday-first and seven long, which the loader asserts.
- **Weeks are not named.** The loader writes no `program_phase_weeks.label`; the sources don't name their weeks, and inventing "Down Week"/"Peak Week" would assert something the framework didn't.

## Re-seeding

```bash
npm run seed:framework-programs -- --coach-email=you@example.com                  # all five frameworks
npm run seed:framework-programs -- --coach-email=... --crash-course               # + the three levels
npm run seed:framework-programs -- --coach-email=... --frameworks=peak --replace  # rebuild one
```

Idempotent by `(coach_id, framework_key)`, enforced by a partial unique index: re-running without `--replace` reports what already exists and writes nothing. `--replace` deletes and rebuilds, which cascades through that program's phases, variants, weeks and days. An athlete phase already generated from it keeps all of its real training data (`training_phases`' provenance columns are `ON DELETE SET NULL`) but loses the link back, so "Resync from program" stops being offered for it.

**The canonical Canyon template is the one seeded here.** `scripts/seed-canyon-program.ts` separately seeds "The Canyon Framework" from a different source (Brody's own day-by-day table plus "Canyon Overview.pdf"). That one is now superseded as a template: it has no peak-volume variants, no per-week goal mileage, and different phase boundaries. It has no `framework_key`, so it does not collide with the `canyon` program seeded here, but it should not be assigned to a real athlete.

It is kept on purpose, because it holds precisely what these web-PDF transcriptions lack: per-day distances in meters, day labels, and real `program_day_steps` for the interval sessions. That makes it the enrichment source for adding step-level structure to the canonical template, not a competing option. See `docs/private-coaching/step-level-authoring-follow-up.md`.
