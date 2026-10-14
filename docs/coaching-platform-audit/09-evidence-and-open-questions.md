# 09 — Evidence and Open Questions

Traceability index, honest limitations, and every decision that needs Brody's input before implementation. Nothing in this document is new analysis — it's a map back to where every conclusion in `00`–`08` actually came from, plus what this audit could not verify.

---

## 1. Repository files inspected

Full file-level inventories are preserved in `01-current-architecture.md` (the coach-surface, athlete-surface, and schema/state-machine/test inventories, each originally produced by a dedicated exploration pass and reconciled into that document). Not re-listed here to avoid a second, drifting copy — `01` is the owning document for "what was inspected in the codebase."

Directly inspected in this session, beyond the exploration passes: `docs/private-coaching/prd.md`, `trd.md`, `coaching-calendar-audit.md`; `supabase/migrations/*.sql` (36 files, direct grep for `scheduled_workouts` column additions and enum definitions); `CLAUDE.md`'s design-system and mobile-pattern sections (§2, §3, §7, §9); the live staging database (direct queries against `coach_athletes`, `scheduled_workouts`, `user_permissions` for the test accounts used in the browser walkthrough).

## 2. Source URLs (competitive research)

All URLs cited inline in `02-competitive-research.md`, each attributed as VENDOR CLAIM / FIRSTHAND / THIRD-PARTY at the point of citation. Not duplicated here — see `02` directly.

## 3. Verified vs. suspected — the full list

Every defect carries a verdict in `01` (code-level) or `03` §3 (live, where re-tested). Summary:

**Verified live** (reproduced in the browser against real staging data during this audit, not just read from source): D3 (athlete history gap — 8 real published workouts, 0 reachable), D10 (dashboard blindness — confirmed by direct text-content check), D12 (mobile calendar overflow — direct screenshot), the mobile modal defect (direct screenshot), the ambiguous "+ Add" affordance (direct interaction).

**Verified in code, not independently re-derived live in this pass**: D1, D2, D4, D5, D6 (live repro attempted, inconclusive per method limitation — `03` §1.4), D7, D8, D9, D11, D13, D14, D16. Each has a direct file-path/line-number citation in `01`; none of these is a guess, but none was additionally confirmed by driving the actual UI to trigger it.

**Suspected, code-derived only, lowest confidence**: D15 (two check-in forms — the field-set and week-math divergence was read from both files but not triggered live to observe an actual data collision).

## 4. Unavailable tools and their actual impact

