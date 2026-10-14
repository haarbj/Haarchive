# Follow-up: step-level authoring for the seeded frameworks

**Status:** proposed, not built. Filed out of Prompt 11 Part D2, where the gap was found and deliberately not papered over.

## The problem

The five seeded marathon frameworks (`scripts/data/framework-seeds/`) store each session as one verbatim prose string in `program_days.notes`:

```
2 mi progressive warm-up + 4 strides / 10 x 3 min at 90-92% 5k pace with 45 sec jog / 2 mi easy cool-down
```

No seeded day carries a pace percent, so **no seeded workout resolves into a real pace** against the athlete's fitness estimate. The athlete reads the prescription and does the arithmetic themselves, which is exactly the job the platform's pace-percent machinery already exists to do (`fitness-estimates.ts`'s `resolvePacePercent`, resolving live at read time against the athlete's current estimate).

This was not an oversight in the seed. A *day-level* percent means "this whole workout is at this pace," and these sources bundle the warm-up and cool-down into the same string as the main set. Setting `pace_percent_min = 90` on the day above would claim all 11–12 of its miles ran at 90% of 5K pace, which is false for roughly 4 of them. The existing Canyon seed states the same rule for itself: a day-level percent belongs only where "the day's whole prescription is a single, unambiguous clause," and in these transcriptions that case never occurs. A strict parser for it was written during D2, matched zero days across all five frameworks, and was removed rather than left as dead code.

## Why this is a real piece of work, not a parser tweak

The honest home for these targets is `program_day_steps.target_pace_percent_basis/_min/_max`, which already exists and already flows through generation. But populating it means authoring the real structure per session:

- **Easy prose** ("8-10 mi easy") needs no steps at all. Leave it.
- **A continuous-pace session** ("2 mi warm-up / 7-8 mi at 85% 5k / 2 mi cool-down") is a clean three-step split and is the tractable majority case.
- **An interval session** ("10 x 3 min at 90-92% 5k with 45 sec jog") needs a repeat step with a rest, plus warm-up/cool-down, plus the strides.
- **A float-recovery or alternating-kilometre session** ("5 x (1 km at 105% MP, 1 km at 96% MP, 1 km at 105% MP, 1 km at 90% MP)") is a nested structure with a different target per segment.
- **A stepwise long run** ("6 mi at 88% MP / 5 mi at 90% MP / 5 mi at 92% MP / 4-6 mi at 94% MP") is four distinct targets in sequence.
- **A double-threshold day or special block** is two separate sessions, each with its own full structure, already correctly stored as two `program_days` rows in different `session_slot`s.

Across the five frameworks that is 800 sessions. The parsing is mechanical for some shapes and genuinely ambiguous for others, which is why it is a scoped project with a review step rather than a regex.

## The enrichment source already in the repo

`scripts/data/canyon-program.ts` (loaded by the now-superseded `scripts/seed-canyon-program.ts`) was transcribed from a different, richer pair of source documents: Brody's own day-by-day table plus "Canyon Overview.pdf". It already carries, for Canyon's 126 days, exactly what the web-PDF seeds lack:

- `plannedDistanceM` per day, in meters
- real `dayLabel` values ("Kenyan Progression", "Steady State", "LR", "OFF")
- real `program_day_steps` (`scripts/data/canyon-steps.ts`) for the interval sessions
- `pacePercentBasis/Min/Max` on the days where it is genuinely unambiguous

So Canyon can be enriched by **reconciling two existing verified transcriptions** rather than by parsing prose. That is the right place to start, and it doubles as the validation set: where the two sources describe the same session, the structured one should reproduce the prose one.

## Suggested shape of the work

1. **Canyon first, by reconciliation.** Match `canyon-program.ts` days onto the canonical `canyon` program's days. This is easier than it sounds: both are 18 weeks x 7, Monday-first, and both use the same General/Supportive/Specific boundaries of 10/4/4, so day keys line up directly. The one structural difference is that the old seed also defines an optional, deliberately empty `Base` phase, which has no counterpart here and no content to carry over. Carry over distances, day labels and steps where the prose agrees. Report every disagreement instead of silently preferring one source.
2. **Then the tractable shapes elsewhere.** Warm-up / single-continuous-main-set / cool-down, and plain repeat-with-rest intervals, across Mesa through Summit. Keep the prose in `notes` untouched as the authority; steps are additive.
3. **Leave the genuinely ambiguous sessions prose-only.** Nested float/alternating structures and stepwise progressions should be authored by hand, or skipped, not guessed.
4. **Never let a step contradict its prose.** A test should assert that, for every day with steps, the steps' total distance and the prose's stated distance agree within a stated tolerance, and that every pace percent appearing in a step also appears in the prose.

## Constraints to respect

- The prose in `program_days.notes` stays verbatim and stays authoritative. Steps are an addition, never a replacement, and never an edit of the source text.
- `difficulty_label` likewise stays verbatim; `planned_rpe`/`_max` remain the widened integer envelope (see `framework-seed.ts`).
- Do not enable `scales_distance_with_mileage` on these programs to compensate. It multiplies every authored distance uniformly, including interval distances, which is exactly why both seed scripts set it false. Volume is expressed through the peak-volume variants.
- Anything that cannot be derived from a source document is not authored. Omit the step.
