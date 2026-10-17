import { describe, it, expect } from "vitest";
import {
  POST_RACE_FLOW_WINDOW_DAYS,
  RECOVERY_DAYS,
  RECOVERY_FRAMEWORK_KEY,
  RECOVERY_PHASE_EXPLAINERS,
  REDEMPTION_WINDOW_DAYS,
  RETURN_TO_RUNNING_PHASE,
  RETURN_TO_TRAINING_PHASE,
  buildRecoveryProgramSeed,
  recoveryWorksheetEntries,
  POST_SEASON_REVIEW_MARKER,
  POST_SEASON_REVIEW_SECTIONS,
  postRaceFlow,
  postSeasonReviewMessage,
  postSeasonReviewQuestions,
  redemptionRaceGuardrail,
} from "@/lib/private-coaching/post-race";
import { explainerParagraphs } from "@/lib/private-coaching/phase-explainers";
import { MILE_METERS } from "@/lib/race-distances";

describe("RECOVERY_DAYS", () => {
  it("covers six full weeks: two of return-to-running, four of return-to-training", () => {
    expect(RECOVERY_DAYS).toHaveLength(42);
    const running = RECOVERY_DAYS.filter((d) => d.phaseKey === RETURN_TO_RUNNING_PHASE);
    const training = RECOVERY_DAYS.filter((d) => d.phaseKey === RETURN_TO_TRAINING_PHASE);
    expect(running).toHaveLength(14);
    expect(training).toHaveLength(28);
  });

  it("fills every day slot of every week exactly once, Monday first", () => {
    const slots = RECOVERY_DAYS.map((d) => `${d.phaseKey}:${d.weekNumber}:${d.dayOfWeek}`);
    expect(new Set(slots).size).toBe(42);
    for (const day of RECOVERY_DAYS) {
      expect(day.dayOfWeek).toBeGreaterThanOrEqual(1);
      expect(day.dayOfWeek).toBeLessThanOrEqual(7);
      expect(day.prescription.trim().length).toBeGreaterThan(0);
    }
  });

  it("transcribes the source's week 1 of return-to-running exactly", () => {
    const week1 = RECOVERY_DAYS.filter((d) => d.phaseKey === RETURN_TO_RUNNING_PHASE && d.weekNumber === 1)
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((d) => d.prescription);
    expect(week1).toEqual([
      "3-4 mi very easy",
      "Off",
      "4-5 mi very easy",
      "Off",
      "5 mi very easy",
      "5-6 mi easy",
      "Off",
    ]);
  });

  it("keeps the early weeks free of any workout", () => {
    // The first two weeks are aimed at motivation, not fitness.
    const running = RECOVERY_DAYS.filter((d) => d.phaseKey === RETURN_TO_RUNNING_PHASE);
    for (const day of running) {
      expect(day.prescription).not.toMatch(/%/);
      expect(day.prescription).not.toMatch(/\bx\b/);
    }
  });

  it("writes the warm-up instruction into the starred sessions rather than leaving a footnote", () => {
    const starred = RECOVERY_DAYS.filter((d) => /progressive warm-up and/.test(d.prescription));
    // The source marks four sessions with an asterisk.
    expect(starred).toHaveLength(4);
    for (const day of starred) expect(day.phaseKey).toBe(RETURN_TO_TRAINING_PHASE);
  });

  it("anchors its percentages to the marathon just run", () => {
    const paced = RECOVERY_DAYS.filter((d) => /%/.test(d.prescription));
    expect(paced.length).toBeGreaterThan(0);
    for (const day of paced) expect(day.prescription).toMatch(/marathon pace|% effort/);
  });
});