| Tool/capability | What happened | Actual impact on this audit |
|---|---|---|
| Three parallel competitive-research passes | All three initially hit a session-level rate limit before returning; re-run to completion later in the engagement | **Resolved, not a standing limitation.** `02-competitive-research.md` now covers the full planned Tier 1 and Tier 2 sweep (TrainingPeaks, Final Surge, V.O2, Nolio, Coachbox, Humango, intervals.icu, plus the status checks that found Today's Plan dead and CoachNow/Runna out of category, and the Garmin/WHOOP/Strava/Linear/Notion/Material/Carbon/Cloudscape interaction references). Two residual collection limits are stated in `02`'s method note: Garmin's and WHOOP's first-party support pages and V.O2's marketing pages returned 403/401 to automated retrieval, so those specific claims rest on device manuals, vendor blogs, public help centers, and credible third-party walkthroughs rather than first-party marketing pages. |
| Playwright / real browser testing | Initially blocked by an unrelated environment bug (`NODE_ENV=production` in the shell silently causing `npm install` to skip all devDependencies, discovered and fixed mid-engagement) and a magic-link auth flow mismatch (the app's `/auth/callback` route only handles the PKCE `?code=` flow; this Supabase project's magic-link template returns implicit-flow hash tokens instead, which the callback route doesn't process) | Resolved by setting known passwords on staging test accounts and driving the real login form — not a limitation in the end, but worth recording as a real rough edge in this environment for any future automated-auth need. |
| `npm run test:rls` | First attempt failed against stale leftover state from a prior session; succeeded cleanly after a manual `rm -rf .rls-test-db` | Not a limitation — documented in `07` §1 as a rough edge in the harness's own idempotency, not a capability gap. |
| A dedicated accessibility pass (keyboard nav, screen reader, touch-target audit) | Not attempted — out of the time budget for this pass | Named explicitly as unverified in `03` §5 and `06` §5; `06` specifies the *requirements* without claiming they were tested. |
| Drag-and-drop interaction testing | Not attempted live | The backdrop-click-save repro (D6) is the only interaction-level test attempted and it was inconclusive; drag-and-drop itself was read from code only. |

## 5. Decisions that require Brody's approval before implementation

Stated once each, not duplicated from where they're introduced in `04`/`05`/`08`:

1. **Review surface** (`04` §2.5). **Now recommended with real confidence rather than left open**, and the recommendation changed: a single reverse-chronological "needs review" list, not a roster compliance dashboard. The completed research showed that every dashboard-style implementation surveyed (Nolio, Humango, Canary) targets rosters an order of magnitude larger than this one, and that the actual need at this scale is not forgetting anyone rather than discovering who to look at. Still worth Brody's explicit sign-off, since it reverses this audit's own earlier recommendation, but it is no longer a coin-flip between two equally-supported options.
2. **Material-change threshold** — exactly which field changes on a published workout require a revision reason (`05` §1.2.4 proposes date/target/purpose as material, day-label wording as not; this line needs to be drawn deliberately, not inferred).
3. **`training_plan`/`training_phases` merge** (`05` §2.1) — the recommendation is to extend `training_phases` rather than add a parallel `training_plan` entity; confirm this reading of the existing schema's intent is correct before building on it.
4. **`/coaching` vs. `/coach` navigation boundary** (`05` §1.3) — the audit recommends keeping the two products architecturally separate while converging on one prescription vocabulary; it does not resolve the nav-level confusion for a coach who does both, since `/coach` itself was out of scope for this pass. This needs a real decision once (if) `/coach` is ever audited to the same depth.
5. **Post-relationship retention** — the blueprint's own recommended default (athlete keeps a read-only copy; former coach loses access; export/deletion governed by the site's existing privacy policy) is not contradicted by anything found, but was not independently evaluated against this site's actual privacy policy text in this pass.
6. **Publishing unit — resolved by evidence; no longer an open question.** Previously "very likely one week, unconfirmed." The completed research (`02` §2) found three distinct market camps and one clear best answer: hidden-by-default with publishing as a first-class, logged, reversible event (V.O2's model, converged on over eight years). `05` §1.2 invariant 3 was rewritten to adopt it, and records the intermediate recommendation it replaced — a visibility horizon — along with why that was wrong, since a horizon cannot make next Tuesday private. Nothing here needs Brody's decision beyond ordinary approval of `05`.
7. **Minimum pilot metrics** — the blueprint proposes publish time, log rate, review turnaround, and off-platform clarifications. No analytics instrumentation exists today for any of these (confirmed: `prd.md` §7 states none was built). Deciding to instrument these is a real scope addition to Stage 1, not free.

## 6. What would most change this audit's conclusions if it turned out to be wrong

Named honestly, in case any of these load-bearing assumptions doesn't hold:

- **"Pre-launch, test data only" is the single most load-bearing constraint in this entire audit.** Every schema-breaking recommendation in `05` and every "just re-seed" migration note assumes this. If real athlete data exists anywhere this audit didn't check, `05` §6 and `08` Stage 0 need to be rewritten around a real migration plan, not a re-seed.
- **The three exploration-agent reports that `01` is built from were not independently re-verified line-by-line in this session** — they were reconciled and cited, and several of their specific claims (D1, D2, D5, D7 especially) were spot-checked against the actual files during synthesis, but a full independent re-read of every cited line number was not performed given the time budget. Confidence is high (the agents' own methodology required direct file citation throughout), but this is a real, stated limitation rather than an implicit claim of exhaustive re-verification.
- **Two of this audit's recommendations were reversed by evidence arriving after they were first written** (`05` §1.2's publication model, `04` §2.5's review surface). Both reversals are recorded in place rather than silently applied, so a reader can judge the reasoning rather than only the conclusion. The general lesson is worth stating: this audit's code findings were verified directly and are stable, but its *product* recommendations proved sensitive to how much of the market had been surveyed. Any remaining product recommendation that cites only one competitor should be treated as provisional in the same way.
- **The research is now broad but remains entirely outside-in.** No product was used behind a login. Help-center documentation describes intended behavior, which is not always shipped behavior, and vendor blogs describe the version the vendor wants discussed. Where a finding is load-bearing — V.O2's publish log in particular, which `05` §1.2 now builds on — it rests on that vendor's own public documentation rather than on observed use. That is a reasonable basis for a design decision and a poor basis for a claim about how well it works in practice.
