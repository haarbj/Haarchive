# Private Coaching — Product Requirements Document

**Status:** MVP built (Phases 0–9 complete, this session). Not yet applied to production database or launched to real coaches/athletes.

## 1. What this is

A private, 1-on-1 remote coaching product inside The Haarchive, alongside (not replacing) the existing free content library and the existing HS-team group-coaching tool. A coach manages a roster of individually-programmed athletes; each athlete gets their own calendar, workouts, and a direct line to their coach.

**It is free**, indefinitely, with no monetization built into this MVP. See §6.

## 2. Who it's for

- **Coaches**: initially Brody Haar, and whoever else Brody explicitly grants "Private Coach" access to (admin-gated, not self-service — see §5). Coaching more than one athlete individually, remotely, without another tool.
- **Athletes**: runners invited by a coach they already have a real coaching relationship with. Not a marketplace — an athlete cannot browse or request a coach.

## 3. The core loop this product optimizes

```
Coach prescribes → athlete executes → data comes back →
athlete provides feedback → coach reviews → coach responds/adjusts → next workout
```

Every feature below exists to make one step of this loop better. Nothing was built because a competitor has it.

## 4. What shipped (MVP scope)

### Coach
- Roster: invite an athlete by email (copy-link, no email infra — see §6), see pending invites, remove an athlete (soft-end, keeps history).
- Athlete profile view: read-only view of the athlete's existing profile, active goals, recent race results, active injuries, latest weekly check-in — all reused from data the athlete already enters in Settings, not a second profile system.
- Workout templates: a reusable library, each with structured steps (warmup/main/interval/recovery/cooldown), each step with a target (pace/heart rate/power/RPE/duration/distance/open).
- Scheduling: assign a workout (from a template or from scratch) to one athlete on one date; draft until published.
- `@athlete.<metric>` variables: a template can reference an athlete's own metric (e.g. `@athlete.threshold_pace`); it resolves automatically at the moment a workout is scheduled.
- Completion review: see what the athlete actually logged (distance, duration, pace, HR, RPE, notes), inline on the workout.
- Workout comments: a threaded conversation attached to a specific workout, not a generic inbox.
- Direct messaging: a real 1:1 conversation per athlete.
- Weekly check-ins: see the athlete's latest submission (fatigue, soreness, sleep, stress, overall feel, pain, biggest positive/concern, schedule constraints, notes) as a concise card, not a chart.
- **Coach Home**: "who needs my attention today" — athletes flagged for missed workouts, pain reports, unusually hard RPE, unread messages, or a missing check-in, ranked by severity; everyone else in one quiet line. Plus upcoming races and recently completed workouts across the whole roster.
- Notifications for: workout assigned/completed/commented, message received, check-in submitted, pain reported, missed workout.

