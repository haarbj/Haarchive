# Private Coaching 2.0 — Calendar / Strava / Environmental Analysis Audit

Phase 1 deliverable per the Private Coaching 2.0 brief. **No code was changed to produce this document** — every claim below was verified directly against the current repository (file reads, greps, and one direct correction of a stale claim in `trd.md`), not inferred from memory or from `prd.md`/`trd.md`'s own prose. Two research subagents were launched to cover the Strava and environmental-calculator subsystems in parallel; both hit a session rate limit before finishing, so all findings below come from direct reads in this session, not subagent output.

## 0. Two findings that change the shape of this project before any design work starts

**Finding A — the conceptual model should be Prescription → Execution → Analysis, not Workout → Completion.** This was raised mid-audit and is adopted as the organizing frame for the rest of this document and for Phase 2+ design. Concretely:

| Layer | Owns | Existing table(s) |
|---|---|---|
| **Prescription** | What the coach wants the athlete to do | `scheduled_workouts` / `scheduled_workout_steps`, `workout_templates` / `workout_template_steps` |
| **Execution** | What actually happened, regardless of source | `completed_workouts` (manual entry **or** Strava-derived — see Finding B) |
| **Analysis** | How execution compares to prescription, and to environmental context | Not persisted today — computed on read from `completed_workouts` + the existing environmental engine (see §4) |

Strava is one *execution* data source. The environmental calculator is an *analysis* engine, not a workout type. Neither should become a first-class concept the Prescription layer has to know about — `scheduled_workouts` should stay provider-agnostic, exactly as it already is.

**Finding B — Strava-to-scheduled-workout matching already exists and already works, contradicting my own first assumption.** `trd.md` §7 claims this; I initially doubted it because I'd read `completion-actions.ts` (the athlete's *manual* completion action) multiple times this session and never saw Strava code there. That's correct — but irrelevant, because the real integration point is a different, pre-existing file: `src/app/(app)/(protected)/dashboard/strava-actions.ts`. Full detail in §3. This means Phase 5 of the 2.0 brief is substantially an *extension and UX layer* on working code, not new integration work from zero.

## 1. Current coach UX (what exists today)

`/coaching/athletes/[athleteId]/schedule` (`schedule/page.tsx` + `schedule-client.tsx` + `workout-form.tsx`) is a **flat list**, not a calendar:

