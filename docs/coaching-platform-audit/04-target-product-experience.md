# 04 — Target Product Experience

This document owns product behavior: the canonical journey, information architecture, the six MVP surfaces, mobile behavior, review, notifications, and per-screen acceptance criteria. Technical enforcement of everything described here is `05-target-architecture.md`'s job, not this document's — where a rule here needs a database guarantee, it says so and points there.

Grounded in the blueprint's north-star loop (adopted as-is — it is not in tension with anything found in the audit) and corrected against the 18 verified defects in `01`/`03`.

---

## North-star loop

**Plan → perform → reflect → review → adjust.**

The smallest useful release closes this loop for one coach and one athlete. Everything else — templates, roster-scale tooling, analytics, billing — is explicitly secondary until the loop is trustworthy, per the memo's own "preserve" directive and the current product's own biggest problem: the loop is *built* but not *trustworthy*, because D1 means a published workout can silently lose the exact information that made it a coaching decision rather than a guess.

## One training record, two focused paths

Coaches manage attention. Athletes manage today. Both meet on the same workout record (§4, Workout Detail + Log) — this is preserved exactly as the blueprint describes it, because it's already the direction the current codebase's better parts point (per-workout comment threads, live-resolved pace, `01` §8's well-factored pure-logic layer) even though the surfaces around that record are currently disconnected.

---

## 1. Information architecture

### Coach

| Surface | Replaces / consolidates |
|---|---|
| Roster | `coaching/roster` — kept, extended with a compliance signal (§6) |
| Athlete overview | `coaching/athletes/[athleteId]` — kept, extended with the review-queue entry point |
| Week composer | `coaching/athletes/[athleteId]/schedule` week/day/month views — **consolidated**: one calendar surface with view switching, not four independently-fetching page sections (`01` §2, `schedule/page.tsx`'s 901-line shared-fetch problem) |
| Workout detail + log | `coaching/workouts/[workoutId]` — kept, becomes the shared coach/athlete surface described below |
| Review queue | **New**, or a compliance layer on Roster — see §6, genuinely undecided per `02`'s TrainingPeaks finding |
| Programs / Templates | `coaching/programs`, `coaching/templates` — kept as authoring surfaces, unified onto the `IntensityTarget` contract (`05` §1.1) so they stop each independently reimplementing step mapping |

### Athlete

| Surface | Replaces / consolidates |
|---|---|
| Today | `coaching/page.tsx`'s `AthleteHomeSection` — kept, fixed (§3) |
| Week | **New** — the athlete-facing counterpart to the coach's week composer, read-mostly, today-first on mobile |
| History | **New** — closes D3 entirely; does not exist today in any form |
| Workout detail + log | Same shared surface as the coach's |
| Coach feedback | Folded into workout detail (already the pattern); no separate inbox needed beyond what exists |

**What does not change:** the coach gate is unified into one real `layout.tsx` for the coaching tree (closes D14 — the 12-file copy-pasted preamble), giving every page under it consistent nav, loading, and error handling for the first time.

## 2. Coach path — six steps, each with acceptance criteria

### 2.1 Connect

Invite an athlete; they accept the relationship. **Kept as-is** — `01` found no defect in the invite mechanism itself beyond two small, fixable bugs (the nondeterministic trigger match, the missing signup-link email prefill — both are `05`/implementation-level fixes, not product-behavior changes).

**Acceptance:** a coach can invite an athlete and cannot see any of that athlete's data before acceptance (already true today via RLS — `coach_athletes` has no pre-acceptance row).

### 2.2 Understand

Athlete overview: goal race, availability, recent load, constraints, recent results — **kept exactly as built**; `01`/`03` found no defects here, and it already correctly reuses the site's existing profile/race-result data (per the blueprint's own "reuse first" principle, already satisfied).

### 2.3 Compose

**The most consequential change in this document.** Build the week on one calendar surface. Concretely, fixing what `03` observed live:

- **One "+ Add" per day, unambiguous.** The week-title/target editor and the per-day workout creator get visually distinct entry points — no shared label (fixes the ambiguity found in `03` §1.2).
- **The workout form asks for `purpose` first**, adjacent to the day label, before any target fields — matching `05` §1.1's contract and the design principle both source documents independently state.
- **Structured targets stay expressive without punishing the common case.** A coach who just needs "5 miles easy" should not scroll through Distance/Duration/Pace/Reference-toggle/HR/RPE/Extras before reaching Save — `02` §4's intervals.icu finding (a text-first entry mode) is recorded as worth prototyping, not mandated; the acceptance criterion is behavioral, not implementation-specific: **entering a simple single-target workout takes no more fields than the target it actually needs**, which the current form already fails on mobile (`03` §1.3 — 8+ fields visible before Steps).
- **Duplicate, drag between dates, and publish-this-week are real, first-class actions on this surface** — not the 13-entry-point sprawl `01` §7.2 found. Template application becomes a single action from the calendar itself (drag or one click), not something reachable only from inside one of two separate forms.

**Acceptance:** a coach can draft seven days without exposing any of it to the athlete (draft state, `05` §1.2.2); duplicating a day, applying a template, and moving a workout between dates are each one action, not a multi-screen detour.

### 2.4 Publish

**Composed work is hidden by default; publishing is an explicit, logged, reversible event.** Per `05` §1.2.3, revised on the completed competitive research (`02` §2). This is the structural fix for D1. A coach drafts a week in private, then publishes it as one action producing one "your week is ready" notification, not N individual `workout_assigned` notifications (the blueprint's own rule: notify only for an invite, newly published work, a material revision, or direct feedback).

**Three product behaviors this implies, each earned from a real precedent rather than assumed:**

1. **A coach can always tell what the athlete can currently see.** Draft days are visually distinct at the week level, not marked with a small badge the coach has to hunt for (`06` §2.2). Figma's "Review unpublished changes" affordance is the nearest working analogue: a persistent signal on the chrome, plus a list of exactly what would become visible if published now.
2. **Publishing is reversible.** Unpublishing returns a batch to hidden, with one exception carried from TrainingPeaks' own rule: **a workout the athlete has already logged against cannot be hidden.** Once an athlete has acted on a prescription, it is part of their history.
3. **The publish log is read-only and separate from the calendar.** V.O2 separated these deliberately after eight years: editing happens in the calendar, history is viewed in the log. It answers "what did the athlete see, and when?", which is the question a coach needs when interpreting an RPE report.

**Deliberately not built:** scheduled auto-publish. V.O2 ships it and documents its own failure modes (coach-timezone confusion, gaps when the visibility window is shorter than the publish period). At this roster size "publish this week" is one click.

**Acceptance:** publishing a week of 7 workouts produces exactly one athlete-visible notification and makes all 7 visible in one action; no field present on any of the 7 before publish is different after (the round-trip invariant from `07`); the resolved absolute pace/HR values the athlete sees are frozen at publish and do not change when the athlete's fitness estimate later moves (`05` §1.1); a coach can see, for any past date, exactly what was visible to the athlete then.

### 2.5 Review

**A simple "needs review" list, not a dashboard.** This recommendation changed on the completed research (`02` §2, Hypothesis 2), and the reason is specifically about scale rather than about which competitor is better designed.

An earlier draft favored a compliance signal layered onto the roster, following TrainingPeaks' shipped pattern, over the blueprint's dedicated queue. The survey of the wider market makes the distinction sharper: **discovery dashboards solve a problem that begins around thirty athletes.** With a handful, a coach does not need help *finding* who needs attention. They need to not *forget* anyone. Those are different products. Nolio's roster dashboards, Humango's compliance alerts and fatigue model, and Canary Coach's flagging engine are all built for the first problem. V.O2, despite being the most developed product surveyed in every other respect, ships essentially nothing roster-wide.

**Therefore:** one reverse-chronological list containing completed-but-unreviewed sessions, any non-empty pain report, any RPE deviating materially from the session's intent, and any missed published session. Reviewing an item clears it. That is one query and one list, and at this scale it beats every dashboard surveyed.

**Two principles carried from the better implementations, independent of scale:**

- **Flag on convergence, not on a single metric**, and **attach the evidence to the flag** so the coach sees why without clicking through. Canary Coach states it well: "a single bad night is not a flag; poor sleep plus elevated resting heart rate ahead of an intensity session is." A flag without its evidence becomes one more thing to dismiss.
- **The review surface flags and never prescribes.** This is already this codebase's own rule for the AI layer (`CLAUDE.md` §7: the AI narrates what the deterministic engine computed) applied to a new surface.

**Also worth adopting, cheaply:** Nolio's subscribe-to-events model, where the coach chooses which events notify them (workout logged, RPE submitted, comment added). It puts signal-to-noise under the coach's control instead of requiring the product to guess at relevance.

**Acceptance:** a coach opening their roster can identify, without opening any individual workout, which athletes need attention today and why (pain / high effort / comment / missed); every flag displays the evidence that produced it; reviewing an item removes it from the list and it does not reappear.

### 2.6 Adapt

Revise future work; the original prescription is never erased. Directly implements `05` §1.2.4. The UI signal: a revised workout carries a small, persistent "revised" marker and a one-tap way to see what changed and why — this is the blueprint's "See what changed" surfaced on the coach's own side of the same interaction.

**Acceptance:** revising a published workout's date, target, or purpose requires a reason (short text, not optional for *material* changes per `05`'s defined threshold); the athlete sees the change with the reason attached; the pre-revision value is retrievable, never silently gone.

## 3. Athlete path — six steps, each with acceptance criteria

### 3.1 Orient

**Open Today — fixed to actually show today.** `03` §2.1 found this literally broken for real data: 8 real published workouts existed and the page said "No upcoming workouts published right now." The fix is not a copy change — it's §3.3 (History) existing at all, so "nothing upcoming" and "nothing has ever happened" stop being indistinguishable states. Today's card shows session, purpose, targets, and the coach's note immediately, no navigation required — this part of the current implementation is already correct (`03` §2.1's screenshot shows a clean, focused card) and is preserved.

