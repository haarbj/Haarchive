# Coaching Platform Audit — working checklist

Working file, not a deliverable. Tracks progress and holds raw findings until they land in an owning document. Delete or archive when the audit is complete.

Scope, constraints, and the deliverable crosswalk live in the approved plan. Single source of truth for conclusions: the numbered documents in this directory.

## Stage A — Codebase forensics

- [x] Coach-surface inventory (routes, components, actions, duplication)
- [x] Athlete-surface inventory (+ communication, notifications, Strava)
- [x] Schema inventory, status state machine, transaction audit, test coverage
- [ ] Hand-trace: the six prescription modes end-to-end across all 6 tables
- [ ] Hand-trace: every multi-row write lacking a transaction (confirm agent list)
- [ ] Reconcile the three agent reports into `01-current-architecture.md`

## Stage B — Browser UX audit

- [ ] Install Playwright + chromium
- [ ] Staging auth via service-role magic link
- [ ] Coach path: connect → understand → compose → publish → review → adapt
- [ ] Athlete path: orient → perform → record → explain → receive → continue
- [ ] Desktop + mobile viewports, screenshots captured
- [ ] Reproduce defect 1 (publish strips prescription data)
- [ ] Reproduce defect 3 (athlete has no history)
- [ ] Reproduce defect 6 (backdrop click saves)
- [ ] Click counts / reloads / hidden saves recorded per task

## Stage C — Competitive research