- Each scheduled workout renders as a `Card` (date, title, type, a "Draft" badge if unpublished), in reverse-chronological order, no grouping by week.
- "New workout" opens an inline `WorkoutForm`: date picker, title, type dropdown, free-text note, an optional "start from a template" dropdown (copies a template's steps in), the full `StepsEditor` (the step-by-step UI quoted in the brief), and a publish checkbox.
- Edit/Delete are per-workout, inline. No duplicate, no move, no multi-day copy, no drag-and-drop.
- Templates (`workout_templates`/`workout_template_steps`) exist and are genuinely reusable, but only reachable via that one dropdown at workout-creation time — there's no template library view integrated into scheduling itself (a separate `/coaching/templates` page manages them).

The **Coach Home** (`/coaching`, `coach-home-data.ts`) is attention-triage (who needs a look today), not a calendar, and doesn't show any one athlete's week.

The **athlete's own view** (`/coaching`, `AthleteHomeSection`) is a quiet list — today's workout, then up to two weeks out — also not a grid.

None of this is wrong for what it is; it's just form-driven CRUD, exactly as the brief describes, and the brief's core ask (a real calendar as the primary interface) is a genuine, warranted redesign, not a misreading of the current state.

## 2. Current data model — what's reusable, what needs to change

**Reusable as-is (Prescription layer):**
- `scheduled_workouts` / `scheduled_workout_steps` — already has everything a calendar card needs (`scheduled_date`, `title`, `workout_type`, `status`, `published_at`, `notes_from_coach`, steps with targets). A calendar is a *view* over this table grouped by week, not a schema change.
- `workout_templates` / `workout_template_steps` — already the right shape for drag/click-to-add. No changes needed for Phase 3's template-drag ask.
- `@athlete.<key>` resolution (`resolveAthleteVariables`, `athlete_metrics`) — already wired at schedule-time; nothing to change.

**Reusable as-is (Execution layer):**
- `completed_workouts` — already has `strava_activity_id bigint` (nullable), `actual_distance_m`, `actual_duration_s`, `avg_hr`, `rpe`, `pain_reported`, `pain_notes`, `athlete_notes`. This table already models "manual or Strava, either way" — it does **not** need a new `external_activity` table to distinguish the two; the existing nullable `strava_activity_id` column already is that distinction (null = manual, set = Strava-derived). The brief's proposed `scheduled_workout → completion → external_activity` chain in §29 is more normalized than what exists, but the existing flatter shape is not obviously wrong and a migration to split it should not be assumed necessary — see §6.

**What needs new schema (additive only, no destructive changes):**
- **Training phases** (brief §11): no existing concept at all. Needs a new small table, e.g. `training_phases (id, coach_id, athlete_id, name, start_date, end_date, goal_id nullable)`. Straightforward, additive, RLS via `coaches_this_athlete()` mirroring every other private-coaching table.
- **Athlete approval of Strava-sharing-with-coach** (brief §16, and a real, confirmed gap — see §3): no existing gate. Needs at minimum one new nullable boolean/enum, likely on `coach_athletes` (`athlete_shares_strava` or similar) or a small dedicated settings row — needs a real design decision in Phase 2/5 design, not decided here.
- **Environmental analysis results**: per the brief's own instruction ("do not rewrite raw activity data... derive adjusted values"), this should almost certainly **not** be a new persisted table at all — compute on render from `completed_workouts` + weather lookup, matching how the calculator itself already works (nothing environmental is persisted there either). If caching becomes a real performance need later, a cache table is a much smaller, reversible addition than designing persistence in from the start.

**What should be deprecated: nothing.** No existing private-coaching table is wrong for what it does; the redesign is a new *view and interaction layer* over the Prescription/Execution tables, plus new Analysis-layer code that reads them. This matters for migration risk (§7) — this can be built additively.

## 3. Strava integration — full current picture

**Connection** (`src/app/auth/strava/route.ts` + `callback/route.ts`): standard OAuth, athlete-initiated, never automatic. Tokens stored encrypted (`TOKEN_ENCRYPTION_KEY`, AES via `src/lib/crypto.ts`) in `connected_accounts` (`provider` enum already includes `garmin|strava|coros|apple_health`, only `strava` has a working implementation). RLS on `connected_accounts` is strict owner-only CRUD (`connected_accounts_select_own` etc.) — **a coach cannot read an athlete's `connected_accounts` row at all**, by design; the coach only ever sees the resulting `completed_workouts` row. Disconnect (`disconnectStrava`) does a best-effort real deauthorization call to Strava plus deletes the local row.

**Sync** (`dashboard/strava-actions.ts`, `syncStravaActivities`): **on-demand only** — a "Sync now" button, no webhook, no polling, no cron. This already satisfies the brief's §31 "cheapest/free mechanism" instruction about as well as possible without adding infrastructure. Fetches activities via `fetchRecentActivities` (`src/lib/strava/client.ts`), paginated, capped at 500/sync, since `last_synced_at` (or 30 days back on first sync). For each running activity (`isRunningActivity` — Run/TrailRun/VirtualRun), in order:
1. Try matching the self-serve `workouts` table by exact `scheduled_date`.
2. If no match, try the team `group_plan_workouts` table (published only).
3. **If no match, try private coaching's `scheduled_workouts`** (published only) — this is the branch `trd.md` describes. Matching is **exact-date only**, no time window, no distance/type confidence scoring, no ambiguity handling — the brief's §15 "deterministic confidence score" does not exist today; today it's binary (a published workout exists on that date, or it doesn't).
4. On match: inserts into `completed_workouts` with `actual_distance_m`/`actual_duration_s` (from `moving_time`, deliberately not `elapsed_time` — already handles auto-pause correctly)/`avg_hr`/`strava_activity_id`, then flips `scheduled_workouts.status` to `completed` via the service-role client (same pattern the manual completion action uses, and for the same documented RLS reason — `scheduled_workouts` has no athlete UPDATE policy at all).

