# 03 — UX Audit

Real browser walkthroughs against staging (`localhost:3000`, resolving `.env.development.local` → the `haarchive-staging` Supabase project — production has none of these tables, so this is safe). Authenticated via Playwright driving the app's real email/password login form for three staging test accounts (a genuine two-person coach/athlete pair, `brodyhaar+coacha@gmail.com` / `brodyhaar+athletea@gmail.com`; and the self-coached `brodyhaar@gmail.com` account, which carries the real Canyon program data from earlier in this engagement). Screenshots are in `screenshots/`, named `<role>-<NN>-<viewport>-<screen>.png`. Desktop viewport 1440×900; mobile 390×844 (iPhone 12/13 class).

**What this document does NOT cover**: full click-by-click timing of every workflow (roster invite, program authoring end-to-end, Strava sync) — those were verified from code in `01-current-architecture.md` and are cited there instead of re-walked here, to keep this document to what was actually observed live. Every finding below is either a screenshot, a live database read, or a direct in-browser measurement — labeled accordingly.

---

## 1. Coach path

### 1.1 Connect / orient — Coach Home, Roster, Athlete overview

Desktop: `screenshots/coach-01-desktop-home.png`, `coach-02-desktop-roster.png`, `coach-03-desktop-athlete-overview.png`. No issues observed at this stage — content loads, roster lists the one athlete, athlete overview renders goal/profile context. Coach Home is attention-triage by design (per `docs/private-coaching/coaching-calendar-audit.md`), not a calendar — consistent with what the code review found.

### 1.2 Compose — the schedule surface

Desktop week/month/phase views render without visible defects at 1440px (`coach-04/05/06-desktop-*.png`). Measured directly: `document.documentElement.scrollWidth === clientWidth` (1440 = 1440) — no page-level overflow at desktop width, consistent with the calendar's `min-w-[1100px]` comfortably fitting.

**Mobile is a different story — direct screenshot evidence.**

`screenshots/coach-04-mobile-schedule-week.png` (390px viewport):

> The 7-day week grid shows **MON and TUE in full, WED cut off mid-column, and Thursday through Sunday entirely absent from the viewport**, with no scroll indicator, no fade edge, and no affordance signaling that five more days exist. A user unfamiliar with the interface has no way to discover them without incidentally swiping.

This corroborates `01-current-architecture.md`'s code finding (`week-calendar.tsx:154-155`, `overflow-x-auto` around a `min-w-[1100px]` grid) with a live rendering: the container correctly clips at the page level (no horizontal page scroll — `document.documentElement.scrollWidth` reports 390, matching the viewport), but the calendar's *own internal* scroll region is what's actually broken, and that internal scrolling is invisible to a static layout inspection. A self-coached user (§2.4 in `01-current-architecture.md`) is routed to this exact view as their primary home surface.

**A second, previously undocumented mobile defect found live**: `screenshots/coach-07-mobile-quick-create-panel.png` — opening the "Create workout" panel on mobile does not produce a true full-viewport modal. The panel is a partial-height floating overlay; "Remaining: 0.0 mi" and "NEXT WEEK" content from the page underneath is visibly bleeding through beneath the modal's own bottom edge, and the backdrop does not read as a full-screen block. This is inconsistent with the site's own documented mobile-modal convention elsewhere (the main site header's mobile menu is explicitly `fixed inset-0`, a genuine full-viewport panel — see `CLAUDE.md` §9). The coaching product does not follow its own site's established pattern here.

**A minor, previously undocumented finding**: the week view has two visually identical "+ Add" affordances with different targets — one attached to "+ Add week title / target" (opens the `WeekPlanEditor`), one per day column (opens the workout quick-create panel). An automated selector targeting the first "+ Add" on the page landed on the week-title editor, not a workout — a real ambiguity a first-time user would also hit.

### 1.3 The workout-creation form itself

`screenshots/coach-07-mobile-quick-create-panel.png` shows the "Create workout" panel's actual field order on a phone: Day Label → Session (AM/PM) → an explainer paragraph → Distance → Duration → Pace → "use a named reference instead" → a second explainer paragraph → Heart Rate → RPE → Extras — all before any Steps editor is reached, on a screen 390px wide. This is the quick-create panel, the *smaller* of the two workout forms; the full `WorkoutForm` (opened automatically once steps exist) is strictly longer.

### 1.4 Backdrop-click-saves — code-confirmed, not independently re-derived live

An automated attempt to trigger `calendar-workout-editor.tsx:110-117`'s backdrop-click auto-save via a scripted click did not reliably land on the actual backdrop element (Playwright reported "could not click backdrop directly" on the first attempt; a retry produced no network POST either way). This is inconclusive as a *live* reproduction — not a contradiction of the code finding, which is unambiguous from direct inspection (§5.6 in `01-current-architecture.md`) and stands on that evidence. Flagged here as a UX-audit method limitation: automated backdrop-click testing needs a more deliberate approach (e.g. clicking a known coordinate outside the panel's bounding box) than this pass attempted.