**Acceptance:** an athlete with any published workout, past or future, sees accurate context on their home screen — never a false "nothing assigned" message.

### 3.2 Perform

Use the plan without navigating through coaching controls — already true today (the athlete-facing workout detail page has no coach-only affordances visible when `effectiveIsCoach` is false). **Kept as-is.**

### 3.3 Record — and the new History surface

Log done/modified/skipped, with effort, notes, pain, and activity match. **The single largest net-new athlete-facing surface this document specifies: a real History view**, closing D3. Not a full calendar rebuild — a reverse-chronological list of past assignments and their logs, the natural counterpart to Today, reusing the same workout-detail component every other surface already uses. This is a `scheduled_date < today` query where today's code only has `>= today`; the UI is a list, matching the blueprint's own athlete-week framing ("today-first...with the rest of the week visible but visually quieter") extended backward in time.

**Acceptance:** an athlete can find and open any past workout, published or completed, without needing a coach to send a link; a completed-but-unlogged past workout is visibly distinguishable from a logged one.

### 3.4 Explain

Add context: weather, fatigue, surface, soreness, life constraints — already captured (`athlete_notes`, `pain_reported`/`pain_notes`). **Kept.** One fix: **source is always visible** — whether a logged metric is manual or Strava-synced, per the blueprint's "keep source visible" product rule, already partially true (`03` notes the completion form does show an "imported from Strava" hint) but not consistently applied everywhere a metric is displayed.