**Confirmed gaps, real and worth fixing regardless of the calendar redesign:**
- **No athlete-approval gate before the coach sees it.** The moment a match happens, it's immediately coach-visible via the existing completion RLS. The brief's §16 consent model does not exist. This is the single most important Strava-related gap to close, and it's a real privacy commitment worth keeping regardless of how much of the rest of Phase 5 gets built.
- **No coach notification fires on a Strava-triggered completion.** The manual completion action (`completion-actions.ts`) fires `workout_completed`/`pain_reported` notifications; this Strava path fires neither. A coach relying on notifications to know what happened would never learn a Strava-synced workout was completed.
- **No way to add RPE/pain/notes to a Strava-created completion afterward.** `completion-form.tsx` only offers "Undo completion" once a completion row exists (`hasExisting=true`) — there's no edit path. An athlete whose run auto-completed via Strava currently cannot add how it felt.
- **No rate-limit handling.** `client.ts`'s fetches just check `!res.ok` and throw a generic error — no 429-specific handling, no backoff, no quota tracking. Strava's real free-tier limits (roughly 100 requests/15min, 1000/day per app) are not accounted for anywhere. Not urgent at current scale (a handful of coaches triggering on-demand syncs), but worth a comment/TODO if sync ever becomes automatic.
- **Matching is exact-date-only**, no confidence scoring, no "likely match, confirm?" UX at all — it's fully silent and automatic today. The brief's ambiguous-match UI (§15) is genuinely new work, not an extension of an existing confidence system, because no confidence system exists yet.

**Already-existing, directly reusable infrastructure for richer Strava data** (this was the more surprising finding): `fetchActivityStreams` (`src/lib/strava/client.ts`) already fetches per-point GPS/elevation/time/distance/heart-rate streams for a single activity — built for a completely different feature (see §4), but directly reusable for private coaching's own needs (e.g. showing an elevation profile, or feeding the environmental engine's terrain input) without writing new Strava API code.

## 4. Environmental Performance Calculator — full current picture

This is the second major finding: **far more of Phases 6's ask already exists, working, and free, than the brief assumes.**

**The engine** (`src/lib/environmental/`): `AdjustmentEngine<TInput>` (`types.ts`) is a clean, already-generalized interface — `isApplicable(input)` + `compute(input, context) → EngineResult`. Concrete engines: `heat-engine.ts`, `humidity-engine.ts`, `wind-engine.ts` (plus `route-wind-engine.ts`/`track-wind-engine.ts` variants for a known course vs. a generic straight-line estimate), `elevation-engine.ts` / `precise-elevation-engine.ts`, `altitude-engine.ts` / `precise-altitude-engine.ts`. `combine.ts` sums them and already exposes exactly the function needed for "actual vs. ideal": `equivalentIdealTime(actualTimeSeconds, combined) → { estimateSeconds, lowSeconds, highSeconds }`. **Confidence ranges are already first-class, not something to add** — `EngineResult.confidenceLowSeconds`/`confidenceHighSeconds` exist on every engine result specifically so the UI never has to imply false precision; `combine.ts`'s own comment states this design intent almost verbatim to what the brief asks for in §22.

**Weather data is already free and already automatic**: `fetch-weather-conditions.ts` pulls from **Open-Meteo** (temperature, humidity, dew point, cloud cover, pressure, wind, plus ground elevation as a free byproduct) — no API key, no paid tier, already integrated. `fetchConditionsWindow` can pull real hourly conditions across a known `[start, start+duration]` window when a real activity start-time and duration are both known (exactly what a Strava-synced completion provides), not just a single nearest-hour snapshot.