## 2. Athlete path

### 2.1 Orient — "no upcoming workouts," live evidence of the history gap

`screenshots/athlete-01-mobile-home-today.png`:

> The athlete's `/coaching` home reads **"No upcoming workouts published right now — check back soon, or message Coach Puffer if you were expecting one."**

This is not an empty account. A direct database read for this exact athlete returned **8 published `scheduled_workouts` rows** with real day labels ("MLR", "Fartlek", "Long Run", "Cross Training"), two already marked `completed`, dated 2026-08-24 through 2026-09-10 — all before "today" (2026-09-28) in this environment. The athlete's own home page has no way to reach any of them. This is a direct, live confirmation of `01-current-architecture.md` §6.1 (the `scheduled_date >= today` query), not a hypothetical: real coached training exists and is completely unreachable by the person it was prescribed for, with copy that actively suggests nothing has ever been assigned.

The page itself, read on its own terms, is otherwise well-built: "Message your coach," "Weekly check-in," and "Coach profile" are one tap away, and a "keep your profile current" nudge is present. The defect is entirely the missing history/archive, not this screen's own design.

### 2.2 `/dashboard` blindness — confirmed live

`screenshots/athlete-02-mobile-dashboard.png` and `athlete-02-desktop-dashboard.png`: the athlete's `/dashboard` shows no reference to coaching, no today's-workout card, no link to `/coaching`, and no indication a coach relationship exists at all. Direct text-content check: the word "coach" does not appear anywhere in the mobile dashboard's body content. (On desktop it does appear once — traced to the site header's own "My Coaching" nav item being visible in the desktop nav bar and collapsed into the hidden mobile hamburger menu on the phone layout; the dashboard *page content itself* contains it on neither viewport. Confirmed by source: `dashboard/page.tsx` has zero references to `/coaching`.)

### 2.3 Messages and check-in

`screenshots/athlete-03-*-messages.png`, `athlete-04-*-checkin.png` — both render without visible defect at either viewport. Not independently stress-tested for the two-check-in-forms-one-table issue documented in `01-current-architecture.md` §6.3; that finding is code-derived.

## 3. Issue register

Severity is about user/data impact, not code complexity. **Verified** = reproduced in this audit (code and/or browser). **Suspected** = reasoned from code, not independently reproduced here.

