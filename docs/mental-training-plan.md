# Mental Training tab — implementation plan

**Status:** Scoping only. Nothing in this document has been built. No schema
changes, no migrations, no UI code exist yet for this feature. Written per
the scoping prompt; awaiting Brody's approval before any build prompt.

---

## Step 1 — Existence check

Grepped every migration and `src/` for `mental`, `mental_training`,
`visualization`, `self_talk`/`self-talk`, and `routine` (including dormant/
unwired code). Findings:

- **No mental-training scaffolding exists anywhere** — no table, no seed
  data, no component, no route, no nav entry. Every hit was incidental:
  - `supabase/migrations/20260813010000_learning_progress.sql:226` — the
    existing `self-talk` **topic** seed row for the learning-progress
    system (ties a knowledge-check/mastery topic to the `/self-talk`
    content page). Nothing to do with a routine or exercise.
  - `supabase/migrations/20260813020000_knowledge_checks.sql:122` — an
    unrelated knowledge-check question about a carb-loading *routine*.
  - `src/lib/athletes/data.ts:358-379` — Adam Goucher's athlete-profile
    narrative mentions visualization and self-talk as techniques he used,
    linking to the existing `/self-talk` page. Editorial content, not
    scaffolding.
  - `src/components/equivalent-performance-bar.tsx`,
    `src/lib/environmental/combine.ts` — "visualization" as in a chart/UI
    visualization, unrelated.

  This is a genuine clean slate — confirmed by reading, not assumed.

### The strength-training reference pattern — read in full

Files: `src/lib/private-coaching/strength-routines.ts`,
`strength-scheduling.ts`, `src/lib/private-coaching/extras.ts`,
`supabase/migrations/20260826090000_private_coaching_structured_extras.sql`.

**Important: strength training does not actually match the shape the draft
assumes it does.** Three real differences, found by reading the code, not
guessed:

1. **Routine content is typed TS data, not a database table.**
   `PEDESTAL_ROUTINE` and `HIP_STABILITY_ROUTINE` in `strength-routines.ts`
   are hardcoded exported objects (name, frequency, execution, equipment,
   exercises, a week-by-week rep progression) — the same pattern as
   `sections.ts`, `coaches/data.ts`, `athletes/data.ts`. **This part of the
   draft's framing is accurate and is the one piece worth mirroring
   directly:** the 7 mental routines should be typed TS data too, not
   database rows, for the same reason the project's own CLAUDE.md gives
   for coaches/athletes data — the content is hand-authored and
   structured, not free-form.

2. **Strength is never independently assigned by a coach, and never
   independently completed.** `strength-scheduling.ts` is pure, automatic
   placement logic: given a generated program's calendar and a one-time
   on/off toggle set per athlete (`StrengthSelections` —
   foundation/heavy-lifting/plyometrics/hill-sprints), it algorithmically
   attaches a `WorkoutExtraInput` to every eligible easy-run day when the
   program is *generated*. A coach never clicks "assign this strength
   routine to this athlete on this date" the way they assign a workout.
   And critically: `scheduled_workout_extras`
   (`20260826090000_private_coaching_structured_extras.sql:15-25`) has
   **no completion column of its own at all** — no `completed_at`, no
   boolean. The only completion signal in the whole pipeline is the
   parent `completed_workouts` row (one per `scheduled_workout_id`),
   which covers the *entire* workout — run plus every extra attached to
   it — as a single all-or-nothing unit. There is no precedent anywhere
   in this codebase for "mark just this one attached thing complete,
   independent of the workout it's attached to."
3. `extras.ts`'s own comment (line 43) literally lists **"mental
   techniques"** as an example free-typed extra kind a coach might
   already attach to a session (alongside "self-care," "hips," "core").
   So a coach today *can* already jot "do your visualization routine"
   as a line of text on a workout — but it's unstructured, uncompletable
   on its own, and not what this task is asking for.