describe("buildRecoveryProgramSeed", () => {
  const plan = buildRecoveryProgramSeed();

  it("is a six-week, two-phase program with all forty-two days", () => {
    expect(plan.program.frameworkKey).toBe(RECOVERY_FRAMEWORK_KEY);
    expect(plan.durationVariantName).toBe("6-Week");
    expect(plan.phases.map((p) => p.phaseKey)).toEqual([RETURN_TO_RUNNING_PHASE, RETURN_TO_TRAINING_PHASE]);
    expect(plan.phases.map((p) => p.durationWeeksMin)).toEqual([2, 4]);
    expect(plan.days).toHaveLength(42);
  });

  it("prescribes no weekly mileage and no difficulty, because the source does not", () => {
    // It says in as many words that weekly totals are not critical here.
    expect(plan.volumeVariants).toEqual([]);
    expect(plan.phaseWeekVolumes).toEqual([]);
    expect(plan.days.every((d) => d.difficultyLabel === null && d.plannedRpe === null)).toBe(true);
  });

  it("marks no event day: the race already happened", () => {
    expect(plan.days.every((d) => !d.isEventDay)).toBe(true);
  });

  it("tells the coach the rest days are not in the authored weeks", () => {
    expect(plan.program.description).toMatch(/not part of the authored weeks/);
    expect(plan.program.description).toMatch(/start this program on the day the athlete starts running again/);
  });

  it("carries no steps for Return to running -- Table 21.1 has no percent-bearing or multi-clause sessions to structure", () => {
    // The day-level planned_pace_s_per_mi/_max (a SeedDay field this
    // builder never sets at all) is the thing "nothing here to measure"
    // actually governs. `steps` is a different mechanism -- Return to
    // training's ten quality days DO get steps now, checked in their own
    // describe block below -- see RETURN_TO_TRAINING_STEPS's own header.
    const running = plan.days.filter((d) => d.phaseKey === RETURN_TO_RUNNING_PHASE);
    expect(running.every((d) => d.steps == null)).toBe(true);
  });

  it("gives every day either a real distance, a deliberate null (Off/Off or X/pace-dependent), or a worksheet entry -- never a silent gap", () => {
    const worksheetSlots = new Set(recoveryWorksheetEntries().map((e) => `${e.program}:${e.week}:${e.day}`));
    for (const day of plan.days) {
      const hasDistance = day.distanceMiMin != null;
      const isOff = /^off\.?$/i.test(day.notes.trim()) || /^off\s+or\b/i.test(day.notes.trim());
      // A null distance that isn't Off/Off-or is pace-dependent (a segment
      // stated only in minutes at a percent of marathon pace) -- the
      // prescription itself says so.
      const isPaceDependent = /%\s*of\s*marathon\s*pace/i.test(day.notes);
      const label = day.phaseKey === RETURN_TO_RUNNING_PHASE ? "post-marathon-recovery (Return to running)" : "post-marathon-recovery (Return to training)";
      const onWorksheet = worksheetSlots.has(`${label}:${day.weekNumber}:${day.dayOfWeek}`);
      expect(hasDistance || isOff || isPaceDependent || onWorksheet).toBe(true);
    }
  });

  it("sums the first return-to-training day's progression and cool-down, matching the task's own worked example", () => {
    const day = plan.days.find((d) => d.phaseKey === RETURN_TO_TRAINING_PHASE && d.weekNumber === 1 && d.dayOfWeek === 1)!;
    expect(day.notes).toBe("5 mi Kenyan-style progression + 1 mi easy");
    expect(day.distanceMiMin).toBe(6);
    expect(day.distanceMiMax).toBeNull();
  });

  it("leaves 'Off' and 'Off or X' days at a null distance, not a worksheet entry", () => {
    const offDay = plan.days.find((d) => d.phaseKey === RETURN_TO_RUNNING_PHASE && d.weekNumber === 1 && d.dayOfWeek === 2)!;
    expect(offDay.notes).toBe("Off");
    expect(offDay.distanceMiMin).toBeNull();

    const offOrDay = plan.days.find((d) => d.phaseKey === RETURN_TO_RUNNING_PHASE && d.weekNumber === 2 && d.dayOfWeek === 3)!;
    expect(offOrDay.notes).toBe("Off or 3-5 mi very easy");
    expect(offOrDay.distanceMiMin).toBeNull();
  });

  // Table 21.2's Saturday and Sunday for Weeks 1 and 4 were originally
  // transcribed swapped with each other (Week 1's hill-repeat session
  // landed on Week 4, and Week 4's "9-10 mi ... through hills" landed on
  // Week 1), which is exactly what made some recovery days show the wrong
  // workout in their details. Pinned directly against the source table so
  // this can't silently regress.
  it("gives Week 1 Saturday the hill-repeat session (not Week 4's)", () => {
    const day = plan.days.find((d) => d.phaseKey === RETURN_TO_TRAINING_PHASE && d.weekNumber === 1 && d.dayOfWeek === 6)!;
    expect(day.notes).toBe(
      "6-10 x 1 min fast uphill (~112-115% of marathon pace effort), easy jog down (can do on flat ground). 1-2 mi progressive warm-up and 1-2 mi easy cool-down.",
    );
    expect(day.distanceMiMin).toBeNull();
  });

  it("gives Week 1 Sunday 'Off or 3-5 mi very easy' (not Week 4's 'Off or 4-5')", () => {
    const day = plan.days.find((d) => d.phaseKey === RETURN_TO_TRAINING_PHASE && d.weekNumber === 1 && d.dayOfWeek === 7)!;
    expect(day.notes).toBe("Off or 3-5 mi very easy");
    expect(day.distanceMiMin).toBeNull();
  });

  it("gives Week 4 Saturday the 9-10 mi hilly moderate/easy run (not Week 1's hill-repeat session), with a real distance", () => {
    const day = plan.days.find((d) => d.phaseKey === RETURN_TO_TRAINING_PHASE && d.weekNumber === 4 && d.dayOfWeek === 6)!;
    expect(day.notes).toBe("9-10 mi moderate or easy progressing to moderate through hills");
    expect(day.distanceMiMin).toBe(9);
    expect(day.distanceMiMax).toBe(10);
  });

  it("gives Week 4 Sunday 'Off or 4-5 mi very easy' (not Week 1's 'Off or 3-5')", () => {
    const day = plan.days.find((d) => d.phaseKey === RETURN_TO_TRAINING_PHASE && d.weekNumber === 4 && d.dayOfWeek === 7)!;
    expect(day.notes).toBe("Off or 4-5 mi very easy");
    expect(day.distanceMiMin).toBeNull();
  });
});