| # | Issue | User | Workflow | Evidence | Root cause | Severity | Verdict |
|---|---|---|---|---|---|---|---|
| D1 | Publishing a workout strips its percent-of-pace/percent-of-reps targets; no bulk publish exists | Coach, Athlete | Compose → Publish | `01-current-architecture.md` §5.1; live query confirms 8 published rows with no `title`, structured `day_label`s at risk | `saveScheduledWorkout` omits 6 of the prescription model's fields | **Critical** | Verified (code) |
| D2 | `repetitions_max`/`rest_max_s` unwritable by any app code | Coach | Compose | `01-current-architecture.md` §5.2 | Dead write path | High | Verified (code) |
| D3 | Athletes cannot see any past or completed training; no history/calendar exists | Athlete | Orient/Review | Screenshot `athlete-01-mobile-home-today.png` + live query (8 real workouts, 0 reachable) | `scheduled_date >= today` filter, no archive route | **Critical** | **Verified (live)** |
| D4 | Two disagreeing sources of truth for workout status; `missed`/`skipped` unreachable | Coach, Athlete | Review | `01-current-architecture.md` §5.4 | Status written by 3 unchecked service-role calls; UI derives independently | High | Verified (code) |
| D5 | Six delete-then-reinsert child-row writes with no transaction | Coach | Compose | `01-current-architecture.md` §5.3 | No `BEGIN`/rollback around multi-row writes | High | Verified (code) |
| D6 | Dismissing the workout modal via backdrop click saves an existing workout | Coach | Compose | `01-current-architecture.md` §5.6 | Deliberate but unsignaled auto-save | Medium | Verified (code); live repro attempt inconclusive (§1.4) |
| D7 | Reordering phases collides with a unique constraint on non-append reorders | Coach | Programs | `01-current-architecture.md` §5.5 | Loop of single-row updates against a live unique index | Medium | Verified (code) |
| D8 | `/coaching` and the athlete-detail page are never revalidated by any mutation | Coach, Athlete | All | `01-current-architecture.md` §5.7 | Path-only revalidation, incomplete coverage | Medium | Verified (code) |
| D9 | Draft phase/week-plan shape is athlete-visible before publish | Athlete | Orient | `01-current-architecture.md` §5.8 | RLS not gated on publish state for two tables | Medium | Verified (code) |
| D10 | `/dashboard` has zero private-coaching awareness; Strava UX is misleading for these athletes | Athlete | Orient, Strava | Screenshot `athlete-02-mobile-dashboard.png` (no "coach" in body text) + source (`dashboard/page.tsx`) | Feature built for a different product on the same route | High | **Verified (live + code)** |
| D11 | Zero tests for any server action, including the entire completion state machine | — | — | `01-current-architecture.md` §9 | Existing mocked-Supabase harness never applied to coaching | High | Verified (code) |
| D12 | Week calendar overflows a phone viewport with no visible affordance; the day beyond "Tue" is unreachable without accidental discovery | Coach | Compose | Screenshot `coach-04-mobile-schedule-week.png` | `grid min-w-[1100px]` inside `overflow-x-auto`, no scroll cue | **Critical** | **Verified (live)** |
| D13 | Pace Zone Table gated on the *coach's* email in a hardcoded allowlist | Athlete | — | `01-current-architecture.md` §7.5 | Admin-only feature flag with no UI signal | Low–Medium | Verified (code) |
| D14 | Coach gate copy-pasted into 12 pages; no shared nav/loading/error | Coach | All | `01-current-architecture.md` §7.1 | No `layout.tsx` in the coaching tree | Medium (architectural, not user-facing per se) | Verified (code) |
| D15 | Two check-in forms write one row with different field sets | Athlete | Check-in | `01-current-architecture.md` §6.3 | Parallel implementations, no shared component | Medium | Suspected (code only) |
| D16 | `missed_workout`/`race_approaching` notifications never fire despite being documented as shipping | Coach | Review | `01-current-architecture.md` §6.4 | Declared, routed, never called | Medium | Verified (code) |
| — | Mobile "Create workout" panel does not cover the viewport; background content bleeds through | Coach | Compose | Screenshot `coach-07-mobile-quick-create-panel.png` | Non-`fixed inset-0` modal, inconsistent with the site's own mobile-menu convention | Medium | **Verified (live)** |
| — | Two visually identical "+ Add" affordances with different targets on one screen | Coach | Compose | Screenshot walkthrough (§1.2) | Shared button label, no visual differentiation | Low | **Verified (live)** |

## 4. Friction quantification (where observed)

- **Reaching the workout-creation form from the coach's own home**: `/coaching` → Roster (or directly to an athlete) → Athlete detail → "Schedule" → Week view → locate the correct day's "+ Add" (ambiguous with the week-title "+ Add", §1.2) → panel opens. **5 navigations minimum** before a single field is entered, none of which can be shortcut from the coach's own landing page.
- **An athlete finding out what happened to a workout from three weeks ago**: **Not possible.** Zero navigations exist that reach it; this is not a friction count, it's an absent feature (D3).
- **A coach checking whether "Sync now" actually did anything for a privately-coached athlete**: requires leaving `/coaching` entirely, going to `/dashboard` (an athlete-only screen the coach may not know exists for this purpose), clicking sync, then navigating back into `/coaching/athletes/[id]/schedule` to the specific date and opening the specific workout to see if a pending Strava match appeared — since `syncStravaActivities` revalidates `/plan` only, a coach doing this may need a hard refresh to see the result at all (D10, code-derived).

## 5. What this audit did not test

No password-reset flow, no OAuth (Google) sign-in, no roster invite acceptance end-to-end, no Strava OAuth connect (would require a real Strava account and leaves the local environment), no drag-and-drop interaction (Playwright can simulate it but this pass did not), no keyboard-only navigation, no screen-reader pass. These are reasonable follow-ups for a dedicated accessibility audit, out of scope for this pass given the time available.
