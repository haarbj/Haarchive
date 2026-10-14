# 07 — Testing Strategy

This document owns proof: the test architecture, the invariants specified in `05-target-architecture.md`, and the actual results of every test suite run during this audit. No result below is claimed without having been run in this session.

---

## 1. Actual results, this session

All commands run against the working tree at the conclusion of this audit, from the repo root, with `NODE_ENV=development` set explicitly (the default shell environment had `NODE_ENV=production`, which silently skips devDependency installation and was the root cause of a separate tooling failure earlier in this engagement — worth noting here since it's exactly the kind of environment assumption a testing strategy should not leave implicit).

| Command | Result |
|---|---|
| `npm run test` (unit + integration, Vitest) | **158 test files, 1833 tests passed, 1 expected fail**, at the time this table was first written. Clean. |
| `npx tsc --noEmit -p .` | **Clean, zero errors.** |
| `npx eslint src/app/(app)/(protected)/coaching --max-warnings 999` | **Clean, zero warnings, on the coaching tree specifically.** |
| `npm run test:rls:up` (first attempt) | **Failed** — a stale `.rls-test-db/pgdata` directory left over from a prior, unrelated session caused a migration-replay error unrelated to the coaching schema (`group_plan_workouts_pace_per_mile.sql`, a team-product migration, failed against already-partially-applied state). |
| `npm run test:rls:up` (after `rm -rf .rls-test-db` and retry) | **Succeeded.** Local Postgres 17 (Homebrew, `/opt/homebrew/opt/postgresql@17/bin`) provisioned at `postgres://postgres@127.0.0.1:55432/haarchive_rls_test`, all migrations through `20260926070000` applied cleanly. |
| `npm run test:rls` | **18 test files, 141 tests passed.** Clean. |
| `npm run test:rls:down` | Torn down cleanly after verification. |

**Take away from the failed-then-succeeded RLS run, stated plainly for whoever implements next:** the harness is real and works, but it is not idempotent against its own leftover state from a previous invocation — `npm run test:rls:up` should be preceded by a clean teardown if it was ever interrupted mid-run, not assumed to be safe to re-run blind. This is a real, encountered rough edge, not a hypothetical one.

**The existing suite is a genuine asset.** 1833 unit/integration tests and 141 RLS tests passing cleanly, entirely unrelated to the defects found in this audit, confirms the problem is not "this codebase doesn't test things" — it's specifically that testing was never extended to the server-action layer (§3 below), even though the discipline and the tooling to do so already exist and already work.

**Update, first Stage 0 implementation session:** `tests/app/private-coaching-step-fields.test.ts` is the first test against this server-action layer, following exactly the priority and shape §3 below specifies — the mocked-Supabase harness (`tests/app/supabase-test-utils.ts`, extended with `.update()`/`.delete()` support for this) applied to `saveScheduledWorkout` (step-level new/re-save, day-level new), `duplicateScheduledWorkout` (both levels), `saveTemplate`, and `saveProgramDay`'s step writes — 5 tests, asserting the round-trip invariant from §2 for `pace_percent_basis/min/max` (day), `target_pace_percent_basis/min/max` (step), and `repetitions_max`/`rest_max_s`. Every test was verified to fail red against the pre-fix code (the relevant fields manually stripped, the suite rerun, then restored) before being left in place as permanent regression coverage — not just written to pass against already-correct code; this caught two further instances of the same defect (`duplicateScheduledWorkout`, `copyWeek`) that weren't in the original D1/D2 citation. Full suite at that point: **159 test files, 1838 tests passed, 1 expected fail.** This is the fix named in `01` §5.1/§5.2 and item 3 of §3's priority list below, for every field-level data-loss instance found so far.

**Update, same session, next increment:** the `IntensityTarget` contract itself (`05` §1.1) is now built for the step level — `src/lib/private-coaching/intensity-target.ts`, the exact 9-mode union plus one serialize/deserialize pair, with `tests/lib/private-coaching/intensity-target.test.ts` (12 tests) satisfying this section's own round-trip invariant directly: every mode, the two-simultaneous-signals case a real interval step needs, and a discovered self-healing normalization property. `saveScheduledWorkout`/`saveProgramDay`/`saveTemplate` now build their step inserts through this contract instead of hand-listing columns, which is what makes the fix structural rather than per-instance — confirmed by deliberately breaking the shared function and watching both the new unit tests and the existing server-action tests fail together, then restoring. Full suite now **160 test files, 1850 tests passed, 1 expected fail.**

**Still not built:** the day-level contract (`scheduled_workouts`/`workout_templates`/`program_days`), the read side (`calendar-data.ts`, the workout detail page, and `summarizeStep` each still reconstruct a step's prescription their own way rather than through a shared deserializer), and the one-level step tree with its own nested-workout round-trip fixture. See `08` Stage 0 for the current item list.

## 2. Required invariants (from `05-target-architecture.md`)

These become concrete test suites once the target architecture is implemented — listed here as the contract implementation must satisfy, each traced to the defect it closes.

### Prescription round-trip (closes D1, D2)

Every `IntensityTarget` mode (`05` §1.1) survives, unchanged, through the full lifecycle: create → persist → fetch → edit (re-save without touching the field) → template/program assignment → render (the single `IntensityTargetSummary`, `06` §4) → duplicate/copy. Concretely: a parameterized test over all 9 modes, asserting the value read back after each lifecycle step equals the value written, run for every entity type that carries a prescription (`workout_assignment`, its step children, `training_program`'s equivalent). This single suite, run today against `saveScheduledWorkout`, would have caught D1 before it shipped — it is the highest-leverage test in this entire document.

**Include structure, not just targets.** Per `05` §1.1's revised step model, the round-trip fixture set must include a nested workout ("2 sets of 6 × 500m with 30s rest, 3 min between sets"), asserting the set boundary and the between-set recovery both survive every lifecycle step. Today's flat model cannot represent that fixture at all, which is the point: the test should be written first and fail, then pass once the tree model lands.

### Mutation semantics (closes D6)

Dismissing a workout panel (backdrop click, Escape, navigating away) never produces a network write. A parameterized test opens the editor, makes no explicit save action, and asserts zero mutating requests fired. Explicit saves always resolve to a visible success or failure state, never a silent no-op.

### State transitions (closes D4)

Only the transitions in `05` §3's two state diagrams are reachable, and only by the correct role: a coach cannot transition a `workout_log`'s `outcome`; an athlete cannot transition a `workout_assignment`'s `status` past what their role permits. Every currently-unreachable enum value (`missed`, `skipped` as stored states) should have no corresponding test at all post-migration, since `05` §2.3 makes them derived, not stored — their *absence* from the schema is itself verifiable.

### Revision integrity

A material edit to published work always produces exactly one new revision row with `before`, `after`, `reason` (non-empty for material changes), `author`, and `timestamp` populated; the assignment's own row reflects `after`; no revision row is ever updated or deleted once written (append-only, verified by attempting an UPDATE/DELETE against a revision row and asserting it is rejected — mirroring how `workout_comments`' existing immutability is presumably already covered, worth confirming it actually is rather than assumed).

### Authorization (extends the existing 141-test RLS suite)

Every read/write scoped by user and active relationship, explicitly including the **ended**-relationship case (`05` §5 — flagged there as not independently re-verified in this audit and needing a direct test). New tables from `05` (`external_activity`, the `training_phases` status column, revision rows) each need the same RLS test shape the existing 18 files already establish — this is additive to a working pattern, not new design.

### Atomicity (closes D5, D7)

Every multi-row operation (`05` §4) either completes fully or leaves no partial state. Concretely: inject a failure partway through a steps/extras write (a test-only fault-injection point, or simply asserting the operation is wrapped in a transaction and testing Postgres's own rollback behavior directly) and assert the parent row's children are unchanged from before the attempt — not partially deleted, not partially inserted. For the phase-reorder fix specifically (D7): a test that reorders two adjacent phases (the exact trivial repro `01` §5.5 identifies) and asserts it succeeds in one atomic operation, not a loop that can fail mid-way.

## 3. What must be added — the server-action gap

The single most important testing-strategy change this audit recommends: **apply the mocked-Supabase harness that already exists (`tests/app/supabase-test-utils.ts`, already used for `conversion-actions`, `knowledge-check-actions`, `learning-actions`) to every coaching server action.** This is not a new capability to build — it is a working pattern, proven elsewhere in this exact codebase, that has simply never been pointed at this domain. Priority order, matching defect severity:

1. The completion/status state machine (`completeScheduledWorkout`, `approveStravaMatch`, `deleteWorkoutCompletion`) — currently the *only* place `scheduled_workout_status` is written, and currently the least tested code in the entire coaching domain relative to its importance.
2. The new publish/revise actions from `05` §1.2 — these don't exist yet, so they should be built test-first against the invariants in §2 above, rather than tested after the fact the way the current codebase's actions were not tested at all.
3. `saveScheduledWorkout`'s replacement (the transactional steps/extras write) — a direct regression test for D1/D5 using the round-trip invariant.
4. Program assignment (`assignProgramToAthlete`) end-to-end — generate a program, assign it, and assert every field authored in `program_days`/`program_day_steps` survives into the resulting `scheduled_workouts`/`_steps`. This is the exact test that would have caught the RPC-payload defect fixed earlier in this engagement, and should exist so it cannot regress silently again.
5. Invite redemption, specifically the `handle_new_user()` trigger path (currently exercised by no test — `tests/rls/invite-lifecycle.test.ts` tests the table's RLS policies, not the trigger's own matching logic, including the nondeterministic `limit 1` / no `order by` bug noted in `01` §10).

## 4. One real end-to-end training week

Per the plan's own completion gate: before any of the above is considered sufficient, one test (or one manually-executed, recorded scenario, if a full E2E harness isn't justified yet at this stage) walks the entire loop for one coach and one athlete — compose a week, publish it, log a completion, leave feedback, review it, revise a future workout — and asserts every step of `04-target-product-experience.md`'s two six-step paths actually holds. This is the acceptance test named in the Reconciliation Memo (`08-implementation-roadmap.md` Stage 1) and should be the literal release gate before Stage 2 work begins, not a nice-to-have.

## 5. Method note

This document does not claim the invariants in §2 are currently implemented or passing — they describe what `05-target-architecture.md`'s design must satisfy once built, derived directly from the defects `01`/`03` verified. Only §1's results were actually executed in this session; everything else in this document is a specification for future test-writing, clearly distinguished as such.