describe("Return to training (Table 21.2) structured steps", () => {
  const plan = buildRecoveryProgramSeed();
  const training = plan.days.filter((d) => d.phaseKey === RETURN_TO_TRAINING_PHASE);
  const dayAt = (week: number, dayOfWeek: number) => training.find((d) => d.weekNumber === week && d.dayOfWeek === dayOfWeek)!;
  const mi = (n: number) => n * MILE_METERS;

  it("structures exactly the ten quality sessions, leaving the eighteen plain-prose days alone", () => {
    const withSteps = training.filter((d) => d.steps != null);
    expect(withSteps).toHaveLength(10);
    expect(training.filter((d) => d.steps == null)).toHaveLength(18);
  });

  it("every day with a stated percent of marathon pace has a step carrying that same percent", () => {
    const paced = training.filter((d) => /%\s*of\s*marathon\s*pace|% effort/i.test(d.notes));
    expect(paced.length).toBeGreaterThan(0);
    for (const day of paced) {
      expect(day.steps).not.toBeNull();
      expect(day.steps!.some((s) => s.targetPacePercentBasis === "marathon")).toBe(true);
    }
  });

  it("gives the Week 1 Monday Kenyan progression a main segment plus its cool-down, no pace target", () => {
    const day = dayAt(1, 1);
    expect(day.steps).toEqual([
      expect.objectContaining({ stepOrder: 1, stepType: "main", distanceM: mi(5), distanceMaxM: null, targetPacePercentBasis: null, instructions: "Kenyan-style progression" }),
      expect.objectContaining({ stepOrder: 2, stepType: "cooldown", distanceM: mi(1), distanceMaxM: null }),
    ]);
  });

  it("gives the Week 1 Wednesday strides their rep count and duration, with no distance added", () => {
    const day = dayAt(1, 3);
    expect(day.steps).toEqual([
      expect.objectContaining({ stepOrder: 1, stepType: "main", distanceM: mi(3), instructions: "Easy progressing to moderate" }),
      expect.objectContaining({ stepOrder: 2, stepType: "interval", repetitions: 8, repetitionsMax: 10, durationS: 20, distanceM: null, instructions: "20 sec strides" }),
    ]);
  });

  it("gives the Week 1 Saturday hill-repeat session its warm-up, 112-115% uphill reps, and cool-down", () => {
    const day = dayAt(1, 6);
    expect(day.steps).toEqual([
      expect.objectContaining({ stepOrder: 1, stepType: "warmup", distanceM: mi(1), distanceMaxM: mi(2) }),
      expect.objectContaining({
        stepOrder: 2,
        stepType: "interval",
        repetitions: 6,
        repetitionsMax: 10,
        durationS: 60,
        targetPacePercentBasis: "marathon",
        targetPacePercentMin: 112,
        targetPacePercentMax: 115,
      }),
      expect.objectContaining({ stepOrder: 3, stepType: "cooldown", distanceM: mi(1), distanceMaxM: mi(2) }),
    ]);
  });

  it("gives the Week 2 Thursday session its strides' own rest and the 116% fast segment as a separate step", () => {
    const day = dayAt(2, 4);
    expect(day.steps).toEqual([
      expect.objectContaining({ stepType: "main", distanceM: mi(3) }),
      expect.objectContaining({ stepType: "interval", repetitions: 8, repetitionsMax: 10, durationS: 20, restS: 180, restMaxS: 240 }),
      expect.objectContaining({ stepType: "main", durationS: 240, targetPacePercentBasis: "marathon", targetPacePercentMin: 116, targetPacePercentMax: 116, instructions: "Fast" }),
      expect.objectContaining({ stepType: "cooldown", distanceM: mi(1) }),
    ]);
  });

  it("gives the Week 3 Wednesday 115% hill reps no warm-up/cool-down (the source carries no asterisk on this one)", () => {
    const day = dayAt(3, 3);
    expect(day.steps).toEqual([
      expect.objectContaining({ stepType: "interval", repetitions: 8, repetitionsMax: 12, durationS: 60, targetPacePercentBasis: "marathon", targetPacePercentMin: 115, targetPacePercentMax: 115 }),
    ]);
  });

  it("gives the Week 3 Friday 98-100% strong run its warm-up and cool-down with the distance range itself carrying the percent", () => {
    const day = dayAt(3, 5);
    expect(day.steps).toEqual([
      expect.objectContaining({ stepType: "warmup", distanceM: mi(1), distanceMaxM: mi(2) }),
      expect.objectContaining({ stepType: "main", distanceM: mi(4), distanceMaxM: mi(5), targetPacePercentBasis: "marathon", targetPacePercentMin: 98, targetPacePercentMax: 100, instructions: "Strong" }),
      expect.objectContaining({ stepType: "cooldown", distanceM: mi(1), distanceMaxM: mi(2) }),
    ]);
  });

  it("gives the Week 4 Tuesday 105% intervals their 45 sec jog as rest, not folded into the rep", () => {
    const day = dayAt(4, 2);
    expect(day.steps).toEqual([
      expect.objectContaining({ stepType: "warmup" }),
      expect.objectContaining({ stepType: "interval", repetitions: 5, repetitionsMax: 8, durationS: 180, targetPacePercentBasis: "marathon", targetPacePercentMin: 105, targetPacePercentMax: 105, restS: 45, restMaxS: null }),
      expect.objectContaining({ stepType: "cooldown" }),
    ]);
  });

  it("gives the Week 4 Thursday session both its 110% km effort and its separate 115% reps, each with the rest the source states", () => {
    const day = dayAt(4, 4);
    expect(day.steps).toEqual([
      expect.objectContaining({ stepType: "warmup" }),
      expect.objectContaining({ stepType: "main", distanceM: 4000, targetPacePercentBasis: "marathon", targetPacePercentMin: 110, targetPacePercentMax: 110, restS: 240, restMaxS: 300 }),
      expect.objectContaining({ stepType: "interval", repetitions: 6, repetitionsMax: 8, durationS: 60, targetPacePercentBasis: "marathon", targetPacePercentMin: 115, targetPacePercentMax: 115, restS: 120, instructions: "Fast" }),
      expect.objectContaining({ stepType: "cooldown" }),
    ]);
  });

  it("never adds distance for a strides step, matching the frameworks' own strides-never-add-distance policy", () => {
    const strideSteps = training.flatMap((d) => d.steps ?? []).filter((s) => s.instructions?.includes("sec strides"));
    expect(strideSteps.length).toBeGreaterThan(0);
    for (const s of strideSteps) expect(s.distanceM).toBeNull();
  });
});

