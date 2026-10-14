# 02 — Competitive Research

**Method.** Web research only. No product behind a login or paywall was used, and no walkthrough in this document is invented: where a behavior could not be verified, it says so. Every claim is labeled **[FIRSTHAND]** (an open vendor help article or product page directly describing current UI/behavior), **[VENDOR CLAIM]** (marketing or product-blog assertion), or **[THIRD-PARTY]** (independent review, press, or forum).

**Coverage.** This document now covers the full Tier 1 and Tier 2 sweep the audit's plan called for. An earlier draft was materially narrower because three research passes were cut short by a session rate limit; that gap has since been closed and this document supersedes it. Two collection limits remain and are stated rather than smoothed over: Garmin's and WHOOP's first-party support pages returned 403/401 to automated retrieval, so claims about them rest on device manuals, vendor blogs, and credible third-party walkthroughs; and V.O2's marketing pages also returned 403, though its help center is fully public and was read directly.

---

## 1. Market structure — consolidation is the backdrop for everything else

**[FIRSTHAND, Garmin newsroom + investor relations]** On 22 July 2026 Garmin acquired **TrainingPeaks and TrainHeroic**, the leading endurance and strength coaching platforms, bringing roughly 120 combined staff in-house. ([Garmin Newsroom](https://www.garmin.com/en-US/newsroom/press-release/corporate/garmin-acquires-trainingpeaks-and-trainheroic-leading-endurance-and-strength-training-platforms-for-athletes-and-coaches/))

**[THIRD-PARTY]** That is one event in a pattern. Strava acquired **Runna** in April 2025. Specialized acquired **Today's Plan** in 2019 and shut it down on 12 March 2024, taking Stages' training log with it since that ran on the same infrastructure. Wahoo killed RGT in 2023. ([the5krunner, 24 Jul 2026](https://the5krunner.com/2026/07/24/coach-platforms-still-independent-after-garmin/), [Endurance Sportswire](https://www.endurancesportswire.com/todays-plan-announces-closure/))

The independent coach-facing tier that remains is small, mostly European, and several of its members are bootstrapped or one-developer operations: Nolio, Coachbox, Good Coach App, Training Tilt, Humango, Athletica, TriDot, V.O2.

**Two implications for this product, and the second is the more actionable one:**

1. The dominant coach-facing platform is now owned by a hardware company whose incentive is deeper device integration rather than UX simplicity for an independent coach. That strengthens the case for a small, opinionated, non-marketplace tool over trying to out-feature TrainingPeaks.
2. **Coaches in this market have been burned twice by acquisition-then-shutdown.** Data portability and an explicit stance on exportability is a live trust issue right now, not a hygiene feature to defer to a later stage. This is worth noting against `08`'s Stage 4, which currently files exports under the business layer.

## 2. The three hypotheses the reconciliation memo asked this audit to test

### Hypothesis 1 — the publishing unit. **Resolved, and the market splits into three camps, not two.**

This was previously recorded as inconclusive. It is now the best-evidenced finding in this document, and it changed the audit's recommendation twice as evidence accumulated.

**Camp A — a rolling visibility window.** The athlete sees *N* days forward; everything beyond is invisible.

- **Nolio** **[FIRSTHAND, help center]**: sessions appear in the athlete's calendar **automatically on creation**, with an optional email notification at that moment. The only control is a "sliding appearance mode" setting the number of rolling days from today the athlete can see, **defaulting to 100 days**, configured in Team → Options. ([modifying plan visibility](https://help.nolio.io/fr/articles/9159720-comment-modifier-la-visibilite-du-plan-a-vos-sportifs), [planning a session](https://help.nolio.io/fr/articles/13003710-prevoir-une-seance-d-entrainement))
- **Final Surge** **[FIRSTHAND, vendor blog]**: two modes, a rolling *N* days forward or a **fixed hard date** the athlete never sees past. Hidden days render dark grey to the coach; the athlete "see[s] nothing on hidden days as if there were no future workouts scheduled at all." Reached from Coaching Settings on the athlete calendar. ([Final Surge blog](https://blog.finalsurge.com/assistant-coaches-hiding-workouts/))

**Camp B — per-workout hide, framed as an exception.** **TrainingPeaks** **[FIRSTHAND, Help Center]** offers **Hide** (athlete cannot see the workout, positioned as a long-term-planning tool rather than the weekly rhythm) and a separate **Lock** (athlete sees it but cannot edit it). One rule is load-bearing and appears below in §6: *once an athlete uploads data to a workout, it cannot be hidden by a coach.*

**Camp C — hidden by default, with publishing as a first-class, logged, reversible event.** **V.O2 only**, and it took them from 2018 to 2026 to converge on it. This is the most developed implementation found anywhere, and it is the one worth copying. **[FIRSTHAND, help center]**

1. **Staging calendar (2018)**: coaches stage, meaning hide, workouts directly on an athlete's calendar and release them individually, by week, or all at once. The stated rationale is almost verbatim this audit's own: *"quickly tweak/adjust 'hidden' training based on feedback before publishing"* and *"hiding workouts can keep the athlete focused on one block of training at a time."* ([Athlete Staging Calendar](https://support.vdoto2.com/2018/04/athlete-staging-hiding-workouts/))
2. **Auto-publish schedules (2024)**: a roster-wide default rule for how many days forward an athlete sees and when hidden training auto-releases (daily or weekly), overridable per athlete. Their own docs record the footguns: publish time is in the *coach's* timezone, and a visibility window under 7 days combined with weekly publishing leaves athletes with gaps. ([Auto-Publish Training](https://support.vdoto2.com/2024/02/auto-publish-vdot-training/))
3. **Publication log and unpublish (Feb 2026)**: a per-athlete Training History recording **each publish action as a discrete entry**, grouping the activities released together, with the ability to **unpublish** a batch back to hidden. Deliberately read-only: "You cannot add or rearrange training from the History view." ([Individual Athlete Training History](https://support.vdoto2.com/2026/02/new-feature-individual-athlete-training-history/))

**Why Camp A is not sufficient, stated plainly because this audit briefly recommended it.** A rolling window controls how far *ahead* an athlete sees. It does not let a coach privately rework **next Tuesday**. Shortening the window far enough to make the current week private also destroys the athlete's ability to plan their life around their training, which is the window's actual purpose. Nolio's own documentation is explicit that a session lands in the athlete's calendar the moment it is created, which means the coach is always composing in public. Camp A and Camp C solve different problems and a horizon is not a substitute for a draft state.

**The resolution adopted in `05` §1.2:** hidden-by-default plus an explicit publish **event**, with a visibility horizon available as a convenience on top rather than as the mechanism. Skip the auto-publish scheduler initially — for one coach with a handful of athletes, cron-scheduled release is overbuilt and imports exactly the timezone and gap failures V.O2 had to document. But build the publish event as a first-class table **from day one**: retrofitting a log onto a boolean is painful, and V.O2 spent eight years making that exact migration.

### Hypothesis 2 — a review queue. **Confirmed as a real need; the market's answers are mostly overbuilt for this roster size.**

What actually exists, ranked by how transferable it is:

- **Nolio — subscribe-to-events** **[VENDOR CLAIM, corroborated third-party]**: the coach picks *which athletes* to be notified about and *which events* trigger it (new workout logged, new competition, RPE submitted, feelings submitted, comment added), alongside customizable roster-wide group dashboards. The subscription model is cheap to build and puts the coach in control of signal-to-noise rather than guessing at a relevance algorithm. ([features](https://www.nolio.io/en/features/))
- **TrainingPeaks — compliance color-coding on the roster** **[FIRSTHAND + THIRD-PARTY]**: red/yellow/green per athlete computed from actual-vs-planned TSS/duration/distance, so a coach triages by scanning the roster they already open rather than visiting a separate screen. Athlete comments generate a notification.
- **Humango — compliance alerts plus a fatigue/illness early-warning model** **[VENDOR CLAIM, unverified]**: the most automated answer found, and the one this audit could least verify.
- **V.O2 — essentially nothing roster-wide.** Only a per-workout accuracy score. Notably absent given how developed the rest of their product is.
- **Good Coach App — the whole roster's week on one calendar** **[THIRD-PARTY]**. The cheapest possible answer.
- **Canary Coach** (pre-launch, unverifiable, but the best-articulated principles found) **[VENDOR CLAIM]**: a daily briefing sorting the roster into "Needs Attention" and "Positive Flags," each with **the evidence attached**. Two stated principles worth taking regardless of scale: *"A single bad night is not a flag. Poor sleep plus elevated resting heart rate ahead of an intensity session is"* — flag on **convergence**, not a single metric. And it "aggregates, synthesizes, and flags — and **never prescribes**," which maps precisely onto this codebase's existing rule that the AI layer narrates what the deterministic engine computed (`CLAUDE.md` §7).

**This changes the audit's recommendation.** `04` §2.5 previously leaned toward a roster compliance signal over a dedicated queue, on the strength of TrainingPeaks' pattern. The counter-argument is specific to scale and is persuasive: **with a handful of athletes a coach does not need to *discover* who needs attention, they need to not *forget* anyone.** Discovery dashboards solve a problem that starts at 30+ athletes. A single reverse-chronological "needs review" list — completed-but-unreviewed sessions, any non-empty pain report, any RPE deviating hard from the session's intent, any missed published session, cleared by reviewing — is one query and one list, and it is a better fit at this size than any dashboard above. See `04` §2.5 for the revised recommendation.

### Hypothesis 3 — copy vs. link semantics. **The mature answer is "both, as separate products."**

**[FIRSTHAND, TrainingPeaks Help Center]** ([Dynamic Training Plans](https://help.trainingpeaks.com/hc/en-us/articles/204072414-Dynamic-Training-Plans))

- **Standard Training Plan** — authored on generic, date-independent days ("Week 1, Day 3"), then applied to an athlete's calendar at a chosen start date. Once applied it is a **copy**: editing the source afterward does not touch any athlete it was already applied to.
- **Dynamic Training Plan** — authored on a real, dated master calendar; every athlete is **linked** to that master, and edits propagate live. Their framing: "a coach could apply a Dynamic Training Plan to one hundred athletes all training for the same event and any time they add or change workouts in the master plan it will update in all of those athletes' personal calendars."

The evidence does not favor one mode. It shows the two solve genuinely different situations (bespoke 1:1 programming versus one plan taught to many athletes at once), and that forcing a single answer would be a regression from the state of the art. Haarchive is copy-only today (`assign_program_generation` always snapshots). That is the correct default for private 1:1 coaching; linked plans are a real feature to add later, not a defect now.

## 3. Relative targets — universally supported, in two architecturally distinct ways

This is the concept `01` §4 found duplicated six times, and the question of whether it was overbuilt is now firmly answered: **it is the market standard, and the defect is the duplication, not the idea.**

**Model 1 — named-zone indirection.** **V.O2** **[FIRSTHAND, FAQ]**: one fitness scalar per athlete (VDOT), updated from race results or a fitness estimate; prescriptions reference Daniels intensity *names* (E/M/T/I/R); the table resolves everything. "VDOT paces are automatically generated"; coaches "minimize manual pacing work," with an escape hatch to save custom paces outside the table. ([V.O2 FAQ](https://support.vdoto2.com/v-o2-faq/)) Simple, opinionated, pedagogically clean. Limitation: you can only say what the table can say.

**Model 2 — formula/percentage indirection.** **Nolio** **[FIRSTHAND, help center]**: zones are fully user-defined, including the *calculation formula* per zone against a reference the coach chooses (VMA/vVO2max, PMA, FTP, or an arbitrary custom variable). A step target can be a zone, **a single percentage (85%), or a percentage range (60–80%)**, resolved per athlete from that athlete's own current reference values at assignment time. Their help center explicitly warns results are only as good as how current those values are. ([creating a structured session](https://help.nolio.io/fr/articles/9159825-comment-creer-une-seance-structuree-sur-nolio), [configuring athlete zones](https://help.nolio.io/fr/articles/9159751-comment-configurer-les-zones-d-entrainements-de-mes-sportifs))

**Coachbox** states the same pattern more crisply than anyone **[FIRSTHAND, public help center]**: *"You can format exportable workouts based on percentages of thresholds or zones, and when scheduling an exportable workout from the library across multiple athletes, the correct thresholds of each individual athlete are applied each time."* Targets can be HR, speed, pace, or power; a step takes a duration or a distance plus a target; **threshold ranges** are supported. ([exportable workouts](https://www.coachbox.app/en/exportable-workouts), [workout zones](https://support.mycoachbox.com/en/workout-zones))

**intervals.icu** **[FIRSTHAND]** does it in plain text: `%FTP`, `%threshold`/`%max` for HR, `%threshold` for pace, expanded per athlete from stored settings at read time. Architecturally identical to `pace_percent_basis/min/max` resolved from `athlete_fitness_estimates`.

**Three specifics worth adopting, each traceable to a named product:**

1. **Support a range, not just a point** (Nolio, Coachbox). Real prescriptions are ranges, and an interval target that resolves to a single number is a lie about the coach's intent. `05` §1.1's contract already carries min/max on every mode; this is independent validation rather than a change.
2. **Version the fitness estimate** (Coachbox tracks zone history with automatic recalculation). If a workout is published in week 3 against a VDOT of 52 and the estimate moves to 54 in week 5, the already-published week 3 workout must **not** silently re-resolve. See §7's market gap 2, which is the more serious version of this.
3. **Ship an RPE-only structured-session mode** (Nolio) **[FIRSTHAND]** — a prescription an athlete can execute without a device. This fits this site's "why before what" posture better than a pace number does, and it costs almost nothing given `IntensityTarget` already has an `rpe` mode.

## 4. Structured-workout composition — every serious implementation models a tree

This is the second finding that changed `05`, and three independent products agree.

- **TrainingPeaks Structured Workout Builder** **[FIRSTHAND]**: eight drag-in block templates including Warm up, Active, Recovery, Cool down; duration adjusted by dragging a block's edge; repeats created with `+`/`-`. The decisive detail: *"for multi-step repeat blocks, adjusting an interval within a block will adjust all of the corresponding intervals in that block"* — only possible if the repeat **owns** its children. Zone selection is a dropdown per block.
- **Garmin Connect** **[THIRD-PARTY]**: the model is an optional warmup, individual steps, **repeat** blocks, and an optional cooldown, with repeats nestable inside repeats and time-based and distance-based steps mixable in one workout. The interaction is *Add Step → Repeat → set rounds → add or drag steps inside the repeat.* ([paulrobichaux.com](https://paulrobichaux.com/2017/03/17/setting-up-run-intervals-on-garmin-watches/), [garmin.vaw.be](https://garmin.vaw.be/en/community/day-40-build-your-own-interval-training))
- **intervals.icu** **[FIRSTHAND]**: explicit parentheses in text, `3x(5m 100%, 2m 55%)`.
- **Nolio** **[VENDOR CLAIM]** and **Coachbox** **[FIRSTHAND]** both ship repetition blocks as distinct objects; Coachbox additionally has build-up/ramp blocks where a "target" block ramps 0→target and a "range" step specifies both endpoints.

**None of them hangs repetition off a leaf as a scalar, which is exactly what `scheduled_workout_steps.repetitions` does.** The consequence was hit directly during this engagement: "2 sets of 6 × 500m with 30s rest, 3 min between sets" had to be flattened to `repetitions: 12` while authoring Canyon, discarding the set boundary and the between-set recovery. `05` §1.1 now specifies a one-level tree; `08` moves it into Stage 0 alongside the contract, since retrofitting nesting after the serializer is written against a flat list means writing that serializer twice.

**One interaction lesson attached to this.** A real interval session takes roughly 18–22 discrete interactions to build in Garmin's builder, and that is *fine* — nobody's headline complaint about Garmin is that repeats are hard. The complaints are all navigational. **Complexity in a workout builder is acceptable; complexity in getting to the builder is not.** The corollary for `04` §2.3: "5 miles easy" must never touch the structured builder, which argues for conditional progressive disclosure rather than a wizard.

**Do not copy** Garmin's decision to make the full builder **web-only** **[THIRD-PARTY]**. Garmin gets away with it because the phone is a sync client, not the coaching surface. A solo coach editing a plan is very plausibly on a phone.

## 5. Planned vs. actual — V.O2's implementation is the strongest found, and it encodes a coaching opinion

**[FIRSTHAND, V.O2 help center]** On GPS import, V.O2 auto-detects warmup/interval/recovery/cooldown segments, auto-logs splits into rep fields, and shows the ± delta against the prescribed value. It then computes a weighted **Accuracy Score** with explicitly asymmetric rules: pacing weighted more than distance; warmup/recovery/cooldown weighted less than interval sets; **each rep compared individually to its prescribed pace rather than averaged**; and on easy runs, **running faster than prescribed is penalized harder than running slower**. ([Accuracy scoring](https://support.vdoto2.com/2024/02/vdot-accuracy-scoring/), [How it works](https://support.vdoto2.com/vdot-accuracy-feature-how-it-works/))

That last rule is a *coaching argument* encoded in a metric rather than a pretense of neutrality, and it is squarely this site's house style — it is exactly the kind of claim that should have a mechanism page behind it (`mostly-easy-genuinely-hard` already argues this position in prose).

**[FIRSTHAND]** Separately and importantly, V.O2 athletes self-mark each activity **complete / modified / incomplete**, as a distinct axis from the device data. **"Modified" is the state every other platform is missing and the one that actually happens most.** This is independent validation of `05` §2.3's assignment/log split: coach intent and athlete execution are different objects, and D4's dead `missed`/`skipped` enum values are a symptom of collapsing them into one column.

**Nolio** **[VENDOR CLAIM]** runs two literal calendars, planned and completed, with automatic comparison driving adjustment, and lets the **coach define custom post-workout debrief fields** beyond the default RPE and "feelings." That last one is genuinely differentiated and cheap: making the debrief form configurable per athlete would let a coach add a pain-location field only for the athlete with a known niggle.

## 6. Data-integrity rules other products enforce that this audit had not considered

**[FIRSTHAND, TrainingPeaks Help Center]** Two rules, both of which fall out of `05` §2.3 for free rather than needing to be built:

- *Once an athlete uploads data to a workout, it cannot be hidden by a coach.* Coach intent, once acted on, is not freely retractable.
- **Lock** exists as a distinct state whose documented purpose is preventing athletes from editing *planned* values after completing them to make compliance look better than it was.

The second is the more interesting one, because it reveals that a platform storing planned and actual in the same place has to invent a permission to protect one from the other. If they live in different rows, an athlete editing their log physically cannot rewrite what was prescribed, and no lock feature is needed. Record this as market validation of the split, not as a new requirement.

## 7. Genuine market gaps — where this product could be better than anything surveyed

These are the most strategically useful findings in this document, and all four are reachable.

1. **Nobody combines a real draft/publish workflow with percentage-relative targets.** V.O2 has the best publish model (Camp C) but a closed, single-scalar VDOT target system. Nolio and Coachbox have the best relative-target systems and **no draft state at all**. That intersection is empty, and it is precisely where this codebase already sits — it has both, badly implemented, rather than neither.
2. **Nobody can answer "what did the athlete actually see, and against what fitness estimate?"** V.O2's Feb 2026 publish log is the closest anyone has come and it does not capture *resolved target values*. For a coach adjusting from RPE and pain reports, "what did I actually ask for, in absolute numbers, on the day they ran it" is the load-bearing question, and it is currently unanswerable on every platform here. **The fix is specific:** freeze resolved values into the published snapshot and keep the relative expression alongside for re-resolution on republish. This is a new requirement for `05` and it is not expensive.
3. **No coaching platform links prescriptions to explanations.** Every product surveyed prescribes a number; none can tell an athlete *why* that number. This site already has the entire content library. A published workout whose threshold step links to its own threshold-physiology page is something no competitor in this list can ship, and it is a direct expression of "why comes before what" rather than a marketing bolt-on. `05` §1.1 already makes `purpose` first-class; this gap suggests going further and linking the target's *basis* into the library.
4. **Data portability is a live trust issue**, per §1. Two acquisition-shutdowns in two years have made coaches sensitive to it.

## 8. Comparison matrix

Blank cells mean not verified, not "no."

| | TrainingPeaks | Final Surge | V.O2 | Nolio | Coachbox | intervals.icu | Haarchive (current) |
|---|---|---|---|---|---|---|---|
| Draft / publish model | Per-workout Hide + Lock | Rolling window or hard date | **Hidden by default + logged, reversible publish event** | None; rolling window, default 100d | None found | N/A | `published_at` boolean, per-workout, no bulk path |
| Relative targets | Zones | Zones | **VDOT named zones (E/M/T/I/R)** | **Custom formula, % or % range, any reference** | **% of threshold, ranges, versioned zone history** | **%FTP / %threshold, text syntax** | Yes, via 6 duplicated table shapes |
| Structured steps | Drag blocks, repeat containers propagate edits | Pace+HR+power on one step | Reps with granular walk/jog recovery | Repetition blocks, multi-target per step | Repetition + ramp blocks | Text with explicit nesting | **Flat list, scalar `repetitions`** |
| Planned vs. actual | Compliance % | | **Segment auto-detect, asymmetric accuracy score, 3-state self-report** | Dual calendars, coach-defined debrief fields | | | `computeWorkoutStatus`, derived inconsistently (D4) |
| Attention surface | Roster color-coding | | Per-workout score only | **Subscribe-to-events + group dashboards** | AI chat over athlete data | | Coach Home flags, never revalidated (D8) |
| Per-workout comments | Yes | **Yes** | **Yes** | **Yes** | | | **Yes — already matches** |
| Plan copy vs. link | **Both, as product modes** | | | | | | Copy only |
| Pricing | Per-athlete (most-criticized) | Flat per-coach | **Flat per-coach, roster-tiered, athletes free** | Flat base + per-athlete overage | Per-athlete, **unlimited coach seats** | Free | Free, no billing |
| Mobile calendar | Month grid | | | | | | **7-col grid, `min-w-[1100px]` (D12)** |

## 9. Interaction and UX references

Full detail lives in `06-design-system.md`, which owns visual and interaction treatment. The findings that changed a recommendation, in brief:

- **No surveyed product ships a 7-column time grid at phone width.** Outlook and Google cap a phone grid at **three** columns; Apple Calendar and Fantastical make the 7-day grid **landscape-only**. Garmin Connect and TrainingPeaks both use a **month grid** on mobile, which is two-for-two among endurance products. Garmin's per-day cells carry an **overflow count** when items don't fit, the exact inverse of D12's silent clipping.
- **Commit-on-ambiguous-dismiss is a documented data-integrity bug, not a preference.** AWS Cloudscape's rule is to confirm after any action that could lose data, *and* never to confirm when nothing is at risk; NN/g states that a dimmed backdrop should not auto-close a form holding unsaved input. D6 is the more serious version: it autosaves on that gesture with no revision history to undo it. Notion earns silent autosave by making every version retrievable; this product currently takes that bargain without paying for it.
- **IBM Carbon's rule settles the editor's shape independently:** if enough fields are editable to require scrolling, use a side panel or full page rather than a modal. The current editor has more than eight fields.
- **Material names the mobile modal defect exactly:** *don't use an invisible scrim for modal bottom sheets.*
- **Figma's "Review unpublished changes" dot** is the closest existing analogue to the draft/publish signal this product needs, and maps almost without translation onto "the coach has authored days the athlete has not seen."
- **Garmin's cautionary tale:** its 2024 mobile redesign is most criticized for converting density into scrolling and hiding existing destinations behind a three-dots menu. For a coach scanning a week, replacing density with scrolling is not simplification.
- **WHOOP replaced its chatbot with a pre-composed Daily Outlook card** **[THIRD-PARTY]**. The lesson for this product's AI layer: narration should be rendered into today's card before the athlete asks, not gated behind a prompt box.
- **Accessibility floors** now specified in `06` §5: WCAG 2.2 SC 2.5.7 requires a non-drag alternative for every drag-to-reschedule (W3C names a "move to…" menu as the canonical answer for task-board columns), and SC 2.5.8 sets a 24×24px target-size floor, with 44px remaining the practical target.

## 10. Products checked and set aside

- **Today's Plan — dead** since 12 March 2024 **[THIRD-PARTY]**. The durable lesson is §1's.
- **CoachNow** — a video-analysis and communication product for skill sports. Its own feature pages confirm no structured interval workouts, no pace/HR targets, no device fitness sync, no planned-vs-actual **[FIRSTHAND]**. Not a competitor. One structural idea is worth noting: the athlete relationship as a persistent threaded feed rather than a calendar, so context accumulates in one place.
- **Runna** — self-serve B2C (~$14–20/mo) where "coaching" is an algorithm adapting coach-authored templates; no coach-facing tooling for assigning work to a named athlete **[THIRD-PARTY]**. A competitor for the athlete's attention, not for this coach-side workflow, and useful only as a benchmark for what athletes now expect a daily workout screen to feel like.
- **Vert.run** — sells its own coaches to athletes. Has shipped an athlete-facing AI agent with authority to add, move, and replace workouts from chat **[VENDOR CLAIM]**, which is a design choice to **avoid** in a 1:1 model where the coach owns the plan.
- **Humango** — athlete-first AI with a coach layer; per-athlete pricing that is expensive at small rosters (roughly $60–100/mo for 5 athletes against V.O2's flat $29.99) **[VENDOR CLAIM, two vendor sources disagree on the exact figures]**. No public documentation of its structured-step model or any draft state. **One structural observation worth carrying:** a continuously-replanning AI is in tension with a stable published week. If the engine can rewrite tomorrow based on today's data, "what the athlete was promised" is not a stable object. That is an argument for making the published snapshot immutable and requiring an explicit republish, which is what `05` §1.2 specifies.
- **Good Coach App, Training Tilt, Vekta, Canary Coach, Athletica, TriDot** — noted, with the transferable items already folded into §2 above.

## 11. Direct implications

**Adopt:**

1. **Hidden-by-default plus publish-as-a-logged-reversible-event** (V.O2, Camp C). The highest-value item in this document. Build the publish event as a real table from day one; skip the auto-publish scheduler.
2. **Freeze resolved target values into the published snapshot**, keeping the relative expression alongside for re-resolution on republish (market gap 2 and Coachbox's versioned zones). Nobody in this market does this.
3. **Ranges on every target mode**, not points (Nolio, Coachbox). Already in `05` §1.1; now independently validated.
4. **A one-level step tree with repeat containers** (TrainingPeaks, Garmin, intervals.icu, Nolio, Coachbox — unanimous).
5. **Three-state athlete self-report: complete / modified / incomplete** (V.O2), distinct from device data. "Modified" is the state everyone else is missing.
6. **Keep the per-workout comment thread exactly as built.** Four competitors independently converged on it and this codebase already matches.
7. **A simple reverse-chronological "needs review" list**, not a dashboard, at this roster size. Flag on convergence and attach the evidence to the flag (Canary).
8. **An RPE-only structured mode** for device-free execution (Nolio).

**Consider, not decided:**

- Coach-configurable post-workout debrief fields (Nolio) — cheap and differentiated.
- A text-first or hybrid workout-entry mode (intervals.icu), given the current editor needs six-plus fields per step to express what a coach could type in one line.
- Linked (as opposed to copied) program assignment as a later feature, per Hypothesis 3.
- Opinionated asymmetric accuracy scoring (V.O2), which would need a mechanism page behind it to fit this site's standards.

**Do not copy:**

- **TrainingPeaks' per-athlete pricing** — the market leader's most consistently criticized attribute, and irrelevant to a product with no billing (`prd.md` §6).
- **Auto-publish schedulers with timezone semantics** — V.O2's own docs document the footguns.
- **Multi-model training load** (Foster + Coggan + TRIMP simultaneously, Nolio). Pick one and explain it.
- **Predictive fatigue/injury ML** (Humango). At this roster size the athlete's own pain note is better signal, and it is already collected.
- **Group dashboards, coach sub-accounts, marketplaces, storefronts, lactate-testing infrastructure.** Real businesses for those vendors; distractions for a private practice.
- **Garmin's web-only builder and its three-dots overflow navigation.**
- **A 24-hour wall-clock day column** anywhere. Training days are ordered lists, not appointment schedules.
- **Kudos, follower counts, leaderboards, public-by-default anything.** These degrade a 1:1 coaching relationship and actively discourage the honest reporting a coach depends on.