**What this means for the plan below:** "Mirror the strength-training
structure" is correct for *how routine content is stored* (typed data),
but the assignment-and-completion model this task actually asks for —
a coach manually assigns a specific routine to a specific athlete on a
specific day, and the athlete marks *that assignment* complete
independently of any run — has **no existing precedent to copy**. It's a
genuinely new, small data model, proposed below. I'm flagging this
explicitly rather than quietly building toward a "mirror" that doesn't
exist, since it changes the honest size/shape of the work.

---

## Step 3 — Tab and auth structure (read, not guessed)

- **Auth gate:** `src/app/(app)/(protected)/layout.tsx` gates *every*
  route under `(protected)/` — `dashboard`, `coaching/*`, `settings`,
  `plan/*`, `admin/*` — on exactly one check: `getAppSession()` returns
  non-null, i.e. **any signed-in account**. Team membership, coach status,
  and admin status are independent capability checks layered on top at
  individual pages, not at this shared layout (see the layout's own
  comment: "The site is open to any signed-in user now... independent
  CAPABILITIES layered on top of general access"). **This means a new
  Mental Training tab placed anywhere under `(protected)/` automatically
  gets "open to any signed-in account" for free** — exactly the
  requirement in this task's CONTEXT — with zero additional role-gating
  code needed at the route level.

- **The "coaching tab" is one route serving two roles, not two tabs.**
  `src/app/(app)/(protected)/coaching/page.tsx` branches on
  `session.isPrivateCoach`/`session.isCoachedAthlete` (plus a `?view=`
  query param for a dual-role account) to decide whether to render the
  coach's view or label itself "My Coaching" for the athlete view. There
  is no separate `/my-coaching` URL — athlete-facing coaching content
  lives at `coaching/your-plan/` (`page.tsx`, `data.ts`, `actions.ts`),
  which is what the task's "my coaching tab" refers to.

- **No shared nav or app shell exists anywhere in the coaching tree** —
  confirmed by `find .../coaching -name layout.tsx` returning nothing.
  Every one of the ~15 subdirectories under `coaching/` (`roster`,
  `athletes`, `programs`, `templates`, `workouts`, `your-plan`, `checkin`,
  `messages`, `pace-zones`, …) is its own standalone page, each presumably
  re-deriving its own coach/athlete gate and its own nav links (matching
  the audit finding named in the prompt). **A Mental Training tab does
  not need to "join" any shared shell, because there isn't one to join.**
  It fits the actual current structure the same way every other coaching
  subdirectory does: as its own standalone route(s) under `(protected)/`,
  cross-linked by hand from the relevant existing pages (the coach's
  assignment UI, the athlete's `your-plan` page) rather than inherited
  from a shared layout. Concretely, I'd propose
  `src/app/(app)/(protected)/mental-training/` — a sibling to `coaching/`,
  not nested under it, since the task is explicit that *any* signed-in
  account can open it, not just coached athletes, and nesting it under
  `coaching/` would misleadingly imply a coaching relationship is
  required to reach it.

---

## Step 4 — Content verification and copyright scrub

Read the draft in full, then read the five cited live Haarchive pages
directly (`src/lib/sections.ts`) rather than trusting the draft's own
summaries of them. No rewrites below — findings only.

### Confirmed accurate against the live pages

- **Self-Talk (`/self-talk`):** Helmstetter's five levels, the "Before
  Your Next Workout" protocol, "replace, don't just remove," and the
  Marcora "18% longer" figure are all genuinely on the live page, closely
  matching the draft's descriptions.
- **Goal Setting (`/goal-setting`):** the mile-22 test, the Statement of
  Purpose exercise, "Wanting It vs. Expecting It" (a real named heading),
  and the have/do/be framework are all genuinely present.
- **Performing Under Pressure (`/performing-under-pressure`):** the 87%
  effort figure, the Decision Framework (including its "narrow the visual
  target" and W/L-tracking items), and the flow-state material are all
  genuinely present and attributed to Beecham, consistent with the
  draft's citation.
- **Sports Psychology (`/sports-psychology`):** the why-chain, "elephant
  buzz" (both Poscente), bracing (Fitzgerald, with the Mo Farah example),
  growth-mindset mantras (Dweck via Fitzgerald), and the pain/emotional
  taxonomy (controllable/overwhelming pain) are all genuinely present.

### Findings to flag before any routine content ships

1. **"The Dip" is not sourced anywhere.** The Implementation Notes section
   says *"When motivation drops... the fix isn't a better routine, it's a
   smaller one"* and labels it "The Dip." This term does not appear
   anywhere on the live Daily Practice page, and it isn't in the draft's
   own source list of 7 books + research. It reads like a reference to
   Seth Godin's *The Dip* (a different, uncited book) was dropped in
   without attribution. **Needs a real source or should be cut/reworded**
   as an unattributed restatement of the Olson/Poscente consistency
   material that *is* actually on the page.

2. **"Wanting vs Expecting audit" conflates two separate live-page
   sections.** The draft's Routine 0 exercise 4 cites this as one thing
   "(From Goal Setting & Identity: Beecham.)" but the live page has two
   distinct passages: a real "Wanting It vs. Expecting It" heading
   (conscious desire vs. unconscious belief — a different exercise
   entirely, about noticing involuntary physical tells), and a separate,
   unrelated "rewrite your goal at 100%/90%/80%/70%/60% confidence until
   it produces anxiety" technique. The draft's exercise is actually the
   second one, mislabeled with the first one's name. Worth relabeling
   before shipping so it doesn't read as a direct quote of a concept it
   isn't.

3. **"Premortem" isn't the live site's own term.** The draft calls the
   ten-things-that-could-go-wrong technique "the premortem technique"
   multiple times, citing it "(From Sports Psychology.)" as though that's
   the page's own name for it. The live page describes the technique
   (`sections.ts` sports-psychology, line ~246) without ever using the
   word "premortem" — it's a real, legitimate term from decision-making
   literature (Gary Klein), but it's the draft's own label, not a quote.
   Not wrong, but should be phrased as "what we're calling a premortem"
   rather than implied to be the site's own term.

4. **The live Daily Practice page's own "250/365" math may already be
   internally inconsistent, independent of the draft.** The page says
   "roughly a 250-day program... 365 days with about 115 built in... two
   missed or reduced days out of every three." 115/365 is roughly 1/3,
   not 2/3 — "two missed days out of every three" would actually describe
   a much lower (~33%) completion rate than 250/365 (~68%) implies. The
   draft's "about two missed days per three-day stretch" directly inherits
   this phrasing. This may be a pre-existing wording issue on the live
   page itself, not something the draft introduced — flagging for
   awareness; not something to silently "fix" by picking an interpretation
   in the routine content.

5. **The "35-min rule" citation is an analogy, not a literal figure.**
   Implementation Notes applies Olson's specific "35 minutes of general
   exercise" (his own real daily-minimum number, confirmed on the live
   Daily Practice page) as a general *principle* ("size the minimum for
   the worst day") to a completely different context (mental-routine
   minimums, e.g. "visualization's minimum is 2 min"). The principle
   transfer is reasonable, but the build prompt should write it as "the
   same principle Daily Practice uses for Olson's 35-minute rule," not
   imply 35 minutes applies to mental training.

6. **Gollwitzer's d = 0.65 and Wulf's attentional-focus findings are
   unverified in this pass.** These are cited only as external research
   (not claimed to be already on the Haarchive), and this session has no
   web-fetch tool available to check them against the primary literature.
   I did not find them contradicted by anything on the site, but I also
   could not independently confirm the figures. **Flagging as
   unverified, not confirmed** — worth a real citation check (the actual
   Gollwitzer & Sheeran 2006 meta-analysis, the actual Wulf 2013 review)
   before either number ships in athlete-facing copy.

7. **No direct-quote/plagiarism risk found in what I checked.** Every
   routine exercise I cross-referenced paraphrases its source concept
   rather than lifting distinctive phrasing verbatim (e.g. Helmstetter's
   "control room" language, Beecham's "ant riding an elephant," Poscente's
   "five-thousand-gallon bucket" are each referenced conceptually in the
   draft, not quoted). I did not have access to the 7 cited books'
   primary text to check word-for-word, so this is "nothing suspicious
   found," not "independently verified against the source books."

---

## Step 5 — Implementation plan

### Data model

**Routine content: typed TS data, not a database table** — mirrors
`strength-routines.ts` exactly (see Step 1's finding). A new
`src/lib/mental-training/routines.ts` (or a directory, if 7 routines'
content gets long — `coaches/data.ts`-scale, likely) exports each
routine as a typed object: key, name, frequency, source attribution,
exercise steps, guidance text, and a "read deeper" link to the matching
`/goal-setting` / `/self-talk` / etc. page. No migration needed for this
part at all.

**New tables (the genuinely new part — assignment + completion):**

```
mental_routine_assignments
  id uuid primary key
  coach_id uuid references profiles(id)
  athlete_id uuid references profiles(id)
  routine_key text not null          -- matches a key in routines.ts, not a FK (content isn't a table)
  scheduled_date date not null
  published_at timestamptz           -- draft until published, same pattern as scheduled_workouts
  created_at timestamptz not null default now()

mental_routine_completions
  id uuid primary key
  assignment_id uuid not null unique references mental_routine_assignments(id) on delete cascade
  athlete_id uuid references profiles(id)
  completed_at timestamptz not null default now()
```

One completion row per assignment (the `unique` on `assignment_id` makes
"mark complete" an upsert, same as `completed_workouts`' own
`unique(scheduled_workout_id)` shape) — not a boolean column on the
assignment table, so a coach's assignment row and an athlete's completion
event stay two separate, separately-RLS'd writes, consistent with how
`scheduled_workouts`/`completed_workouts` already separate "what the
coach assigned" from "what the athlete did."

**Migrations:** additive only, two new tables, no changes to any existing
table.

**RLS:** per the task's explicit instruction, deny-all on both new tables,
every read/write routed through service-role Server Actions. **Worth
flagging as an open question (see below):** this is stricter than the
existing sibling tables in this exact feature area —
`scheduled_workouts`/`scheduled_workout_extras`/`completed_workouts` all
use direct `to authenticated` RLS policies with real `auth.uid()` checks,
not deny-all. I'm following the task's explicit instruction as given, but
noting the inconsistency rather than silently picking whichever pattern
looked more familiar.

### Visibility rules

- **Routine content** (the TS data itself): not gated at all — it's code,
  not a database row, readable by any page that imports it. The "any
  signed-in account can open the tab" requirement is enforced by the
  route living under `(protected)/`, not by a per-routine permission
  check.
- **Assignments:** athlete sees only rows where `athlete_id = auth.uid()`
  and `published_at is not null` (mirrors `scheduled_workouts`' own
  published-only-for-athlete gate exactly). Coach sees only rows where
  `coach_id = auth.uid()`, published or not (drafts included, same as a
  coach's own unpublished workouts).
- **Completions:** athlete can only write a completion for an assignment
  that's their own (`assignment.athlete_id = auth.uid()`). Coach can read
  (not write) completions for their own athletes' assignments — this is
  what makes a completion "visible where the assignment lives" (the
  athlete's `your-plan` page can show it as done; the coach's roster/
  athlete page can show it as done too) without the coach ever being able
  to mark something complete on an athlete's behalf.

### Tab placement and the assignment flow, end to end

1. **Coach assigns** — from inside the existing coaching tab (most likely
   the athlete's own detail page under `coaching/athletes/[athleteId]/`,
   alongside however workouts get assigned there today — needs a closer
   read of that specific page before the build prompt, not assumed here).
   Picks a routine (from the typed list), an athlete, a date; publishes
   it (or leaves it a draft, same two-step pattern as a workout).
2. **Athlete sees it assigned** — in `coaching/your-plan/`, as part of
   their plan, the same way an assigned workout shows up there today.
   Clicking it does *not* do the routine inline — it links out to...
3. **The Mental Training tab** (`/mental-training` or similar) — where
   the athlete actually does the routine and marks it complete. This
   write creates the `mental_routine_completions` row.
4. **Completion reflects back** — `your-plan` shows the assignment as
   done (reads the completion row); the coach's view of that athlete
   shows it as done too.

Any signed-in account (not just one with an assignment) can also open
`/mental-training` directly and run any routine unassigned, marking it
complete for their own record with no `coach_id` on that
assignment/completion at all — worth deciding explicitly whether an
unassigned "just doing it for myself" completion needs its own row shape
(an assignment with `coach_id = null`, self-assigned) or a separate,
simpler table. Flagged below as an open question rather than decided here.

### Build sequence — next 2-3 prompts

Mirrors the strength-training precedent's own incremental build (schema →
content → scheduling/assignment → display), broken into shippable slices
per the draft's own "start with 2 core routines" instruction:

1. **Prompt 1 — Data + the smallest possible routine experience.**
   Migrations for the two new tables. Typed TS data for **Routine 0
   (Goal & Purpose Setting)** and **Routine 1 (Visualization Practice)**
   only. The `/mental-training` tab itself, read-only content display +
   a "mark complete" action with no assignment concept yet (every
   signed-in account can open any of the 2 routines and mark their own
   completion). *Why these two:* Routine 0 is the foundation every other
   routine explicitly depends on (Visualization's own instructions say
   "read your Statement of Purpose from Routine 0" before starting), and
   Routine 1 is the simplest, most self-contained weekly routine — no
   branching logic like Self-Talk's fundamental/fleeting split or
   Segment Review's dependency on the Decision Framework. Shipping these
   two together is the smallest slice that's actually coherent on its
   own (Visualization without Routine 0 is just generic daydreaming
   instructions, per the draft's own guidance text).
2. **Prompt 2 — Coach assignment, end to end.** The coach-side UI to
   assign a routine (from the 2 shipped so far) to a specific athlete on
   a specific date; the athlete's `your-plan` page showing it; the
   completion reflecting back to both sides. This is where the real,
   new data-model risk lives, so it's worth its own prompt rather than
   bundling with Prompt 1's content work.
3. **Prompt 3 — Remaining routines.** Add Routines 2-6 (Self-Talk,
   Segment Strategy, Present-Moment, Pre-Race, Discomfort Management) as
   pure content additions to the now-proven data model/UI from Prompts 1
   and 2 — no new schema expected.

### Open questions for Brody, before any build prompt

1. **RLS pattern:** deny-all + service-role (as instructed) vs. matching
   the sibling `scheduled_workouts`/`completed_workouts` tables' direct
   RLS? I'll build whichever you confirm; flagged above because they
   currently disagree.
2. **Self-assigned/unassigned completions:** does "any signed-in account"
   doing a routine with no coach assignment need its own row shape, or
   should it just be a self-assigned row (`coach_id = athlete_id`, or
   null) in the same two tables? Affects the Prompt-1 schema.
3. **Where exactly does a coach click "assign"?** I did not read
   `coaching/athletes/[athleteId]/` closely enough in this scoping pass
   to say precisely which existing screen/action the assign flow should
   extend — needs a targeted read before Prompt 2, not guessed here.
4. **The 6 content findings above** (Step 4) — which ones need a real
   fix before routine copy ships (especially #1, the unsourced "Dip,"
   and #6, the unverified Gollwitzer/Wulf figures) vs. which are fine as
   informal paraphrase.
5. **Tab URL/naming:** `/mental-training` was my best guess at a sibling
   route to `coaching/` — confirm the actual slug/label before Prompt 1.
6. **Starting pair (Routine 0 + 1):** confirm this is the right smallest
   slice, or whether Self-Talk (the most-cited, probably highest-value
   routine) should be prioritized instead despite being more complex to
   build first.

---

## Not done in this pass

No schema changes, no migrations, no UI code, no production steps, per
the task's explicit constraints. This document is the only artifact.