describe("recoveryWorksheetEntries", () => {
  it("is empty -- every ambiguous recovery day turned out to be pace-dependent, not a worksheet question", () => {
    // Confirmed: a session whose fast segment is stated only in minutes at
    // a percent of marathon pace has no single correct distance (it varies
    // by the athlete's own fitness estimate), so it's left permanently
    // null instead of being asked about -- see RecoveryDistance's own
    // comment on the paceDependent kind.
    expect(recoveryWorksheetEntries()).toHaveLength(0);
  });

  it("the five pace-dependent recovery days have a null distance but a real prescription", () => {
    const plan = buildRecoveryProgramSeed();
    const paceDependentDays = plan.days.filter((d) => d.distanceMiMin == null && !/^off\b/i.test(d.notes.trim()));
    expect(paceDependentDays).toHaveLength(5);
    for (const day of paceDependentDays) {
      expect(day.notes).toMatch(/%\s*of\s*marathon\s*pace/i);
    }
  });
});

describe("RECOVERY_PHASE_EXPLAINERS", () => {
  it("explains both phases to the athlete", () => {
    expect(Object.keys(RECOVERY_PHASE_EXPLAINERS)).toEqual([RETURN_TO_RUNNING_PHASE, RETURN_TO_TRAINING_PHASE]);
    for (const explainer of Object.values(RECOVERY_PHASE_EXPLAINERS)) {
      expect(explainerParagraphs(explainer).length).toBeGreaterThan(3);
    }
  });

  it("covers the three things item 21 names: why easy running, why not two weeks off, mental recovery first", () => {
    const running = RECOVERY_PHASE_EXPLAINERS[RETURN_TO_RUNNING_PHASE];
    expect(running).toMatch(/aimed at your head, not your body|targeting psychology|motivation/i);
    expect(running).toMatch(/do not take two full weeks of complete rest/i);
    expect(running).toMatch(/structural integrity/i);
  });

  it("routes pain to the coach rather than telling the athlete to push through it", () => {
    expect(RECOVERY_PHASE_EXPLAINERS[RETURN_TO_RUNNING_PHASE]).toMatch(/Tell your coach rather than running through it/);
  });

  it("explains the return-to-training block as rebuilding what the marathon spent", () => {
    const training = RECOVERY_PHASE_EXPLAINERS[RETURN_TO_TRAINING_PHASE];
    expect(training).toMatch(/narrowed you on purpose|traded away/i);
    expect(training).toMatch(/do not need the whole four weeks/i);
  });
});

