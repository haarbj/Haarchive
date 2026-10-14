# 01 — Current Architecture

Evidence-based inventory of the private-coaching platform (`/coaching`) as it exists today. Every claim below is a file path, line number, or migration a reader can independently verify. Where something is stated as fact without a citation, it was directly observed in this session (a live query result, a screenshot, a test run) rather than inferred.

Scope note: `/coach` (the older team/group product) is out of scope for this document beyond §7, which states the boundary between the two products.

---

## 1. Stack

Next.js 16 (App Router, Server Components/Actions), React 19, TypeScript strict mode, Tailwind CSS 4, Supabase (Postgres 17 + Auth + Row-Level Security), Zod validation, Vitest. Deployed on Vercel, git-integrated, no custom CI beyond a narrow release-docs check. This matches the rest of the site; the coaching platform introduces no new infrastructure.

**One material fact about the coaching tree specifically: it is entirely uncommitted.** `git log` against `src/app/(app)/(protected)/coaching` and `src/lib/private-coaching` returns nothing. ~19,000 lines of code, 32 migrations, and the entire feature have no version history and no rollback point. This is a genuine risk independent of any design decision in this document.

## 2. Scale

| Measure | Count |
|---|---|
| Files under `coaching/**` route tree | 67 |
| `page.tsx` routes | 18 |
| Server-action modules | 11 |
| Total LOC (routes + `lib/private-coaching` + `components/private-coaching`) | ~19,000 |
| `layout.tsx` / `loading.tsx` / `error.tsx` in the coaching tree | **0** |
| Private-coaching migrations | 32 (`20260825010000` – `20260926070000`) |
| Distinct entry points to create/edit a scheduled workout | 13+ |

### Largest files (split candidates)

| Lines | File |
|---|---|
| 1390 | `coaching/athletes/[athleteId]/schedule/actions.ts` |
| 901 | `coaching/athletes/[athleteId]/schedule/page.tsx` |
| 628 | `components/private-coaching/athlete-pace-zone-table.tsx` (athlete-facing, admin-gated — §7.5) |
| 569 | `components/private-coaching/steps-editor.tsx` |
| 540 | `coaching/programs/actions.ts` |
| 522 | `coaching/athletes/[athleteId]/schedule/assign-program-form.tsx` |
| 507 | `coaching/page.tsx` (two unrelated role dashboards in one file) |
| 499 | `coaching/workouts/[workoutId]/page.tsx` |
| 447 | `components/private-coaching/day-vocabulary-fields.tsx` |
| 425 | `coaching/athletes/[athleteId]/schedule/calendar-data.ts` |
| 407 | `coaching/athletes/[athleteId]/schedule/assign-program-actions.ts` |

## 3. Build history — three generations, never consolidated

| Generation | Dates | What it added |
|---|---|---|
| MVP | Aug 25, 2026 (7 migrations) | Core relationship, workouts, messaging, metrics/check-ins, permissions, existing-table access, signup redemption |
| Calendar + vocabulary | Aug 26–27 (18 migrations) | Coach identity, message images, Strava pending matches, day vocabulary, training week plans, structured extras, training phases, step ranges, **pace_reference**, **volume_percent**, self-coach |
| Programs layer | Sept 25–26 (7 migrations) | `training_programs`, phases, duration variants, `program_days`/`_steps`/`_extras`, the `assign_program_generation` RPC (3 revisions), **pace_percent**, `repetitions_max`/`rest_max_s` |

`docs/private-coaching/prd.md` (written at the end of generation 1) is the only product document that predates generation 3 — it describes an MVP that does not include Programs at all, and it is still the most current PRD in the repo. `docs/private-coaching/coaching-calendar-audit.md` (Aug 26, generation 2) correctly recommended treating this as **Prescription → Execution → Analysis**, not Workout → Completion — that framing was adopted here and is carried into `05-target-architecture.md`.

## 4. The root defect: prescription has six modes, duplicated across six tables

A single workout's volume/intensity can be expressed as any ONE of:

1. Literal distance (`planned_distance_m`/`_max_m`)
2. Literal duration (`planned_duration_s`/`_max_s`)
3. `planned_volume_percent` — a percent of that week's target volume, resolved from `training_week_plans`
4. Literal pace (`planned_pace_s_per_mi`/`_max`)
5. `pace_reference` — a named zone (easy/steady/tempo/interval/5k/10k/half/marathon), resolved live from the athlete's most recent race result
6. `pace_percent_basis`/`_min`/`_max` — a percent of a named reference, resolved live from the athlete's self-reported fitness estimate

Plus independent HR and RPE ranges. Verified by direct migration inspection: **18 columns were added to `scheduled_workouts` after its creation**, across roughly 13 separate migrations (`grep "alter table public.scheduled_workouts" -A6 supabase/migrations/*.sql`). The identical vocabulary is duplicated across **six tables**: `scheduled_workouts`, `scheduled_workout_steps`, `workout_templates`, `workout_template_steps`, `program_days`, `program_day_steps` — each with its own near-identical set of range CHECK constraints and exclusivity constraints (`*_pace_reference_exclusive`, `*_pace_percent_exclusive`, `*_pace_percent_requires_basis`, `*_volume_percent_exclusive`).

**Fourteen source files** must independently know how to handle `pace_percent` alone, one of the six modes: `assign-program-actions.ts`, `calendar-data.ts`, `schedule/page.tsx`, `programs/[programId]/phases/[phaseDefinitionId]/page.tsx`, `phase-days-grid.tsx`, `program-day-form.tsx`, `programs/actions.ts`, `workouts/[workoutId]/page.tsx`, `day-vocabulary-fields.tsx`, `steps-editor.tsx`, `fitness-estimates.ts`, `program-generation.ts`, `steps.ts`, `workout-distance.ts`.

