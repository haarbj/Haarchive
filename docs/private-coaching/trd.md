# Private Coaching — Technical Requirements Document

Companion to `prd.md` in this directory. Describes what was actually built, how, and why — not aspirational architecture. All work is in the `haarbj/Haarchive` repo, on top of the existing Next.js 16 / React 19 / Supabase stack described in the repo's own `CLAUDE.md`.

## 1. Architectural decision: decoupled from the existing team-coaching product

The repo already has a full HS-team coaching product (`teams`/`team_memberships`/`groups`/`season_plans`/`group_plan_workouts`). Private coaching does **not** extend it — it's a parallel set of tables and RLS policies, sharing only the genuinely product-agnostic tables (`profiles`, `goals`, `race_results`, `injuries`, `athlete_profiles`, `weekly_checkins`, `notifications`, `connected_accounts`). A user could theoretically be both a team athlete and a privately-coached athlete without conflict.

Rationale: the team product's coach access is all-or-nothing at the team level (any coach on a team sees every athlete on it); private coaching needed a real per-pair relationship. Force-fitting that into `team_memberships` would have meant either a fake one-athlete-per-team hack or loosening the team product's own access model. A new, small relationship table (`coach_athletes`) was cheaper and safer than either.

## 2. Data model

11 new tables (`supabase/migrations/20260825010000` through `20260825070000`), plus additive columns/policies on 5 existing tables. Full DDL is in the migration files; summary:

| Table | Purpose |
|---|---|
| `coach_athletes` | The relationship itself: `coach_id`, `athlete_id`, `status` (active/ended), `started_at`/`ended_at`. Partial unique index allows exactly one active pairing per (coach, athlete) while preserving historical rows for transfers/re-engagement. |
| `coach_athlete_invites` | Email+token invite, mirrors the existing `coach_invites` shape exactly. Zero RLS policies (deny-all) — redemption is service-role-mediated only. |
| `workout_templates` / `workout_template_steps` | Coach's reusable library. Steps are a real child table (warmup/main/interval/recovery/cooldown × pace/HR/power/RPE/duration/distance/open target), not a JSON blob. |
| `scheduled_workouts` / `scheduled_workout_steps` | A workout assigned to one athlete on one date. Steps are copied from the template at assignment time (or authored directly), not a live reference — so a later template edit never retroactively changes an already-assigned workout, and `@athlete.*` variables resolve exactly once, at copy time. |
| `completed_workouts` | The athlete's own report: actual distance/duration/HR/RPE, pain flag + notes, free-text notes, `strava_activity_id`. One row per scheduled workout (unique FK). |
| `workout_comments` | Threaded, attached to one `scheduled_workouts` row — not the general message thread. |
| `coach_athlete_messages` | The general 1:1 conversation, scoped to one `coach_athletes` relationship. |
| `athlete_metrics` | EAV-style store (`key`, `value`, `unit`, `effective_from`/`to`, `source`) behind the `@athlete.<key>` variable system. No UI to populate it yet — architecture only, per the PRD's explicit deferral. |
| `audit_log` | Flat, generic (`actor_id`, `action`, `entity_type`, `entity_id`, `metadata jsonb`). Service-role-only, no read UI yet. |

Extended existing tables: `weekly_checkins` gained `overall_feel`, `pain`, `pain_notes`, `biggest_positive`, `biggest_concern`, `schedule_constraints` (all nullable — the existing self-serve dashboard card is unaffected). `content_permission` enum gained `private_coach`.

## 3. Row-Level Security

Every new table follows the exact pattern already established by the team product's own `coach_athlete_rls.sql`: a `security definer stable` helper function (`coaches_this_athlete(athlete_id)`, distinct from the team product's own `coaches_athlete()`) checks for an active `coach_athletes` row, and every coach-facing policy is additive to (never a replacement for) the athlete's own owner-only policies — Postgres ORs permissive policies for the same command, so nothing an athlete already had access to is ever narrowed.