### 3.5 Receive

Coach comments stay attached to the workout they concern — already the architecture (`workout_comments`, one thread per workout). **Kept**, with one addition the blueprint calls for and the current code lacks: a revision's reason is shown in the same place, not just the raw before/after values.

### 3.6 Continue

Revisions are highlighted with a short reason, then absorbed into the week — directly implements `05` §1.2.4 on the athlete's side of the same mechanism described in §2.6.

## 4. The shared surface: Workout Detail + Log

**The pivotal screen**, per the blueprint, and the audit agrees: `01`/`03` found no structural defect in this screen's *content* (pace resolution is live and transparently sourced, steps render correctly, comments work) — its problems are entirely upstream (what data reaches it) and in its mobile chrome (the create/edit panel's own layout, `03` §1.2/§1.3). Intent (the prescription and its purpose), execution (the athlete's log), and interpretation (comments, revisions) stay together on one screen, exactly as built today. No redesign of this screen's fundamental shape is recommended — it is one of the current product's actual strengths, and should be named as such rather than torn down alongside the surfaces that are genuinely broken.

## 5. Mobile — today-first, and the two confirmed live defects

**Athlete surfaces are already reasonably mobile-usable** — `01`'s mobile-responsiveness sweep and `03`'s live screenshots agree the athlete-facing screens (Today, workout detail, messages, check-in) use simple single-column layouts that don't overflow. The problem is narrower and more specific than "mobile needs work broadly":

1. **The coach's week calendar does not work on a phone at all** (D12, `03` §1.2 — MON and TUE visible, five days silently inaccessible, no scroll cue). Fix: the week composer's mobile presentation is not a horizontally-scrolled grid — it's a day-by-day agenda (matching how every calendar-pattern reference this audit could reach, including the blueprint's own "today-first...rest of week visible but visually quieter" framing, actually resolves this exact problem). Desktop keeps the grid; mobile gets its own genuinely different layout, not a shrunk version of the same one.
2. **The create/edit workout panel is not a true full-screen modal on mobile** (confirmed live, `03` §1.2 — background content bleeds through beneath it), inconsistent with the site's own documented mobile-menu convention (`fixed inset-0`, per `CLAUDE.md` §9). Fix: match that existing, working convention rather than inventing a new one.