- [x] TrainingPeaks + Final Surge (deep)
- [x] Other direct competitors (verify each still exists — Today's Plan confirmed dead 2024; CoachNow and Runna out of category)
- [x] Tier 2 UX references
- [x] Test memo hypotheses: week publishing · review queue · copy semantics — all three resolved
- [x] Comparison matrix

## Stage D — Synthesis

- [ ] Reconciliation 1: canonical lossless prescription contract
- [ ] Reconciliation 2: saved / published / revised semantics
- [ ] Reconciliation 3: `/coaching` vs `/coach` boundary
- [ ] Resolve 4 blueprint↔schema tensions (plan container · external_activity · status split · notification rule)
- [ ] Stage D integration checklist (see plan) satisfied

## Stage E — Deliverables

- [x] `00-executive-summary.md`
- [x] `01-current-architecture.md`
- [x] `02-competitive-research.md` (narrower than planned — Stage C subagents rate-limited; done directly instead)
- [x] `03-ux-audit.md`
- [x] `04-target-product-experience.md`
- [x] `05-target-architecture.md`
- [x] `06-design-system.md`
- [x] `07-testing-strategy.md`
- [x] `08-implementation-roadmap.md`
- [x] `09-evidence-and-open-questions.md`

**Audit complete.** This checklist file is working scratch, not a deliverable — safe to delete once reviewed. `scripts/audit/` holds the Playwright auth/walkthrough scripts used to produce the screenshots in `screenshots/`; also working artifacts, not part of the app.

## Note on Stage C

Initially cut short — all three research passes hit a session rate limit before returning, and a narrower version was completed directly rather than backfilled with invented detail. **Since re-run to completion.** `02` was rewritten from the full sweep and now supersedes that narrower draft; the limitation notes in `00` and `09` were revised accordingly rather than left standing.

**Documents changed by the completed research, for anyone diffing:**

| Doc | Change |
|---|---|
| `02` | Rewritten in full |
| `05` §1.1 | Step model becomes a one-level tree; new requirement to freeze resolved target values at publish |
| `05` §1.2 | Publication model reversed twice, landing on hidden-by-default + logged publish event; new invariant on non-retractable acted-on intent |
| `04` §2.4 | Rewritten to match the publication model |
| `04` §2.5 | Review surface reversed from roster signal to a needs-review list |
| `06` §2.2, §3.2, §3.2a (new), §3.3, §3.4 (new) | Draft/published treatment, mobile calendar, edit-surface decision rule, unsaved-changes rule |
| `07` §2 | Nested-workout fixture added to the round-trip invariant |
| `08` Stage 0 | Step-tree item added |
| `00`, `09` | Limitation notes replaced; two reversals recorded |

## Verification

- [ ] `npm run test` — actual result recorded
- [ ] `npx tsc --noEmit` — actual result recorded
- [ ] `npm run lint` — actual result recorded
- [ ] `npm run test:rls` — attempted; result or documented blocker

## Confirmed defects carried from Stage A

Numbering is stable; `03-ux-audit.md` and `09-evidence-and-open-questions.md` both reference these IDs.

| # | Defect | Evidence | Status |
|---|---|---|---|
| D1 | Publish path never writes `pace_percent_*` (day), `target_pace_percent_*` (step), `repetitions_max`, `rest_max_s`; no bulk-publish exists | `schedule/actions.ts:163-249` | **All field-level data loss fixed** (day + step, plus 2 more instances found in `duplicateScheduledWorkout`/`copyWeek`) — `01` §5.1. Bulk-publish alone remains open. |
| D2 | `repetitions_max`/`rest_max_s` read in 6 places, written by no app code | `programs/actions.ts:431-450`, `templates/actions.ts`, `schedule/actions.ts:230-249` | **Fixed** (`01` §5.2) — all three writers now write both columns, regression-tested |
| D3 | Athletes have no history; no athlete calendar | `coaching/page.tsx:290-298` (`>= today`) | Code-verified |
| D4 | Two sources of truth for status; `missed`/`skipped` unreachable | `workout-status.ts:6-11`, `coach-home-data.ts:71`, `completion-actions.ts:125,235,313` | Code-verified |
| D5 | Six delete-then-reinsert child writes without a transaction | `schedule/actions.ts:191-255`, `templates/actions.ts`, `programs/actions.ts:407-469,291-303` | Code-verified |
| D6 | Backdrop click auto-saves an existing workout | `calendar-workout-editor.tsx:110-117` | Code-verified |
| D7 | `reorderPhaseDefinitions` collides with `unique (program_id, position)` | `programs/actions.ts:182-198` | Code-verified |
| D8 | `/coaching` and `/coaching/athletes/[id]` never revalidated by any mutation | revalidatePath audit | Code-verified |
| D9 | `training_phases`/`training_week_plans` athlete-visible regardless of publish | `20260826080000`, `20260826150000` RLS | Code-verified |
| D10 | `/dashboard` blind to private coaching; Strava sync copy wrong, revalidates `/plan` only | `dashboard/strava-actions.ts:195`, `sync-strava-button.tsx:25-29` | Code-verified |
| D11 | Zero server-action tests, including the status state machine | `tests/` inventory | Code-verified |
| D12 | Near-zero responsive classes; week calendar `min-w-[1100px]`; self-coached users routed to it | `week-calendar.tsx:154-155` | Code-verified |
| D13 | `/coaching/pace-zones` gated on the coach's email being in `ADMIN_EMAILS` | `admin-coach-access.ts:19-33` | Code-verified |
| D14 | No `layout.tsx` in the coaching tree → coach gate copy-pasted into 12 pages | route inventory | Code-verified |
| D15 | Two check-in forms write one `weekly_checkins` row with different field sets | `checkin/actions.ts`, `dashboard/weekly-checkin-card.tsx` | Code-verified |
| D16 | `missed_workout` notification declared and routed but never fired; PRD claims it ships | `types.ts:27`, `prd.md:38` | Code-verified |
| D17 | Private-coaching invite signup link carries no token/email; athlete must retype exact email or trigger silently fails | `coaching-invite/[token]/page.tsx:52-57` | Code-verified |
| D18 | `handle_new_user()` picks an invite with `limit 1` and no `order by` — nondeterministic with two live invites | `20260825070000` | Code-verified |