### Athlete
- Accept a coaching invite (works whether they already have a Haarchive account or are signing up fresh).
- A quiet, list-based upcoming calendar (today's workout leads, then the next two weeks) — not a month-grid widget.
- Workout detail: structured steps, coach's notes.
- Mark a workout complete: distance, duration, avg HR, RPE, free-text feedback, and a distinct "something hurt" flag with its own notes.
- Message their coach.
- Submit a weekly check-in.
- Strava sync (if already connected) auto-matches by date and surfaces the run for the athlete to review; nothing populates the assigned workout, and nothing is visible to the coach, until the athlete explicitly approves it — manual entry remains the primary path, and an approved Strava match stays editable afterward.

## 5. Who can be a coach

Coach access is an admin-granted permission (`private_coach`, managed from the existing `/admin/users` screen — the same mechanism that already grants `content_contributor`/`reviewer`), not something a user can self-assign. This deliberately keeps the product invite-only and prevents it from becoming an open coach marketplace, which is explicitly out of scope (see §8).

## 6. Cost & Sustainability

**Why the product is free:** Brody is running this as an experiment inside an already-free, self-funded site. There is no current plan to charge coaches or athletes, and nothing in this MVP assumes future monetization — no billing tables, no payment provider, no premium-tier gating.

**Infrastructure used — all already paid for / already free-tier, zero incremental services added:**
- **Supabase** (Postgres + Auth + Row-Level Security) — 11 new tables, all in the same project/database already backing the rest of the site. No new database, no new project.
- **Next.js on Vercel** — every new route is part of the same app, same deployment. No new service, no new domain.
- **Existing notification system** (`notifications` table, already-built polling UI) — reused as-is, just new type values. No email/SMS provider.
- **Existing Strava OAuth integration** — reused as-is (Strava's API is free), extended with one more matching branch. No new third-party account or paid tier.

**What was deliberately NOT built, because it would introduce cost or complexity disproportionate to MVP value:**
- No transactional email (Resend/SendGrid/Postmark, etc.) — invites and notifications are in-app/copy-link only, matching the site's own existing pattern for its other invite flow (`coach_invites`).
- No Realtime/WebSocket infrastructure — messaging and notifications are poll-based (15s / 45s), matching the existing notification-bell precedent. Zero incremental cost, and this repo has never used Supabase Realtime.
- No payments/billing (Stripe, etc.) — not part of MVP, not stubbed.
- No AI-generated coaching content beyond what the site's existing AI layer already does elsewhere (which itself narrates/adapts deterministic engine output — see the TRD).
- No new admin UI framework — the one new admin control (granting "Private Coach") is a single checkbox added to the existing Users & Permissions screen.

**What could eventually create real cost, if this grows:**
- Supabase database size/row count growing past the current plan's included allowance (workouts, messages, completions all accumulate indefinitely — no pruning/archival was built, since it's not a concern at MVP scale).
- Vercel function-invocation or bandwidth growth if usage is substantial (unlikely at coach-scale usage, i.e. a handful of coaches with a handful of athletes each).
- If email delivery is ever wanted for invites/notifications, a transactional email provider (see the TRD for options and free-tier limits).

**Features excluded from MVP specifically because of the cost/complexity framing (not because they're low-value):** transactional email, real-time messaging, a Garmin/Coros/Apple Health integration (no working implementation exists to extend, unlike Strava), a formal audit-log reader UI, background/cron-based "missed workout" status transitions (computed at read time instead — see the TRD).

## 7. Success metrics (tracked conceptually, not yet instrumented)

**North Star — a Successful Coaching Week:** training was prescribed, meaningful training occurred, athlete feedback/data was available, the coach reviewed it, and the coach confirmed or adjusted future training.

**Coach:** time to first athlete, time to first published week, weekly active coaches, athletes per coach, % of flagged athletes who receive coach action within a reasonable window.

**Athlete:** invitation acceptance rate, workout view rate, workout completion rate, feedback rate, weekly check-in completion, 4-week and 12-week retention.

No analytics instrumentation was built in this MVP pass — these are the metrics worth wiring up once the product has real usage to measure.

## 8. Explicitly not built (by design, not oversight)

Coach marketplace or public coach discovery, autonomous AI coaching, AI-generated training plans, social features, group coaching (that's the *other*, existing product), native apps, video calling, a large analytics suite, white-label apps, complex payment/marketplace infrastructure, microservices/event buses/background-job systems, multi-tenant enterprise architecture.

## 9. Recommended next steps (not built, deliberately deferred)

1. **Apply the migrations to production** (`npx supabase db push`) — not yet run; needs explicit review/approval first (see the TRD's own note on this).
2. Grant the first real "Private Coach" permission and do an end-to-end real-user test before wider use.
3. Decide whether `@athlete.<metric>` variables need a UI for a coach to actually enter/view an athlete's metrics — the architecture supports it (`athlete_metrics` table, resolution logic), but no UI was built to populate it in this MVP pass, matching the brief's explicit allowance ("do not necessarily expose... if doing so would slow MVP delivery").
4. If usage grows past a handful of coaches, revisit whether the poll-based messaging interval is still acceptable UX, and whether Supabase Realtime (still $0 on the existing plan, just unused infra today) is worth adopting.
