// The data behind /release-notes -- kept as its own typed array, separate
// from the page component, the same "data file, generic renderer" split
// already used for sections.ts/content-blocks.tsx and coaches/data.ts/
// coach-page.tsx. Sourced from this repo's own git history (`git log`),
// curated rather than reproduced commit-for-commit: a real shipped change
// gets one entry even if it took several commits, and pure internal
// refactors, copyediting, or one-line bug fixes with no visible effect are
// left out entirely. The goal is "what would a returning reader or
// contributor actually notice changed," not a mirror of the commit log.
//
// This file is the single canonical source of release history -- there is
// no separate CHANGELOG.md, no GitHub Releases pipeline, and nothing else
// generates or duplicates this data (see docs/release-documentation-
// investigation.md for the full reasoning). README.md's own
// RELEASE_STATUS block is generated FROM this file, one direction only --
// never edit that block by hand, and never let anything but this file
// decide what counts as a release.
//
// Is a change worth an entry? Ask "would a returning reader or
// contributor actually notice this changed" -- not "did a commit happen."
// Generally yes: a new feature, tool, or content system; a substantial UX
// or navigation change; a bug fix a real user would have hit and noticed;
// a security fix; a meaningful reliability/performance change.
// Generally no: typo/copy fixes, formatting-only changes, internal
// refactors with no visible behavior change, test-only changes, dependency
// bumps with no user-visible effect, documentation-only changes (this
// header included), or a small admin-only UI tweak nobody outside the
// team would notice. When unsure, prefer leaving it out -- a short, honest
// page beats a noisy one. This same rule is restated briefly in CLAUDE.md
// so a session that hasn't opened this file yet still sees it before
// committing.
//
// Format for a new entry, going forward:
//   - `date`: the day it actually shipped (ISO YYYY-MM-DD), not when work
//     on it started. If several related commits landed across a few days
//     as one feature, use the day the feature became usable.
//   - `headline`: a plain sentence fragment describing what changed, written
//     for a reader, not a commit message -- "Marathon Pacing Calculator
//     launched," not "Add Marathon Pacing Calculator page."
//   - `detail`: 2-3 sentences. What it is, and why it's there or what
//     problem it solves -- not a feature-by-feature bullet list. Match the
//     rest of the site's voice: specific and plain, no "we're excited to
//     announce."
// New entries go at the top of this array (reverse chronological, newest
// first) -- the page groups by month automatically, so no other change is
// needed to add one.
export type ReleaseNote = {
  date: string;
  headline: string;
  detail: string;
};