describe("postRaceFlow", () => {
  const base = { today: "2027-04-14", recoveryAssigned: false, reviewSent: false, nextCyclePlanned: false };

  it("is inactive before the race and with no race set", () => {
    expect(postRaceFlow({ ...base, raceDate: "2027-05-01" }).active).toBe(false);
    expect(postRaceFlow({ ...base, raceDate: null }).active).toBe(false);
  });

  it("offers all three steps once the race has passed, in order", () => {
    const flow = postRaceFlow({ ...base, raceDate: "2027-04-11" });
    expect(flow.active).toBe(true);
    expect(flow.daysSinceRace).toBe(3);
    expect(flow.steps.map((s) => s.key)).toEqual(["recovery-program", "post-season-review", "next-cycle"]);
    expect(flow.steps.every((s) => !s.done)).toBe(true);
  });

  it("says why the review comes before planning", () => {
    const flow = postRaceFlow({ ...base, raceDate: "2027-04-11" });
    const review = flow.steps.find((s) => s.key === "post-season-review")!;
    expect(review.detail).toMatch(/Before planning anything next/);
    expect(review.detail).toMatch(/Asking afterwards gets you a worse answer/);
  });

  it("marks steps already dealt with as done rather than nagging", () => {
    const flow = postRaceFlow({ ...base, raceDate: "2027-04-11", recoveryAssigned: true, reviewSent: true });
    expect(flow.steps.filter((s) => s.done).map((s) => s.key)).toEqual(["recovery-program", "post-season-review"]);
  });

  it("mentions the rest days in the first days after the race only", () => {
    expect(postRaceFlow({ ...base, raceDate: "2027-04-13" }).notes.join(" ")).toMatch(/three to five days of full rest/i);
    expect(postRaceFlow({ ...base, raceDate: "2027-04-01" }).notes).toEqual([]);
  });

  it("goes quiet after eight weeks", () => {
    expect(POST_RACE_FLOW_WINDOW_DAYS).toBe(56);
    expect(postRaceFlow({ ...base, raceDate: "2027-02-10" }).active).toBe(false);
  });
});