**This is the mechanism, not a side effect.** Every surface that reads or writes a workout must remember to carry all six modes through. Miss one and the value does not error — it silently reverts to null. This produced four confirmed bugs fixed earlier in this engagement (`summarizeStep` dropping pace-percent targets entirely from its rendered string; the workout detail page never selecting the percent columns or loading fitness estimates; `assign-program-actions.ts` reading `pace_percent_*`/`target_pace_percent_*` correctly from the database but never forwarding them in the RPC payload, so an assigned athlete's percent-based paces were silently dropped at the exact moment a coach handed a program to a real athlete; and the step editor never exposing `repetitions_max`/`rest_max_s` at all). It also produces the most serious defect found in this audit — §5.1.

## 5. Data-integrity findings (code-verified, ranked by severity)

Full table-by-table schema notes, the complete `scheduled_workout_steps` state-machine trace, and the full transaction audit are preserved in the Stage-A working notes; this section states the findings that matter for the target design.

### 5.1 The publish path destroys prescription data — the single most important finding

**All data-loss fields fixed in code since this finding was first written; only the bulk-publish gap remains open.** Stated precisely, since this section is now a mix of closed and open items:

- **Fixed — step-level:** `schedule/actions.ts`'s `saveScheduledWorkout` deletes and reinserts `scheduled_workout_steps` on every save, and that insert previously omitted `target_pace_percent_basis/min/max`, `repetitions_max`, and `rest_max_s` — silently stripping a step's percent-of-pace target and rep/rest range on every re-save, including a re-save of an already-published, program-assigned workout whose steps `assign_program_generation` had written correctly. The same omission existed in `templates/actions.ts` (`saveTemplate`, for `workout_template_steps`) and `programs/actions.ts` (`saveProgramDay`, for `program_day_steps`) — three independent instances of the identical bug. All three now write every field.
- **Fixed — day-level:** `saveScheduledWorkout` never wrote the day-level `pace_percent_basis/min/max` on `scheduled_workouts` itself, and `ScheduledWorkoutInput` didn't even carry the fields — a coach had no way to *set* a day-level percent-of-pace target from this editor's UI at all. Closed by adding the trio to `ScheduledWorkoutInput`, wiring it into both the update and insert calls with a defense-in-depth exclusivity backstop (mirroring `scheduled_workouts_pace_percent_exclusive`), and giving `WorkoutForm` the same `allowPacePercent` UI `ProgramDayForm` already had (`DayVocabularyFields` already supported this mode; no caller had opted in for `scheduled_workouts`). This also required adding the raw, round-tripping `pacePercentBasis/Min/Max` to `CalendarWorkout` (`calendar-types.ts`/`calendar-data.ts`) — without it, an existing percent-target workout would have reopened in the editor showing a blank pace field, since only the *resolved display* value was ever exposed, never the raw one.
- **Found and fixed — two further instances of the same defect class, in functions this finding didn't originally name:** `duplicateScheduledWorkout` and `copyWeek` (both in `schedule/actions.ts`) independently `select()`/`insert()` a workout's day-level and step-level fields to produce a copy, and both omitted the exact same columns as the original bug — meaning duplicating or week-copying a percent-of-pace workout silently produced a copy that had lost its target, a data-loss path this audit hadn't traced. Both fixed the same way.
- **Still open:** there is **no bulk-publish action anywhere in the codebase.** `saveScheduledWorkout` is the *only* function that ever sets `published_at`, one workout at a time via a checkbox in the editor. `duplicateScheduledWorkout`, `copyWeek`, `importTrainingPlanTrack`, and `assign_program_generation` all always write `published_at: null`. `05` §1.2's hidden-by-default-plus-logged-publish-event model is the recommended fix; not started.

Regression coverage: `tests/app/private-coaching-step-fields.test.ts`, 5 tests covering `saveScheduledWorkout` (step-level new/re-save, day-level new), `duplicateScheduledWorkout` (both levels), and `saveTemplate`, following `07` §2's round-trip invariant. Every test was verified to fail red against the pre-fix code before its fix landed, not just written to pass against already-correct code.

**Since then, in the same engagement:** the step-level `IntensityTarget` contract itself (`05` §1.1) is now built (`src/lib/private-coaching/intensity-target.ts`), and `saveScheduledWorkout`/`saveProgramDay`/`saveTemplate` route their step-insert rows through it. This is the structural fix `05` calls for, not another instance-level patch — see `08` Stage 0's progress notes and `07` §1's update for the detail. The day-level contract and the read side remain unbuilt.

Confirmed live, at the time this finding was first written: querying the coach-athlete test pair used for this audit's browser walkthrough (§ `03-ux-audit.md`) returned 8 published `scheduled_workouts` rows, none with `title` set, with `day_label` values like "MLR" and "Fartlek" that imply structured prescriptions — that population's data is no longer at risk from a re-save, duplicate, or week-copy, though it remains true that none of those 8 rows were ever published through anything but the single-workout editor, since no bulk path exists.

### 5.2 `repetitions_max`/`rest_max_s` — fixed

**Closed.** Added in `20260926060000`/`20260926070000`, read in at least 6 places (`programs/actions.ts`, `templates/actions.ts`, `schedule/actions.ts`, `workouts/[workoutId]/page.tsx`, `calendar-data.ts`, `templates/page.tsx`), validated in `lib/validation/private-coaching.ts:39-58`, and — at the time this finding was first written — written by **no application code path**, a fully closed dead loop where a coach could never produce a value these columns would ever hold. All three writers (`saveScheduledWorkout`, `saveTemplate`, `saveProgramDay`) now write both columns. Left in this document, with its original wording preserved above in spirit, as the same kind of point-in-time record `CLAUDE.md` §14 already keeps for the Karvonen HR-formula fix — a defect that was real when found and is no longer live, not silently removed from the record.

### 5.3 Six delete-then-reinsert child-row writes, no transaction

`saveScheduledWorkout` (`schedule/actions.ts:191-255`), `saveTemplate`, `saveProgramDay` (`programs/actions.ts:407-469`), and `setVariantPhases` (`programs/actions.ts:291-303`) all follow the same pattern: DELETE all child rows (steps/extras/phases), then INSERT the new set, as two-to-four separate unguarded PostgREST calls. A failure between the delete and the insert leaves the parent row with **zero** children, silently. None of the six sites checks for this.

### 5.4 Two independent sources of truth for workout status

`scheduled_workout_status` is `scheduled | completed | missed | skipped`. Every write site is enumerated: the DB default (`scheduled`), `assign_program_generation` (literal `scheduled`), and three **unchecked** service-role `.update({status})` calls in `completion-actions.ts` (lines 125, 235, 313 — none checks the returned error). That is the complete list. `missed` and `skipped` are **unreachable enum values**, acknowledged directly in the code (`workout-status.ts:6-11`). Meanwhile every UI surface computes status independently via `computeWorkoutStatus()`, which never reads the `status` column at all — except `coach-home-data.ts:71`, which filters on the raw SQL column as a proxy for "missed," a coupling the file's own comment (`:60-66`) flags as fragile. If any of the three unchecked service-role writes ever fails, the column and the UI's derived status diverge permanently with no error surfaced to anyone.

### 5.5 `reorderPhaseDefinitions` collides with its own unique constraint

`programs/actions.ts:182-198` loops `UPDATE ... SET position = index+1` one row at a time against `unique (program_id, position)` (non-deferrable, `20260925010000`). Any reorder that is not a pure append collides on the first UPDATE and returns an error **mid-loop**, leaving positions partially rewritten. Swapping two adjacent phases is the trivial repro.

### 5.6 Closing a modal is a mutation

`calendar-workout-editor.tsx:110-117` auto-saves an *existing* workout when the backdrop is clicked to dismiss it — a deliberate, commented decision, but one that means "I changed my mind and closed this" and "I want to save this" are the same action for roughly half the interactions this component handles. A *new* (unsaved) workout instead prompts a `window.confirm`. The distinction is not visible to the user before they click.

### 5.7 No revalidation of the pages that most need it

`revalidateTag` is used zero times in the entire domain (path-only revalidation throughout). `revalidatePath` coverage is otherwise reasonable, but `/coaching` (both the coach and athlete home) and `/coaching/athletes/[athleteId]` are **never revalidated by any mutation** — not publishing a workout, not logging a completion, not sending a message, not submitting a check-in — even though `coach-home-data.ts` computes its entire attention feed from exactly that data.

### 5.8 Draft-state leakage

`training_phases` and `training_week_plans` are athlete-visible **regardless of publish state** — unlike `scheduled_workouts`/`_steps`/`_extras`, which correctly gate on `published_at IS NOT NULL`. An unpublished draft phase or week target (name, date range, volume) is visible to the athlete even though the workouts inside it are not — the shape of upcoming training leaks ahead of the content.

## 6. Athlete-side findings

### 6.1 Athletes have no history — confirmed live

`coaching/page.tsx:290-298` queries `scheduled_date >= today`. Once a date passes, the workout becomes unreachable to the athlete: no past-workout view, no completion log, no training history, and no athlete calendar of any kind exists (the only calendar in the product is the coach's, gated to `isPrivateCoach`). This was reproduced directly in the browser walkthrough: the test athlete has 8 real published workouts (two completed) dated Aug 24 – Sep 10, and their own home page reads "No upcoming workouts published right now" because "today" in this environment is Sep 28. See `03-ux-audit.md` for the screenshot.

### 6.2 `/dashboard` is blind to private coaching

`dashboard/page.tsx` contains no reference to `/coaching` and never queries `scheduled_workouts` or `completed_workouts`. Confirmed live: the athlete's `/dashboard` page shows no coaching content at all (mobile screenshot, `03-ux-audit.md`); training-load/ACWR/trend charts there are computed only from the older team/self-serve tables. Strava's "Sync now" button lives exclusively on `/dashboard`, calls `revalidatePath("/plan")` only (never `/coaching`), and its success copy ("Matched N runs to scheduled workouts") describes the team product's fully-automatic matching — private coaching's own Strava path only ever creates a `strava_pending_matches` row pending the athlete's explicit approval, so the copy is factually wrong for exactly the users reading it from `/coaching`.

### 6.3 Fragmented completion and feedback

Three independent completion forms/actions exist across the whole site (private coaching's `completion-form.tsx`/`completion-actions.ts`; the self-serve plan's `workout-card.tsx`/`plan/actions.ts:163`; the team plan's `group-workout-complete-form.tsx`/`plan/actions.ts:351`), with divergent field sets — only the private-coaching one captures pain and activity type. Two separate forms write the same `weekly_checkins` row with different field sets and different week-boundary math (`checkin/actions.ts` vs. `dashboard/weekly-checkin-card.tsx`); only one of them notifies the coach.

### 6.4 Notification coverage is asymmetric and partly fictional

Of the notification types the coaching domain declares, `missed_workout` and `race_approaching` are **never fired** by any code path — `missed_workout` only exists as a read-time attention flag for the coach, never a real notification, despite `prd.md:38` claiming it ships. The coach receives 5 notification types about the athlete; the athlete receives 4 about the coach, and none at all when a coach edits or deletes an already-published workout out from under them.

## 7. Route and surface inventory

### 7.1 No app shell

There is no `layout.tsx` (nor `loading.tsx`/`error.tsx`) anywhere in `coaching/**`, while `/admin`, `/contribute`, `/plan`, and `/coach` each have one. The direct, measurable consequence: the same coach-gate preamble —

```ts
const session = await getAppSession();
if (!session?.isPrivateCoach) redirect("/coaching");
```

— is copy-pasted verbatim into **12 separate page files**. There is no shared navigation, no shared loading state, and no shared error boundary anywhere in the product's most complex surface.

### 7.2 Thirteen-plus ways to create or edit a scheduled workout

Funnelling into 6 distinct server actions: three separate "+ Add" buttons (week/day/month view), two different edit forms chosen automatically by whether `steps.length > 0`, an "Edit full details" escape hatch between them, two separate template-apply code paths (one per form, near-verbatim duplicates), drag-and-drop, a second "Move" date-field UI for the identical reschedule action, duplicate, copy-week, program assignment, and plan import. There is **no one-click "apply this template to this date"** — a template is only reachable from inside one of the two forms.

### 7.3 Interaction model is inconsistent

Exactly two real modals exist on the entire coach surface (the two stacked overlays inside `calendar-workout-editor.tsx`, plus a week-plan quick-edit modal on Month view). Every other editor — phase, plan import, program assignment, week-plan, program-day, template — is an inline panel that replaces the button that opened it. Neither pattern is used consistently by section or by task type; it appears to be per-component habit rather than a decision.

### 7.4 Copy-paste is the dominant code-reuse mechanism

The step-row → `StepInput` mapping (an ~18-field snake→camel transform) is independently reimplemented **6 times**. The extras select-column string appears **10 times**. `applyTemplate`/`handleSubmit` in `quick-create-panel.tsx` and `workout-form.tsx` are near-verbatim twins, acknowledged in both files' own comments. The `coach_extra_presets` fetch-and-map appears 4 times.

### 7.5 A hidden two-tier feature

`/coaching/pace-zones` is gated on the *coach's own email* being in a hardcoded `ADMIN_EMAILS` allowlist (`admin-coach-access.ts:19-33`) — a real, shipped tool invisible to every athlete of every coach who isn't an admin account. This is a genuine product inconsistency, not a placeholder: the component behind the gate (`athlete-pace-zone-table.tsx`) is the largest single component in the coaching codebase at 628 lines.

### 7.6 Layering violations

`components/private-coaching/extras-editor.tsx` imports a server action out of a dynamic route segment (`@/app/(app)/(protected)/coaching/athletes/[athleteId]/schedule/actions`); program and template authoring similarly import `ExtraPresetOption` from the athlete-schedule route tree. A rename of that route folder would silently break unrelated authoring surfaces.

## 8. Business logic — `src/lib/private-coaching/`

19 files, ~2,700 LOC. 15 of 19 are pure functions with real unit-test coverage; 4 touch the database directly, each doing exactly one read before handing off to a pure resolver (`fitness-estimates.ts`, `goal-race.ts`, `pace-reference.ts`, `admin-coach-access.ts`). This layer is, on its own, well-factored — the defects in this audit live almost entirely in the *route/action* layer that calls into it, not in this layer itself.

Relationship to `src/lib/coaching-engine/` (the older, self-serve engine): genuinely parallel, not duplicated in the sense of conflicting — private coaching never writes tables the engine owns. But four *near*-duplications exist and are worth naming: three independent implementations of `addDays` (`coaching-engine/date-utils.ts`, `src/lib/week.ts`, `training-phases.ts::mondaysInRange`); four separate "turn a plan into dated rows" engines (`coaching-engine/plan-generator.ts`, `private-coaching/program-generation.ts`, `private-coaching/plan-import.ts`, `training-plans/template.ts` — the last of which is where the peak-mileage-scaling mechanism found and disabled for Canyon earlier in this engagement actually originated, built for an older import format where only easy-day mileage scaled and pace-based quality sessions explicitly did not); and three ways to resolve a pace from a reference time (`coaching-engine/pace-zones.ts`, `pace-zone-table-math.ts`, `fitness-estimates.ts::resolvePacePercent`).

## 9. Test coverage

Strong on pure logic (16 files under `tests/lib/private-coaching/`, ~253 assertions covering essentially every pure module in §8) and on RLS policy behavior (18 files under `tests/rls/`, ~151 assertions, run against a locally-provisioned Postgres 17 — see `07-testing-strategy.md` for exact requirements).

**Zero tests exist for any server action.** A mocked-Supabase harness already exists and is used elsewhere in the codebase (`tests/app/supabase-test-utils.ts`, used for `conversion-actions`, `knowledge-check-actions`, `learning-actions`) but has never been applied to a single coaching action. Concretely untested: `saveScheduledWorkout` (including the field-dropping defect in §5.1), `copyWeek`, `shiftPhaseDates`, `rescalePhaseMileage`, `clearPhaseTraining`/`clearAllTraining` (destructive, unbounded), `importTrainingPlanTrack`, `reorderPhaseDefinitions` (the constraint collision in §5.5), and — most significantly — **the entire completion/status state machine** (`completeScheduledWorkout`, `approveStravaMatch`, `deleteWorkoutCompletion`). `handle_new_user()`'s invite-redemption trigger is exercised nowhere; `tests/rls/invite-lifecycle.test.ts` tests the table's policies, not the trigger's logic, and the trigger has its own real bug (§10).

## 10. Miscellaneous confirmed defects

- `handle_new_user()` (`20260825070000`) selects a matching invite with `limit 1` and no `order by` — with two live invites for the same email from different coaches, which one wins is nondeterministic, and the other is left dangling permanently.
- The private-coaching invite's "Sign up" link (`coaching-invite/[token]/page.tsx:52-57`) is a bare `href="/signup"` with no token or email passthrough, unlike the older team `coach_invites` flow, which does prefill. An invited athlete must retype the exact invited email address or the auto-redemption trigger silently never fires.
- `roster/actions.ts:81` and `create-notification.ts:60` both look up a user by email via `listUsers({ perPage: 1000/500 })` plus an in-memory filter — an O(n) scan that silently stops working past that many total users on the site.
- `program_duration_variants` has no constraint enforcing at most one `is_default = true` per program.
- `program_variant_phases` has no DB-level guarantee that a variant and the phase definition it references belong to the same program — enforced only in application code, re-checked defensively in the RPC.

## 11. The two-product boundary

`/coaching` (this document's subject) and `/coach` (team/group coaching — roster, groups, seasons) are **separate products sharing almost nothing**: different session flags (`isPrivateCoach` vs. `isCoach`), different prescription tables (`scheduled_workouts` vs. `workouts`/`group_plan_workouts`), different completion tables (`completed_workouts` vs. `workout_completions`), no shared components, no shared route tree. `/plan` (the self-serve individual athlete experience) is hard-gated to `isAthlete` (team membership) and is **unreachable by a privately-coached athlete who isn't also on a team** — meaning the AI "explain this workout"/"adapt this workout" tooling that exists for self-serve athletes has no private-coaching counterpart at all, by routing accident rather than product decision.

`04-target-product-experience.md` states the recommended relationship between the two products going forward; this document only establishes that today they are, in every practical sense, two different applications that happen to share a login.