export const releaseNotes: ReleaseNote[] = [
  {
    date: "2026-10-27",
    headline: "Worked examples with real splits for progression-run workouts, and a dangling line removed",
    detail:
      "A workout detail page's \"No structured steps -- see the notes above\" line used to render for any typed workout with no steps at all, even when there were no notes above to see either -- it now only appears when there's something real to point at. Separately, the two workout types that progress pace within a single continuous session (the Kenyan-style progression run and the stepwise long fast run) now show a worked example -- the session's own structure plus sample splits computed from the viewing athlete's own most recent race, the same way every other named pace on this platform resolves. With no race on file yet, the structure still shows, by pace-zone name only, never a fabricated number. The same example appears on the workout detail page and the full workout-types glossary, which now also links directly to the matching entry instead of just the general list.",
  },
  {
    date: "2026-10-27",
    headline: "Fixed: the on-ramps to an athlete's own schedule, and a coach dropped out of view-as on /plan",
    detail:
      "Two of the paths into an athlete's weekly schedule led nowhere useful: the \"Take me to my schedule\" button on Your Plan sent an athlete to the coaching home instead of their own schedule, and the Coaching page had no direct link to it at all. Both now go to /plan. Separately, a coach viewing as one of their athletes who navigated to /plan was redirected straight to their own dashboard with no banner and no explanation -- view-as mode was silently dropped, because /plan's own access gate checked only the coach's own session, never whether they were actively viewing as someone else. The coach now stays in view-as and sees the athlete's real plan.",
  },
  {
    date: "2026-10-27",
    headline: "Week notes now reach the athlete, and framework edits reach everyone already assigned",
    detail:
      "A coach's week-level note -- written either on one athlete's own schedule, or once on a Program week for every future assignee -- used to render in exactly one place: the coach's own Week View. It's now visible on the athlete's Your Plan page and the coach's Timeline and Month views too, and Month's WEEK column no longer says \"No target set\" for a week that has a note instead. A Program's own week note also used to be frozen at assignment time, so editing it later never reached an athlete already assigned -- it now propagates to every one of them automatically, without a full resync, while never overwriting a note a coach has written for one specific athlete directly.",
  },
  {
    date: "2026-10-27",
    headline: "Fixed: privately-coached athletes couldn't reach their own schedule",
    detail:
      "A fix shipped Oct 19 corrected which coach a privately-coached athlete's page resolves when they'd self-coached before accepting a real invite, and taught the weekly schedule page to render coach-assigned workouts. But that schedule page (/plan) was still gated behind a team-membership check left over from before private coaching existed, so an athlete who wasn't also on a team never reached it at all -- redirected away before that logic ever ran. Opened the gate for a privately-coached athlete, and taught the page's own no-self-generated-plan path to show their coach-assigned workouts and weekly mileage instead of bouncing them toward generating a conflicting plan of their own.",
  },
  {
    date: "2026-10-26",
    headline: "Club intake: a free Club Plan tier, and an unlisted interest form behind it",
    detail:
      "Coaching now has a real free tier alongside paid 1-on-1: a framework matched to mileage, experience, and goal, plus the full education layer, no messaging or plan adjustments. The Vanderbilt Run Club's Nashville 2027 cycle is the first to use it, through a single unlisted form link (account and verified email required, no public listing) that lands in a batch approval queue showing each athlete's proposed framework and any flags. Approving unlocks the existing assign-program flow for that athlete; nothing generates a plan automatically.",
  },
  {
    date: "2026-10-20",
    headline: "Athletes can say what the season actually means to them",
    detail:
      "A new season goal, in the athlete's own words, now sits near the top of their home page -- separate from the structured goal race (name, date, target time), which stays exactly a fact. An empty one shows a single open question, \"What would make this season a success for you?\", with a plain inline edit affordance; editing replaces the current statement outright, no history. The coach sees it verbatim on that athlete's detail page, clearly labeled as the athlete's own words, with no edit control anywhere -- this is voice, not data the coach manages.",
  },
  {
    date: "2026-10-20",
    headline: "Coaches can view as an athlete, read-only",
    detail:
      "A coach can switch into any of their athletes' real view from the roster or that athlete's detail page, and land on their actual home, plan, and Your Plan payoff exactly as the athlete sees them -- the fastest way to check \"is the published plan right\" without asking anyone to screenshot anything. A persistent banner names who's being viewed and that it's read-only, with one click back to the coach's own view. Nothing about this changes who's signed in: logging a completion, submitting a check-in, approving a Strava match, and sending a message all refuse at the server the moment the mode is active, regardless of the UI, and no notification or dismissal state is ever touched just by looking. Timeline view and the workout detail page aren't wired up yet -- Week view, Your Plan, and home are.",
  },
  {
    date: "2026-10-20",
    headline: "Patterns: a 6-week trend view on the plan and the coach's athlete page",
    detail:
      "A new Patterns section shows the last six weeks as a trend instead of one week at a time: scheduled vs. completed mileage, completion rate, long-run progression, key-session RPE against what was prescribed, and (when a check-in exists) the athlete's own weekly feel rating -- each with a plain rising/falling/steady word next to it, never a score or a color-coded verdict. The week still in progress is always labeled as such and never counted toward the trend, so a partial Tuesday never reads as a drop; weeks before the athlete's program began show as a visible gap rather than a fake zero. The same numbers render identically whether the coach or the athlete is looking at them, because both read from the same one calculation.",
  },
  {
    date: "2026-10-20",
    headline: "Specific-praise prompts when a coach reviews a check-in",
    detail:
      "Opening an athlete's check-in now surfaces up to three tappable, factual prompts above the reply box, each citing a real number from that week: a perfect or near-perfect completion week, a key session or long run hit on plan, a hard effort run under the prescribed RPE, or a new longest run or first session of a kind this program. Tapping one drops its exact text into the reply, fully editable or deletable before sending. Nothing is generated by AI and nothing is ever inserted or sent automatically -- a quiet week with nothing to cite shows no prompts at all, since forced praise isn't the goal here.",
  },
  {
    date: "2026-10-20",
    headline: "Weekly Load now reconciles per workout, not by netting totals",
    detail:
      "A run logged on an Off day (a Strava match or manual log with no scheduled workout to credit it to) used to net straight against the week's scheduled total, which could make Weekly Load's Remaining figure read lower than what's actually still ahead. It's now its own \"Unscheduled\" line -- real volume that happened, shown without ever being subtracted from the plan. Remaining is now the sum of each still-ahead scheduled workout individually, and a missed (already-past, never-completed) workout stays out of it without disappearing from the top-line Scheduled total. The \"X / Y workouts completed\" count now excludes Off days from Y. Shows up on the coach's week view, the roster dashboard, and the athlete's /plan week header -- one shared calculation, not three. A separate bug in the week-strip's collapsed next-week summary card is also fixed: an upcoming week made entirely of drafts listed every workout's real distance but summed to \"0.0 mi planned\" -- the total was filtering to published-only while the day list wasn't; now both agree.",
  },
  {
    date: "2026-10-20",
    headline: "Today's conditions guidance on the athlete's plan",
    detail:
      "Open /plan on a day with a workout scheduled, and -- when a location is available -- a quiet conditions card now shows today's weather and, for any workout with a pace target, what that pace becomes today: \"Tempo is 6:10/mi; in this afternoon's heat it'll run an estimated ~6:24 at the same effort.\" The adjustment is computed by the same environmental engine behind the Environmental Calculator and the conditions-adjusted-actuals work, never a new prescription -- the effort is still the target, the pace is just what that effort looks like today. A heat-caution note appears only once conditions cross the same real threshold the Heat Tracker already uses. No stored location yet triggers one quiet, optional \"use my location\" link, never an automatic prompt; no location or a weather-fetch hiccup just means no card, nothing else affected.",
  },
  {
    date: "2026-10-20",
    headline: "Fueling plans, computed automatically on long workouts and races",
    detail:
      "Open a scheduled long run or race on the coaching platform and -- when the session is long enough to need it -- a Fueling section now shows a complete, computed plan: a carb target in grams and g/hr, a real gel-by-gel schedule naming an actual product, and fluid and sodium targets, all generated by the same engine behind the Fueling Planner tool. Nothing is entered by hand and nothing is stored -- the plan is computed fresh from the workout's own current distance, duration, and intensity every time the page loads, so moving or extending a long run updates its fueling automatically. Athlete and coach see the identical card. Short easy runs and strides sessions get no card at all.",
  },
  {
    date: "2026-10-20",
    headline: "Conditions-adjusted actuals: what a Strava-matched run was really worth",
    detail:
      "Approve a Strava match on a completed workout, and the platform now automatically works out what that run was worth once heat, wind, and hills are accounted for -- using the same environmental engine behind the Environmental Performance Calculator, applied to the run's own real GPS trace and the weather at the time and place it happened. The workout detail page shows actual pace next to the ideal-equivalent, with the top contributing factors in seconds per mile and the raw conditions alongside for anyone who wants to check the math. No manual entry, ever -- and if there's nothing to analyze (a manually-logged completion) or analysis fails, nothing is shown that wasn't earned; a coach or athlete can always ask for it directly.",
  },
  {
    date: "2026-10-20",
    headline: "Intake gap-check: what a coach needs to know before planning, flagged, never blocked",
    detail:
      "Before planning depends on it, the platform now checks whether an athlete's intake is actually complete -- training environment and facility access, home altitude, a real baseline of their last few weeks of training, injury/limitations history, and schedule constraints, alongside the goal race and fitness anchor already tracked elsewhere. Missing items show up as a completion prompt on the athlete's own profile and \"Your Plan\" view, each linking straight to the field, and never reappear once answered. A coach sees exactly what's missing on the athlete's page and a neutral \"Intake incomplete\" badge on the roster. Nothing here blocks anything -- a coach who knows the athlete can assign and publish regardless.",
  },
  {
    date: "2026-10-20",
    headline: "\"Your Plan\": a welcome payoff for a newly assigned program",
    detail:
      "The first time a coached athlete opens their coaching home after a program lands, they now see a dedicated page before the raw schedule: their goal race and countdown, their program's phases explained in plain language, their anchored paces with the why behind each one, their first week at a glance, and one clear first action to take. Missing a goal race or a fitness anchor shows an inline way to add one right there, never a dead end. Dismissible, shown once, and reachable afterward from coaching home -- and a coach can preview exactly what their athlete will see from the program-assignment flow, same component either way.",
  },
  {
    date: "2026-10-20",
    headline: "Adaptation cards: the plan quietly watches itself, and tells the coach what it sees",
    detail:
      "A deterministic engine now scans each athlete's recent training for four specific patterns -- easy days consistently feeling too easy, fatigue stacking up, a plan that keeps coming in well over distance, or an athlete going quiet -- and surfaces a card on coach home and the athlete's schedule page showing the real evidence (the actual workouts and numbers that fired it) and one concrete proposed action. Nothing changes until the coach explicitly accepts: workout changes land as drafts, same as any other coach-authored edit, and a dismissed card stays quiet for two weeks unless new evidence fires it again. No scores, no ML -- every threshold is a stated rule.",
  },
  {
    date: "2026-10-20",
    headline: "Plan Realignment: a proposed way back in after missed training",
    detail:
      "When an athlete flags that they couldn't train (sick, traveling, life) -- or a coach starts it themselves from the athlete's schedule -- the system now drafts a revised version of the coming week: the first day back stays easy, the next key session and the long run get protected by moving them to a safely-spaced day rather than dropped, and easy/recovery sessions are shortened or dropped first to make room. Missed training is never made up, and rest days are never all eliminated to cram sessions in. Nothing changes until the coach reviews a plain-language diff of every affected workout, tweaks anything they want, and explicitly accepts it -- realigned workouts land as drafts, same as any other coach-authored change, and the athlete only sees them once published.",
  },
  {
    date: "2026-10-20",
    headline: "Roster became a real scanning dashboard",
    detail:
      "/coaching/roster now shows every athlete's current program/phase/week, this week's planned-vs-completed distance and workout count, when they last logged something and last checked in, and their next race with a countdown -- all in one row, no clicking into each athlete's schedule to find out. A quiet badge appears only when something's actually worth a look: a missed workout in the last week, a noteworthy RPE, no check-in in a week (for athletes on an active program), or no logged activity despite workouts being on the calendar -- plain facts, no compliance scores. Sorts by attention, name, or next race, client-side over the roster already loaded.",
  },
  {
    date: "2026-10-20",
    headline: "Athlete RPE and notes now show up right on the schedule tile",
    detail:
      "A coach scanning a week no longer has to open every workout to see how it actually felt: a logged RPE now shows on the tile itself (coach schedule and /plan alike), paired with the prescribed RPE only when they differ by 2 or more points -- that's the \"prescribed easy, felt hard\" signal worth noticing. A completed workout that ran 3+ points above its prescribed RPE (or 9+ with nothing prescribed) gets a subtle highlight while scanning, never a red flag. A note or comment shows as a small icon, never its text, on the tile -- the full note is still one click away. Strava-matched completions show nothing here, since Strava has no way to supply RPE or notes.",
  },
  {
    date: "2026-10-20",
    headline: "Planned vs completed, now visible on every workout tile and weekly rollup",
    detail:
      "Every workout tile across the coaching calendar and /plan -- Week, Month, both Timeline views, and the workout detail page -- now shows the prescription and, once logged, the actual: one clean number when you hit the target within about 10%, or the planned-vs-actual delta (\"8.0 mi planned → 6.2 mi\") when you didn't. A missed workout reads as muted, not flagged red, and there's no grading, scoring, or streak language anywhere -- a delta is information, not a judgment. Weekly Load now shows planned and completed distance and duration side by side on both the coach's schedule and the athlete's own /plan.",
  },
  {
    date: "2026-10-19",
    headline: "Fixed \"Today\" marking the wrong day in the evening",
    detail:
      "The coaching calendar and training schedule (Week, Day, Month, Phase, both Timeline views, and the date pickers within them) were resolving \"today\" in UTC, not the viewer's own timezone -- so anyone west of UTC (most of the Americas) could see the wrong day highlighted as Today once their evening had already crossed into UTC's next calendar day. Today, this week, and this month now resolve in whichever timezone the viewer's own browser reports.",
  },
  {
    date: "2026-10-19",
    headline: "Timeline view added to /plan -- athletes can now scroll their own schedule too",
    detail:
      "The continuous, scrollable Timeline that shipped on the coach's calendar is now available on an athlete's own training page, alongside the existing week view (a new Week/Timeline switcher, with Week still the default). It shows both self-created and coach-assigned workouts side by side, with the same sticky week headers, date-jump picker, and dense per-day figures as the coach side. Completing a workout from Timeline works exactly like it does from the week view, and the weekly mileage total now adds up self-created and coach-assigned workouts together, instead of only ever counting assigned ones.",
  },
  {
    date: "2026-10-19",
    headline: "Fixed a duplicate-week glitch in the coaching calendar's Timeline view",
    detail:
      "Scrolling Timeline far enough in one direction, then back, could re-fetch and re-insert a week that was already loaded -- visible as a flash where a day row sat half-covered under the week above it. The infinite-scroll loader was computing \"what's the next week to fetch\" from a stale snapshot of the loaded range instead of the current one; it now always reads the live range, and the merge that adds newly-loaded weeks now also guarantees no week can appear twice regardless of how scrolling or the date picker got there.",
  },
  {
    date: "2026-10-19",
    headline: "Timeline view added to the coaching calendar",
    detail:
      "A fifth way to browse an athlete's training alongside Week, Day, Month, and Phase: a continuous, scrollable Timeline with sticky week headers, the way TrainingPeaks, Final Surge, and Runna already work. It loads ~2 weeks behind and ~4 ahead on open and fetches more in either direction as you scroll, with a compact date picker for jumping straight to a far-off week without paging through months. Each workout tile shows distance, duration, and pace or effort inline -- denser than the other views' tiles, since that's the point of this one. Completing or editing a workout from Timeline uses the exact same editor the other views already use, so nothing about how workouts get marked done changed.",
  },
  {
    date: "2026-10-19",
    headline: "Coaching platform cleanup: six small fixes from production QA",
    detail:
      "A leftover dev seed command was showing up as real copy on three coaching empty states, pointing coaches at a shell command instead of just telling them to ask their admin. /coaching/roster had no link to it for a coach whose roster was still just themselves. A datalist used by the day-label, cross-training-type, and workout-extra pickers shared one hardcoded id across every instance on a page, so suggestions could show up on the wrong field once a form had more than one of them -- each now gets its own real id. A program's initial/peak mileage range inputs had no accessible label distinguishing the min from the max field, and a coach-less athlete's \"You're coaching yourself\" copy read as if they held a coach role; both are reworded/labeled now. An athlete's check-in note is guaranteed to render in full in the coach's view, with a scrollable max-height instead of an unbounded block.",
  },
  {
    date: "2026-10-19",
    headline: "Fixed: athletes couldn't see their coach or their assigned workouts",
    detail:
      "Two bugs found in production QA, both athlete-facing. After accepting a coach's invite, an athlete's /coaching page kept saying \"You're coaching yourself\" -- caused by a self-coaching row and a real-coach row both being active at once, with no guaranteed preference for which one a query returned; coach lookups now always prefer the real relationship. Separately, a coach-assigned workout never showed up on the athlete's own weekly schedule (though it worked fine from its notification link) because that view only ever queried self-created workouts; it now also pulls in assigned ones, including their mileage in the weekly total.",
  },
  {
    date: "2026-10-19",
    headline: "Course Comparator launched",
    detail:
      "A new tool for the question that comes before pacing: which of two courses is actually harder, and by how much. Import a GPS route or enter a course map manually for each side (independently -- GPS vs. GPS, manual vs. manual, or mixed), and it shows side-by-side elevation profiles, each course's gain/loss and hilliest mile, and a grade-adjusted difficulty delta in seconds per mile, using the same grade heuristic the Race Pace Planner already uses.",
  },
  {
    date: "2026-10-19",
    headline: "Marathon Pacing Calculator and Race Pace Planner merged into one tool",
    detail:
      "These two race-day planning tools overlapped enough to be confusing: one took a GPS file and the other a hand-entered course map, but both ultimately answered \"how should I pace this marathon.\" The Race Pace Planner (at /race-pace-planner) is now the one tool, with a GPS-route-or-manual-entry choice up front -- upload a GPX/TCX/FIT file (or import from Strava) and elevation is extracted automatically, or enter total gain/loss and the handful of hills worth naming if you don't have a file. The old /marathon-pacing-calculator URL redirects here.",
  },
  {
    date: "2026-10-15",
    headline: "Batch-publish drafts: a whole week, day, or phase at once",
    detail:
      "Publishing a week of assigned drafts used to mean opening each workout's edit modal one at a time to check \"Published.\" The schedule now offers a one-click \"Publish\" button with an inline confirm at the week, day, and phase level, each scoped to only that range's still-draft workouts -- already-published, completed, or missed workouts are left untouched.",
  },
  {
    date: "2026-10-15",
    headline: "Notification fixes: no more duplicate check-in alerts, program assignments now notify",
    detail:
      "A coach was getting a fresh \"X submitted a check-in\" (and, if pain was flagged, a second \"X reported pain\") every time an athlete edited an already-submitted weekly check-in, not just the first submission -- caught live on staging and fixed to only notify on what's actually new. Assigning a program to an athlete now also sends them a real notification that their schedule changed, which it previously didn't.",
  },
  {
    date: "2026-10-15",
    headline: "Strength training scheduled into assigned programs",
    detail:
      "A coach assigning a program can now attach a real strength-training routine, and it's scheduled onto the athlete's actual calendar rather than noted as a side recommendation. Placement is purely additive: it only attaches to easy-run days the program already scheduled, so a long run, threshold day, or interval session is never touched or displaced.",
  },
  {
    date: "2026-10-15",
    headline: "Training-background intake for new athletes",
    detail:
      "A coached athlete can now record what their training actually looked like before joining -- a previous coach, a self-trained buildup, or no structured training at all, with peak/recent mileage and injury history where it applies. The coach sees this in the athlete's schedule view and it feeds plan-selection guidance, so a self-trained athlete's real history counts the same as a prior coach's, and a true beginner gets routed to the 5K Crash Course instead of an assumed buildup.",
  },
  {
    date: "2026-10-15",
    headline: "Structured post-season review for athletes",
    detail:
      "When a coach sends a post-season review, the athlete now gets a real guided form instead of a free-text prompt: a set of structured questions about what worked, what didn't, and how the cycle actually felt, captured while it's fresh. The coach sees the structured answers directly in that athlete's schedule view once submitted, and both the send and the submission trigger a notification routed straight to the right place.",
  },
  {
    date: "2026-10-14",
    headline: "Fueling Calculator launched",
    detail:
      "A new tool turns body weight and a goal time into concrete race-week fueling numbers: a target carb rate (with a gut-training step-up protocol when your current comfortable rate is lower), a gel-by-gel in-race schedule, carb-loading and pre-race breakfast gram targets, and a weight-scaled caffeine dose with two-dose timing. It shares its gel-timing and caffeine-timing logic with the Race Pace Planner and its caffeine dosing with the Endurance Fueling Calculator, rather than reimplementing either.",
  },
  {
    date: "2026-10-14",
    headline: "Heat Tracker recalibrated to marathon-performance research, with a new heat-acclimation toggle",
    detail:
      "The tracker's flag bands now follow how ambient conditions actually affect marathon-distance performance: a 35-55°F ideal band, a new cold zone under 35°F where gear (hat, gloves, arm warmers) covers most of the effect, heat starting to cost real time above 60°F, and humidity's amplifying effect called out once WBGT crosses 70°F. A new \"heat acclimated?\" toggle softens the heat-zone guidance for a runner with 2+ weeks of recent heat training, and hot conditions now surface a conservative, effort-over-pace race-day tip alongside a full acclimation protocol (build timeline, decay and maintenance, sauna/hot bath as a supplement, and hot-workout-day pacing tactics).",
  },
  {
    date: "2026-10-14",
    headline: "Race Pace Planner launched",
    detail:
      "A new tool turns a goal marathon pace into a race-day plan: a mile-by-mile pace table with a progressive or even start and a fast finish, a simplified grade adjustment for any climbs or descents you name, a gel-by-gel fueling schedule with an optional two-dose caffeine protocol, and segment-by-segment race strategy. It's a lighter-weight, course-map-based sibling of the Marathon Pacing Calculator for a quick plan without uploading a GPS route.",
  },
  {
    date: "2026-10-13",
    headline: "The five marathon frameworks and the 5K Crash Course are now assignable program templates",
    detail:
      "Canyon, Mesa, Ridge, Peak and Summit are available in a coach's program library as complete 18-week templates, each with its own phase boundaries, per-week goal mileage, and day-by-day prescriptions carried verbatim from the source plans. A coach picks the peak-volume level at assignment time (Canyon at 40 or 50 miles a week, Summit at 100, 110 or 120), which is what drives the week-by-week mileage targets the athlete sees. The three levels of the 5K Crash Course ship alongside them, for athletes who need a first fitness estimate before a marathon buildup can be paced at all.",
  },
  {
    date: "2026-10-13",
    headline: "Coached athletes now get the \"why\" behind each phase and each workout, plus a training education library",
    detail:
      "Every training phase a coach assigns can carry its own explanation of what the block is for, which capabilities it builds, and what its paces are based on, and the athlete reads it on a new roadmap page of their own at /coaching/training. Each workout detail page now also explains what that kind of session is and what it builds, and three new guides cover how training works, pacing and effort, and fueling and hydration. The workout log asks for effort level and conditions alongside RPE, so a coach reviewing a fitness estimate can tell a bad day apart from a wrong estimate. All of it is visible only to athletes with an active coach, and to that coach.",
  },
  {
    date: "2026-10-13",
    headline: "Workout notifications now say \"updated\" instead of \"assigned\" on an edit, and cover moving or deleting a live workout",
    detail:
      "Re-saving a published workout after a small edit used to notify the athlete as if it were a brand-new assignment every time, and moving or deleting a workout the athlete could already see sent no notification at all. Athletes now get an \"updated\" notification for a re-published edit, a moved date, or a removal -- never for an unpublished draft, which stays invisible to them either way. Unchecking \"Published\" on an already-live workout while editing it also now asks for confirmation first, since an athlete may already be following it.",
  },
  {
    date: "2026-10-13",
    headline: "Assigning a Program over an existing training block, and resyncing an assigned phase, both got real options",
    detail:
      "Assigning a Program to an athlete used to abort entirely if its date range overlapped an existing training phase, with no supported way to replace that block short of clearing it manually first. The assign flow now shows exactly which phase(s) would be removed and lets a coach confirm \"clear and assign\" in one step. Separately, editing a Program after it's already been assigned to an athlete never used to reach that athlete -- a new \"resync from program\" action on an assigned phase pulls in the Program's current content, after a confirm that shows how many workouts would be replaced.",
  },
  {
    date: "2026-10-13",
    headline: "Fixed the marathon plans showing the goal race as 26.1mi instead of 26.2mi",
    detail:
      "Every marathon plan's own goal-race day was being rescaled along with the rest of the week whenever the plan's target peak weekly mileage didn't round to a whole number -- which it almost never does -- quietly shaving a tenth of a mile off a fixed, real-world distance. The goal race day no longer scales with the rest of the plan. The pace calculator's \"Coming Soon\" button for a personalized training plan, left over from before the plan builder shipped, now links to it directly.",
  },
  {
    date: "2026-09-25",
    headline: "Fixed a full-page crash when uploading a large photo (article images, avatars)",
    detail:
      "Uploading an image over roughly 8-9MB -- an easy size for an unedited phone photo -- crashed the whole page instead of showing a normal \"image too large\" message, because the size check only ran after the file had already been sent, past the point a normal error could be shown. Oversized files are now caught immediately, before upload, with a clear inline message.",
  },
  {
    date: "2026-09-24",
    headline: "Threshold, CV & VO2 Max Pace Calculator upgraded to a substantially larger fitness model, and the age input is gone",
    detail:
      "The calculator's underlying model was rebuilt on its source project's newest fit -- 613,889 real race performances instead of roughly 8,600 -- which no longer includes age as an input at all, so that field has been removed here too. In its place, uncertainty ranges are now adjustable (80%, 90%, 95%, or hidden) instead of fixed at 90%. The Marathon Pacing Calculator, which shares this same fitness model, picked up the same change.",
  },
  {
    date: "2026-09-22",
    headline: "Two new calculators launched: Altitude-Adjusted Pace and Endurance Fueling",
    detail:
      "Both were built the same way as the Tinman and Threshold/CV/VO2max calculators: independently reverse-engineered by collecting real inputs and outputs from a specific third-party calculator, not by reading its source. Altitude-Adjusted Pace converts a race or training performance between altitudes, accounting for home-altitude acclimation, and sits alongside (not in place of) the existing Altitude Calculator's VO2max/capacity conversion, which answers a related but different question. Endurance Fueling gives carb, fluid, and sodium targets by effort intensity, gut training, body weight, and heat.",
  },
  {
    date: "2026-09-04",
    headline: "New Physiology content drawn from Marathon Excellence for Everyone",
    detail:
      "Exercise Physiology, Data & Analytics, the Workout Library, Nutrition & Fueling, the Research Library, and Marathon Training were substantially expanded, sourced from John J. Davis's Marathon Excellence for Everyone and independently verified against the research it cites. The most consequential single change: Exercise Physiology's existing \"lactic acid\" and acid/alkali framing, accurate to the physiology understood when Lydiard's programs were built, is now paired with a correction explaining what modern lactate-shuttle research actually found, without deleting the original coaching logic built on top of it. New sections cover what actually drives a sustainable pace ceiling versus VO2 max, the three physiological domains of training intensity, and why marathon pace erodes late in a race even when VO2max and running economy don't change.",
  },
  {
    date: "2026-08-25",
    headline: "Fixed the logo shown in link previews",
    detail:
      "The image social apps and messaging clients show when a Haarchive link is shared was still built from an older two-tone version of the wordmark. It now uses the current single-color mark.",
  },
  {
    date: "2026-08-25",
    headline: "Mobile navigation now shows all six categories directly, and the homepage launch banner is gone",
    detail:
      "The hamburger menu no longer nests Physiology, Psychology, Philosophy, Practice, Library, and Tools behind a \"Learn\" accordion -- all six are visible and tappable right away, matching how desktop already treats them as independent top-level items. The homepage's \"New Tool\" strip for the Environmental Performance Calculator was also retired; the calculator itself is unchanged and still reachable from Tools.",
  },
  {
    date: "2026-08-25",
    headline: "Fixed missing \"new signup\" notifications for accounts confirmed by email",
    detail:
      "Admins were only ever notified about new signups completed through Google, since the check for \"is this really a brand-new account\" compared account-creation time to first-sign-in time and assumed the two would land within a few seconds of each other -- true for OAuth, but never true for an email/password signup, where a real person has to go check their inbox first. It's now a direct, idempotent check instead of a timing guess.",
  },
  {
    date: "2026-08-25",
    headline: "A real light/dark toggle, and the article and Library/Tools pages were rebuilt around the new editorial identity",
    detail:
      "The site now defaults to your system's light/dark preference with a real toggle in the header, instead of always opening dark. Article pages, the Articles overview, and the four domain landing pages (Physiology, Psychology, Philosophy, Practice) were rebuilt around quiet numbered/editorial indexes instead of bordered card grids. The Tools page now groups calculators into Pacing, Environment, and Physiology, keeps each tool's own icon for quick recognition, and separates \"Choosing a Pace Calculator\" out as guidance rather than presenting it as a 12th tool.",
  },
  {
    date: "2026-08-25",
    headline: "New Foundations content drawn from Running with the Buffaloes and Daniels' Running Formula",
    detail:
      "Real-world case studies and coaching detail from Chris Lear's Running with the Buffaloes and Jack Daniels' Running Formula were woven into existing pages across Physiology, Philosophy, and Practice (pacing execution, altitude and terrain training, recovery, coaching individualization), and Mark Wetmore, Jack Daniels, and Adam Goucher's Coaching/Athlete Library entries were enriched with newly-documented detail.",
  },
  {
    date: "2026-08-21",
    headline: "The Environmental Performance Calculator got more accurate on hilly routes, and can now factor in altitude",
    detail:
      "Uploaded routes with a lot of short climbs and descents were being under-costed, since the model only looked at each mile's net elevation change rather than the real climbing and descending inside it -- fixed, and the same fix carried over to Marathon Pacing Calculator's per-mile terrain notes. The calculator can also now account for a course's altitude above sea level, since thinner air costs real time even on a flat course; it's pulled in automatically when weather is looked up, or entered by hand.",
  },
  {
    date: "2026-08-21",
    headline: "Fixed co-authors being unable to reach their own article drafts",
    detail:
      "A writer added as a second author on someone else's article draft was being redirected away from My Drafts and the editor instead of reaching the piece they're a real, listed author on -- now fixed.",
  },
  {
    date: "2026-08-21",
    headline: "Signed-out readers can now see what signing in would unlock",
    detail:
      "The calculators' \"Save this result\" button used to be invisible if you weren't signed in, instead of showing what signing in would let you do -- it now shows a real sign-in prompt. Signed-out readers also see a small note after an article pointing at what a free account tracks for them: reading progress, notes, and bookmarks.",
  },
  {
    date: "2026-08-19",
    headline: "Learning Progress launched: a real sense of what you've mastered, not just read",
    detail:
      "Signed-in readers now get a starting-topic recommendation, four guided learning paths, and a mastery level per topic that's earned through real engagement and correctly-answered knowledge checks, not just having opened the page -- passive reading alone can't reach the top tier. Knowledge checks show your position (e.g. \"2 of 3\") and correctly move to the next question or mark a topic complete.",
  },
  {
    date: "2026-08-19",
    headline: "Highlight-to-note, Bookmarks, and a personal Library",
    detail:
      "Signed-in readers can now highlight any passage to leave a note that autosaves and links back to the exact spot, bookmark a topic to return to later, and see all of it -- notes, bookmarks, continue-reading, and learning history -- gathered on one new Library page.",
  },
  {
    date: "2026-08-12",
    headline: "Site navigation and mobile search were redesigned",
    detail:
      "The header's Learn menu is now a two-pane flyout (categories on the left, that category's own pages on the right) instead of one long flat list of every section at once. On mobile, search became a tap-to-open icon next to the menu button instead of a permanently visible bar taking up space on every page.",
  },
  {
    date: "2026-08-12",
    headline: "Admin notifications now cover signups, questions, and contributor applications",
    detail:
      "The admin notification bell (added in July for comments and review assignments) now also fires for new signups, new question submissions, and new contributor applications -- previously silent events an admin had no way to learn about without manually checking each page.",
  },
  {
    date: "2026-07-30",
    headline: "The homepage got real photos, diagrams, and a dark-mode-only redesign",
    detail:
      "Every placeholder on the homepage (the My Story timeline, the coaching-books photo, a real training log, the supercompensation-curve diagram, a live calculator screenshot) is now a real image or a hand-drawn diagram instead of a labeled box. The site also moved to dark mode only, with two new accent colors added to the palette, after light mode consistently tested worse.",
  },
  {
    date: "2026-07-30",
    headline: "Article authoring got photo uploads, cropping, and a real tag library",
    detail:
      "Contributors can now attach cover and inline images to a draft, crop them before publishing, and tag an article from a curated, admin-managed list instead of typing free text. This came alongside a broader design-consistency pass across article headers, credits, and citations.",
  },
  {
    date: "2026-07-30",
    headline: "Calculators can now be embedded directly inside a lesson",
    detail:
      "Several Foundations pages can drop a live, working calculator (training heart rate, easy-run ceiling, tempo pace, hydration) directly into the middle of the prose, right where it's actually relevant, instead of only linking out to the Tools index.",
  },
  {
    date: "2026-07-27",
    headline: "The article editor became a real formatted writing surface",
    detail:
      "Drafting an article now supports bold/italic/underline, inline links, nested sub-bullets, and drag-and-drop reordering of content blocks, edited live rather than through a form with separate preview. Reviewers' comments now show up directly on the contributor's own draft view, not just in the review queue.",
  },
  {
    date: "2026-07-27",
    headline: "Every piece of a runner's data is now editable after the fact",
    detail:
      "Race results, goals, workout completions, injuries, weekly check-ins, saved calculator results, suggestions, and coach rosters can all be corrected or removed once entered, closing out the last of a long backlog of one-way, un-editable data entry.",
  },
  {
    date: "2026-07-27",
    headline: "Real-time notifications and a full account-detail view for admins",
    detail:
      "A notification bell in the header now surfaces things that need your attention (a new comment, a review assignment) as they happen. Admins also gained a single page per user showing their full account detail, replacing a scattered set of separate lookups.",
  },
  {
    date: "2026-07-26",
    headline: "The site opened to public community registration",
    detail:
      "Anyone can now sign up and get a public profile, not just invited coaches and contributors, and the article-contributor picker was fixed to actually reflect who's eligible rather than listing every signed-up user.",
  },
  {
    date: "2026-07-26",
    headline: "Four new fitness-tracking views landed on the dashboard",
    detail:
      "An acute:chronic workload ratio (ACWR) card flags injury-risk-relevant training spikes, a Performance Trends chart plots race results over time, a Training Load view surfaces the same fatigue math the Marathon Pacing Calculator uses, and an on-demand aerobic-decoupling check reads a Strava-synced run's own heart-rate drift.",
  },
  {
    date: "2026-07-26",
    headline: "Marathon Pacing Calculator gained a Monte Carlo race-day simulation",
    detail:
      "The calculator can now run thousands of simulated race outcomes against your goal, sampling real uncertainty from both the fitness model and the physiology engine, instead of returning one deterministic pace plan. It's also now wired to real weather forecasts and real per-mile route grade for an uploaded course, rather than manual entry.",
  },
  {
    date: "2026-07-26",
    headline: "Fixed a real heart-rate-zone calculation bug",
    detail:
      "The Pace & Heart Rate Calculator and the Threshold HR Reference calculator were quietly computing different Karvonen heart-rate zones for the same female-runner inputs, one applying an adjustment the other didn't. Both now share one heart-rate model, and a full design review of every calculator on the site was done to look for the same class of bug elsewhere.",
  },
  {
    date: "2026-07-26",
    headline: "The site now explains why two calculators can disagree",
    detail:
      "Pace & HR, CV-Threshold, and Tinman all answer a version of \"what pace should I train at,\" using genuinely different models, and used to just show different numbers with no explanation. There's now a direct explanation of why that happens and what each model is actually measuring.",
  },
  {
    date: "2026-07-25",
    headline: "Marathon Pacing Calculator launched",
    detail:
      "A new calculator that builds a full mile-by-mile race plan (pace, fatigue, fueling) from a real physiology model, course analysis, and environmental conditions, rather than a flat goal pace. It's the first tool on the site to compose several existing engines (grade/energy cost, wind, heat/humidity) into one integrated plan.",
  },
  {
    date: "2026-07-25",
    headline: "Six new calculators, and Training Plans became interactive",
    detail:
      "Tinman, Threshold/CV/VO2max, LT1 & LT2 HR Reference, Pace Percent, and Race Pace all launched the same day, each cross-linked from the others where they answer related questions. Training Plans was rebuilt from a static list into a browsable, interactive marathon-plan picker.",
  },
  {
    date: "2026-07-25",
    headline: "Reviewers can leave comments directly on a draft",
    detail:
      "An assigned reviewer can now comment on a contributor's article in progress instead of only leaving feedback once it's submitted for review.",
  },
  {
    date: "2026-07-15",
    headline: "Coaching Library and Athlete Library launched",
    detail:
      "An encyclopedia of major coaching philosophies (what each one believes and why, not just workouts) alongside real athletes whose training shows that philosophy in practice. A Contact form and a Contributor Applications flow shipped the same day.",
  },
  {
    date: "2026-07-15",
    headline: "Homepage announcements and contributor question threads",
    detail:
      "The homepage can now surface a dismissible announcement banner for site-wide news, and contributors gained threaded discussion on the questions they're helping answer.",
  },
  {
    date: "2026-07-14",
    headline: "Environmental Performance Calculator and GAP Calculator launched",
    detail:
      "The Environmental Calculator adjusts a goal time for heat, humidity, wind, and elevation using real published models rather than a rule of thumb. GAP Calculator converts a graded effort to its flat-ground equivalent using the same underlying physics.",
  },
  {
    date: "2026-07-13",
    headline: "Navigation, search, and the Questions feature were rebuilt",
    detail:
      "Site search became persistent (available from any page) and body-text-aware rather than title-only, with a dedicated /search page. The Questions feature launched the same week, letting readers ask something and get a real answer that can link back into the content library.",
  },
  {
    date: "2026-07-13",
    headline: "Mental Performance expanded into five focused pages",
    detail:
      "What had been one broad page split into five (including a new For Coaches page on leadership and team culture), each cross-linked into the rest of the site instead of living in isolation.",
  },
  {
    date: "2026-07-12",
    headline: "Nutrition & Fueling section added",
    detail:
      "Carbohydrate strategy, hydration and electrolytes, and legal performance aids, grounded in modern sports-nutrition evidence rather than the honey-and-salt-tablets folklore still common in older coaching writing.",
  },
  {
    date: "2026-07-11",
    headline: "Fixed Strava sync missing team-scheduled sessions",
    detail:
      "A synced Strava activity wasn't always being matched back to the specific session a coach had scheduled for that athlete; sync now correctly reconciles against the athlete's actual assigned plan.",
  },
  {
    date: "2026-07-10",
    headline: "Coaches can build a season and a shared weekly schedule",
    detail:
      "A coach can now define a season, preview its phases and race calendar before creating it, and author one shared weekly schedule per training group, including a spreadsheet-style bulk-entry grid and the ability to publish specific weeks rather than a whole season at once.",
  },
  {
    date: "2026-07-10",
    headline: "Athletes got a real training log instead of a checkbox",
    detail:
      "Logging a completed workout now captures distance, time, heart rate, RPE, and notes, not just a done/not-done toggle. Coaches gained a season-wide race-results page to track every athlete's results against their goal in one place.",
  },
  {
    date: "2026-07-10",
    headline: "Training groups and coach-managed rosters",
    detail:
      "Coaches can organize athletes into groups (varsity, JV, frosh), invite by domain with automatic join, and manage who belongs where, with row-level database security enforcing that a coach only ever sees their own team's data. This also included a mobile-hardening pass (larger touch targets, loading skeletons, an app-wide error boundary) across the new coach pages.",
  },
  {
    date: "2026-07-09",
    headline: "An AI layer that explains and adapts your training plan",
    detail:
      "The site can now explain, in plain language grounded in its own educational content, why a specific session was prescribed, and adjust a plan through real tool-calling (\"I only have 35 minutes today\" resolves to an actual deterministic schedule change, not a freehanded response). The underlying model provider was switched to Groq for rate-limit headroom.",
  },
  {
    date: "2026-07-09",
    headline: "A deterministic training-plan engine, and a redesigned dashboard",
    detail:
      "Pace/HR zones, mileage progression, periodization, and calendar scheduling are now computed by plain, tested functions rather than hand-built per plan, with every number traceable back to code a test can verify. The Dashboard and Training Plan pages were rebuilt around this engine the same week.",
  },
  {
    date: "2026-07-08",
    headline: "Accounts, Google sign-in, and heat-adjusted workouts",
    detail:
      "Signing in with Google unlocks a real account: saved goals, a settings page, and workouts automatically adjusted for forecast heat. A privacy policy was added the same day for OAuth verification.",
  },
  {
    date: "2026-07-08",
    headline: "Strava activity sync",
    detail:
      "Connecting a Strava account lets a completed run automatically fill in a scheduled workout's actual distance, time, and heart rate, instead of requiring manual entry.",
  },
  {
    date: "2026-07-07",
    headline: "The site's content library got substantially deeper",
    detail:
      "New material from Arthur Lydiard's Running to the Top, Matt Fitzgerald's 80/20 Running and How Bad Do You Want It?, and original coaching notes was added across eight sections, with Stephen Seiler correctly credited as the researcher behind polarized training rather than the popular-press book that cites him.",
  },
  {
    date: "2026-07-07",
    headline: "The About page became the homepage",
    detail:
      "What had been a secondary About page was redesigned as the site's actual front door, with a real hero, a My Story timeline, and a deeper Coaching Library section.",
  },
  {
    date: "2026-07-07",
    headline: "Tools category launched with the Heat Tracker",
    detail:
      "The first calculator on the site: a live WBGT (Wet Bulb Globe Temperature) chart with heat-illness risk flagging, resolving the visitor's location automatically. It shipped with an interactive, scrubbable chart and real cited research behind its guidance from day one.",
  },
  {
    date: "2026-07-06",
    headline: "The Haarchive launched",
    detail:
      "The site went live for the first time: a Next.js skeleton, renamed from a generic placeholder to The Haarchive, deployed to its own domain the same day.",
  },
];