**Route/terrain input is already unified across sources**: `src/lib/route-import/` normalizes GPX/TCX/FIT files **and Strava activity streams** into one `ParsedRoute` shape (`stravaStreamsToRoute` in `parse-strava.ts`, already used by `route-actions.ts`, which the calculator already calls for its own "import from Strava" course picker). `route-summary.ts` derives distance/elevation/heading from that shape regardless of source.

**Practical implication for Phase 6**: the actual new work is much narrower than "integrate the environmental calculator" implies — it's "given a `completed_workouts` row with a `strava_activity_id`, fetch its streams (already possible), derive a route (already possible), fetch weather for its real start-time window (already possible, free), run it through the existing engines (already possible), and render the result with the existing confidence-range shape (already possible)." No new engine, no new weather source, no new route-parsing code should be needed — only new *wiring* from a completed private-coaching workout into this existing pipeline, plus the Actual/Ideal toggle UI itself.

**One related existing feature worth knowing about**: `computeAerobicDecoupling` (`src/lib/aerobic-decoupling.ts`, also fed by `fetchActivityStreams`) — an existing, separate Analysis-layer metric (HR-to-pace drift, first half vs. second half of a run). Not asked for in this brief, but confirms the Prescription/Execution/Analysis framing (§0) already has a second real Analysis-layer precedent beyond the environmental engine, and is worth being aware of so it isn't accidentally duplicated later.

## 5. Risks

- **Calendar UX is the largest genuinely-new surface.** Nothing above reduces that scope — a real week/month grid, drag-and-drop with full keyboard/accessible fallbacks, and a fast structured-workout-text parser (brief §9) are all real, non-trivial builds with no existing precedent in this codebase to lean on.
- **Athlete-approval-for-Strava-sharing is a real product/privacy decision, not just a schema addition** — needs explicit design (does it default on or off? per-activity or a standing setting? retroactive to already-synced data?) before implementation, not a judgment call to make silently mid-build.
- **Deterministic structured-workout parsing (brief §9)** is genuinely deterministic-parseable for the example patterns given, but scope needs to be bounded explicitly (a fixed grammar, with a clear "couldn't parse this, edit manually" fallback) or it will quietly grow into an open-ended natural-language project.
- **Drag-and-drop + full accessibility parity** (brief §6, §34) is a real engineering constraint, not just a note — every drag interaction needs a keyboard/button equivalent built at the same time, not retrofitted after.
- **RLS discipline must hold across all of this.** Every new table (`training_phases`, any Strava-approval state) needs `coaches_this_athlete()`-based policies mirroring the existing pattern exactly, and needs the same live-Postgres verification (not static reasoning) the existing 63-test suite already established as this project's bar.

## 6. Migration implications

No destructive migration is implied by anything found in this audit. Everything in §2's "needs new schema" list is additive (new tables or new nullable columns), following the exact pattern already used seven times this session (`20260825010000` through `20260826040000`). `completed_workouts`' existing flat shape (rather than a normalized `completion → external_activity` split) should be kept unless a concrete new requirement demands the split — introducing it speculatively, per the brief's own §29 caution ("do not blindly adopt this... inspect the existing schema first"), would be exactly the kind of premature schema churn this project has otherwise avoided.

## 7. Recommendation on how to proceed

Given the size of what's specified (9 phases, calendar rebuild + OAuth-adjacent privacy work + two-subsystem integration), and this session's own established pattern of checkpointing before large builds: this audit suggests the highest-value, lowest-risk next slice is **not** the full calendar (the largest, riskiest, least-precedented piece), but rather:

1. Close the three confirmed Strava gaps (§3) — athlete approval, coach notification, editable-after-Strava-completion — since these are small, well-scoped, high-value fixes to an *existing* feature, not new surface area.
2. Then the calendar foundation (brief Phase 2), reusing the existing `scheduled_workouts` schema unchanged.
3. Environmental-analysis wiring (brief Phase 6) is lower-risk than its position in the phase order suggests, precisely because so much of it already exists — it could reasonably move earlier if desired.

This is a recommendation, not a decision made unilaterally — see the accompanying message for what's being proposed as the actual next implementation step.