One real architectural constraint discovered and worked around twice (Phase 4's completion action, Phase 8's Strava sync extension): `scheduled_workouts` intentionally has no athlete UPDATE policy at all (only the authoring coach can write to it — an athlete-writable policy would also let them rewrite the coach's own title/notes, not just status). Flipping `status` to `completed` after an athlete logs a workout therefore goes through the service-role client, gated by an RLS-scoped read that already proved the caller owns that workout. This is documented inline at both call sites so it doesn't read as an accidental privilege escalation later.

**Resolved, previously a known gap:** Docker/`supabase start` is still unavailable in this project's dev environment, so a standalone Postgres 17 + minimal Supabase-platform shim (roles, `auth.uid()`/`auth.role()`, `auth.users`) was built instead — see `tests/rls/README.md`. All 54 migrations, including all 7 private-coaching ones, apply cleanly in order against it, and the adversarial matrix (coach isolation, athlete isolation, messaging, relationship revocation, invite lifecycle, service-role boundary, plus a regression test per originally-found audit finding — 53 tests total) passes against real Postgres RLS, not mocked or statically reasoned about. Run it with `npm run test:rls:up && npm run test:rls`. What it still doesn't cover: the real Supabase Auth/PostgREST/Storage/Realtime stack itself (see that README's own "what this deliberately does not do" section) — that gap is closed by the staging deploy, not by this harness. Per this repo's own established convention (see the still-unapplied four-domain-category-backfill migration), `npx supabase db push` has still deliberately **not** been run against any remote project — that step is staging, next.

## 4. Workout model vs. the existing coaching-engine

The existing `src/lib/coaching-engine/` (`WorkoutPrescription`) is a closed, kind-specific discriminated union with no generic step list and no HR/power/RPE-as-target support — it doesn't fit the brief's explicit step/target requirements. Rather than force a reuse, private coaching has its own types (`src/lib/private-coaching/steps.ts`), reusing only what genuinely transfers: the existing `workout_type` enum, date-utility functions (`addDays`), and the "AI narrates/adapts engine output, never invents numbers" guardrail pattern (not otherwise used in this MVP — no AI feature was built here).

`@athlete.<key>` resolution (`resolveAthleteVariables`) is a pure function, fully unit-tested, wired into the one place resolution should happen: the moment a workout is scheduled (`saveScheduledWorkout`), whether from a template or authored from scratch.

## 5. Coach Home / attention triage

`computeAttentionFlags()` (`src/lib/private-coaching/attention.ts`) is a pure function over a plain per-athlete signal summary (missed-workout count, recent pain-report count, high-RPE count, unread-message count, has-current-week-checkin, days-since-relationship-started) — fully unit-tested (13 cases), independent of any Supabase call. The page component (`coaching/coach-home-data.ts`) is a thin "batch-fetch signals across the whole roster, call the pure function per athlete, render" shell. All fetches are batched with `.in(athleteIds)` and grouped in memory, not one query per athlete — same discipline the existing `admin/users/page.tsx` already uses.

"Missed workout" is computed at read time (`scheduled_date < today AND status = 'scheduled'`), not via a scheduled/cron job flipping status — deliberately, to avoid introducing any background-job infrastructure for an MVP-scale need.

## 6. Messaging and notifications

No Realtime/WebSocket usage — this repo has never used Supabase Realtime, and introducing it for this feature would be new operational surface for no MVP-required gain. Messaging polls every 15s (matching, at a shorter interval, the existing 45s notification-bell precedent); the sender's own message is force-refreshed immediately after send rather than waiting for the next poll tick.

`NotificationType` gained the exact 8 values specified in the product brief; `notificationHref()` routes them all. `notifications` itself needed zero migration — it was already a fully generic `(user_id, type text, content, read_at, related_entity_id)` table with no DB-level enum constraint.

## 7. Activity integration (Strava)

Extended (not duplicated) the existing `dashboard/strava-actions.ts` sync with a third matching branch alongside its existing two (self-serve `workouts`, team `group_plan_workouts`): match a synced activity to a `scheduled_workouts` row by date. Unlike the other two branches, this one does not write to `completed_workouts` directly — per explicit product direction, Strava only ever suggests data. The match is upserted into `strava_pending_matches` (new table, athlete-only RLS, no coach SELECT policy at all), and the athlete reviews it on the workout's own page (`StravaMatchReview`) before explicitly approving it. Approving (`approveStravaMatch` in `completion-actions.ts`) is what actually writes `completed_workouts` with `strava_activity_id` set, flips status via the same service-role pattern as §3, and fires the coach notification — mirroring the manual-completion path exactly, so a Strava-approved completion is indistinguishable from a manual one from that point on, including being editable afterward through the same `CompletionForm` (now supports editing an existing completion, not just undoing it). `strava_pending_matches` is the actual consent gate, not an RLS policy on `completed_workouts` itself: nothing reaches the table a coach can read until the athlete acts.

The abstraction the brief asks for ("do not couple the whole app directly to Strava") already exists one level up: `connected_accounts.provider` is a real enum (`garmin|strava|coros|apple_health`) with encrypted token storage, and Strava-specific I/O/mapping code is isolated in `src/lib/strava/`. No new `integrations/` directory structure was built, since Garmin/Coros/Apple Health have zero working implementation to abstract *from* today — building empty scaffolding for them would be speculative, not decoupling.

**Known limitation, inherited not introduced:** `completed_workouts.strava_activity_id` is Strava-specific by column name, mirroring `workout_completions.strava_activity_id`'s existing naming. A real second provider would need a schema addition (e.g. `external_provider` + `external_activity_id`) at that point — flagged for whenever a second provider is actually built, not fixed speculatively now.

## 8. Testing

Followed the existing `tests/` convention exactly (mirrors `src/lib/`, Vitest, `describe`/`it`). New pure-logic test files: `tests/lib/private-coaching/invites.test.ts`, `steps.test.ts`, `attention.test.ts`, plus extensions to `tests/lib/auth/permissions.test.ts`, `tests/lib/auth/workspaces.test.ts`, `tests/lib/admin/user-filters.test.ts`, `tests/validation/user-permissions.test.ts`, `tests/lib/notifications/notification-href.test.ts`.

**Known gap, stated plainly:** the coaching product's own Server Actions (invite/accept, schedule/save, complete, message, check-in) are not integration-tested. The existing scripted-mock convention (`tests/app/supabase-test-utils.ts`) was built for a single-client, linear call sequence; these actions call `getAppSession()` (itself 3 queries) plus a service-role client, which doesn't fit that harness without a materially larger investment than was proportionate to build fresh in this pass. The pure logic each action depends on (expiry/matching, step summarization/variable resolution, attention triage) is tested directly instead. A future pass building genuine RLS/integration test infrastructure (this repo's first) would close both this gap and §3's.

`tsc --noEmit`, `eslint`, `npm run build`, and the full `vitest` suite were run clean after every phase in this build (134 test files, 1425 passing, 1 pre-existing expected fail, at the end of Phase 9).

## Infrastructure Cost Model

*(Pricing below reflects general knowledge of Supabase/Vercel free-tier structure as of this writing and should be re-verified against current published pricing before being treated as authoritative — it is not independently re-checked here.)*

**Vercel:** every new route is server-rendered on demand (`ƒ` in the build output) inside the existing app/deployment — no new project, no new domain, no separate build. Incremental cost is additional function invocations and bandwidth from real usage. At coach-scale traffic (a handful of coaches, each with a handful of athletes, checking in a few times a day), this is a rounding error against whatever the site's existing traffic already consumes.

**Supabase — database:** 11 new tables, all in the existing project. Row growth is bounded by real usage (one `scheduled_workouts` row per assigned workout, one `completed_workouts` row per completion, message/comment rows per conversation) — nothing here writes at a volume that would meaningfully move a Postgres instance's storage footprint at MVP scale (dozens to low hundreds of athletes, not thousands). No pruning/archival was built; not a concern yet.

**Supabase — auth:** no change. Coaches and athletes are the same `auth.users`/`profiles` rows every other feature on the site already uses.

**Supabase — storage:** none used by this feature. No new file/image storage.

**Notifications:** reuses the existing `notifications` table and polling UI — zero incremental infrastructure, just more rows in an already-existing table.

**External APIs:** Strava's API is free for this usage pattern (personal/small-scale OAuth integration, well under any rate-limit tier that would require a paid plan) — this MVP only extended existing, already-working Strava calls, adding no new API surface or account.

**What would create real cost, and at what threshold:**
- **Transactional email**, if ever added for invites/notifications instead of copy-link: Resend's free tier (3,000 emails/month as of general public pricing at time of writing, needs re-verification) would very likely cover this product at any realistic near-term scale; cost only becomes relevant far beyond what a single coach's roster would generate.
- **Supabase plan tier**, if the project's overall database size or bandwidth (across *all* Haarchive features, not just this one) crosses the current plan's included allowance — this feature's own marginal contribution to that is small, but it's additive to whatever headroom already exists.
- **Vercel plan tier**, similarly, only relevant if overall site traffic (not this feature specifically) grows enough to matter.

No feature in this MVP was excluded from what's described in the PRD *because* of a cost threshold being hit — everything built stays comfortably inside free/already-paid-for infrastructure at the scale this product is actually expected to run at.