This matters specifically because a self-coached user is routed to the coach's own schedule view as their primary surface (`01` §2.4) — mobile calendar usability is not a coach-only concern.

## 6. Notification rules

Adopt the blueprint's rule directly, because it's stricter (and therefore closer to what `01` §6.4 shows the current implementation should have been): **notify only for an invite, newly published work (once, per publish action — not per workout, §2.4), a material revision, or direct feedback.** No notification for every save, sync, or minor reorder. This retires two dead types (`missed_workout`, `race_approaching` — declared, routed, never fired, per D16) rather than finally implementing them, since neither survives the blueprint's own stricter rule as a real notification (a missed workout is exception-review content, §2.5, not a push notification; a race-approaching countdown is already visible context on the athlete overview, not urgent enough to interrupt).

## 7. Screen acceptance criteria — consolidated

For `07-testing-strategy.md` to turn directly into test cases:

- Roster shows, per athlete: next action needed (or "on track"), current week's publish state, unread feedback — computable from the fixed revalidation contract in `05` §1.2.6, not from stale cached data (fixes D8's user-visible symptom).
- Athlete overview requires no scrolling through coaching-tool chrome to find training context — unchanged from today, which already gets this right.
- Week composer: every field visible before Save maps to exactly one `IntensityTarget` mode (`05` §1.1) — no two fields that silently fight for the same underlying column.
- Today (athlete): never shows "nothing assigned" when a workout exists in the past or future that the athlete could reasonably expect to see.
- History (athlete): reachable in one tap from Today; shows every published assignment regardless of date.
- Workout detail: purpose is visible in the same visual position whether the viewer is the coach or the athlete.
- Review (coach): surfaces pain/high-RPE/comment/missed athletes without requiring the coach to open each workout individually.
- Every screen: mobile viewport (390px) produces no horizontal page overflow and no modal that fails to cover the full viewport.