describe("redemptionRaceGuardrail", () => {
  it("flags a new buildup starting inside six weeks of a marathon", () => {
    expect(REDEMPTION_WINDOW_DAYS).toBe(42);
    const flag = redemptionRaceGuardrail({
      lastMarathonDate: "2027-04-11",
      newBuildupStartDate: "2027-05-03",
      dnfFromMishap: false,
    });
    expect(flag.flagged).toBe(true);
    expect(flag.title).toMatch(/22 days after a marathon/);
    expect(flag.detail).toMatch(/not a reason to race again immediately/);
    expect(flag.actions.join(" ")).toMatch(/post-season review before committing to another date/);
  });

  it("does not flag once the full recovery arc has had time", () => {
    expect(
      redemptionRaceGuardrail({
        lastMarathonDate: "2027-04-11",
        newBuildupStartDate: "2027-06-15",
        dnfFromMishap: false,
      }).flagged,
    ).toBe(false);
  });

  it("stands down for a did-not-finish from a one-off mishap", () => {
    // There is no marathon to recover from, so redoing the final weeks is
    // a reasonable plan rather than a redemption attempt.
    expect(
      redemptionRaceGuardrail({
        lastMarathonDate: "2027-04-11",
        newBuildupStartDate: "2027-05-03",
        dnfFromMishap: true,
      }).flagged,
    ).toBe(false);
  });

  it("tells the coach how to stand it down, since the data cannot tell the two apart", () => {
    const flag = redemptionRaceGuardrail({
      lastMarathonDate: "2027-04-11",
      newBuildupStartDate: "2027-05-03",
      dnfFromMishap: false,
    });
    expect(flag.actions.join(" ")).toMatch(/did-not-finish from a one-off mishap/);
  });

  it("does not flag with no marathon on record, or a buildup starting before it", () => {
    expect(
      redemptionRaceGuardrail({ lastMarathonDate: null, newBuildupStartDate: "2027-05-03", dnfFromMishap: false }).flagged,
    ).toBe(false);
    expect(
      redemptionRaceGuardrail({
        lastMarathonDate: "2027-04-11",
        newBuildupStartDate: "2027-03-01",
        dnfFromMishap: false,
      }).flagged,
    ).toBe(false);
  });
});

describe("post-season review", () => {
  it("carries both sections and every question from the source", () => {
    expect(POST_SEASON_REVIEW_SECTIONS.map((s) => s.heading)).toEqual([
      "Reviewing your training",
      "Reviewing the race",
    ]);
    expect(POST_SEASON_REVIEW_SECTIONS[0].questions).toHaveLength(10);
    expect(POST_SEASON_REVIEW_SECTIONS[1].questions).toHaveLength(9);
  });

  it("builds a numbered message with the marker that detects a resend", () => {
    const body = postSeasonReviewMessage();
    expect(body).toContain(POST_SEASON_REVIEW_MARKER);
    expect(body).toMatch(/1\. On which days did you feel your strongest/);
    expect(body).toMatch(/9\. If you could run it again tomorrow/);
    expect(body).toMatch(/raw material for making the next buildup yours/);
  });

  it("asks every question as a question", () => {
    for (const section of POST_SEASON_REVIEW_SECTIONS) {
      for (const question of section.questions) expect(question.trim().endsWith("?")).toBe(true);
    }
  });

  it("carries the source's typo fix through", () => {
    // The received markdown read "Would you cahange anything".
    expect(postSeasonReviewMessage()).toMatch(/Would you change anything/);
    expect(postSeasonReviewMessage()).not.toMatch(/cahange/);
  });

  it("names the race in the title line when given one, for the manual-send message copy", () => {
    const body = postSeasonReviewMessage("Chicago Marathon");
    expect(body.split("\n\n")[0]).toBe("Post-Season Review: Chicago Marathon");
    // Still contains the plain marker as a substring, so a resend check
    // against POST_SEASON_REVIEW_MARKER still matches a named message too.
    expect(body).toContain(POST_SEASON_REVIEW_MARKER);
  });

  it("keeps the plain title with no race name -- every existing call site is unaffected", () => {
    expect(postSeasonReviewMessage()).toMatch(/^Post-Season Review\n/);
    expect(postSeasonReviewMessage(null)).toMatch(/^Post-Season Review\n/);
  });
});

describe("postSeasonReviewQuestions", () => {
  it("flattens every section's questions in order, with a stable per-question key", () => {
    const questions = postSeasonReviewQuestions();
    expect(questions).toHaveLength(19);
    expect(questions[0]).toEqual({
      sectionHeading: "Reviewing your training",
      questionIndex: 0,
      question: "On which days did you feel your strongest in workouts?",
    });
    expect(questions[18]).toEqual({
      sectionHeading: "Reviewing the race",
      questionIndex: 8,
      question: "If you could run it again tomorrow at the same fitness, what would you do differently?",
    });
  });

  it("carries one entry per question with no duplicate (section, index) pairs", () => {
    const keys = postSeasonReviewQuestions().map((q) => `${q.sectionHeading}:${q.questionIndex}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
