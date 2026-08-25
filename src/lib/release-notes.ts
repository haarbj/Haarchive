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
