import { describe, it, expect } from "vitest";
import {
  CROSS_TRAINING_HOURS_CAP,
  CROSS_TRAINING_MODES,
  HIGH_RISK_BONE_LOCATIONS,
  MEDICAL_NOTE,
  READY_TO_RUN_CHECKLIST,
  TENDON_PAIN_RULES,
  catchEarlyNudge,
  crossTrainingProtocol,
  detrainingReassurance,
  illnessGuidanceForCoach,
  illnessPattern,
  mentionsPossibleIllness,
  illnessReturnProgression,
  injuryGuidance,
  raceWeekIllnessGuidance,
  readyToRunSelfCheck,
  type SetbackGuidance,
} from "@/lib/private-coaching/setbacks";

// Every guidance-producing path in the module, so the boundary tests below
// can assert across all of them rather than per function.
const EVERY_GUIDANCE: SetbackGuidance[] = [
  readyToRunSelfCheck([]).guidance,
  readyToRunSelfCheck(["fever"]).guidance,
  readyToRunSelfCheck(["throat-nose"]).guidance,
  illnessGuidanceForCoach([]),
  illnessGuidanceForCoach(["fever", "aches"]),
  illnessGuidanceForCoach(["throat-nose"]),
  illnessReturnProgression(),
  raceWeekIllnessGuidance([]),
  raceWeekIllnessGuidance(["fever"]),
  raceWeekIllnessGuidance(["chills"]),
  raceWeekIllnessGuidance(["breathing"]),
  raceWeekIllnessGuidance(["throat-nose"]),
  injuryGuidance({ character: "bone-like" }),
  injuryGuidance({ character: "bone-like", location: "navicular" }),
  injuryGuidance({ character: "tendon-like" }),
  injuryGuidance({ character: "knee-or-gait" }),
  injuryGuidance({ character: "unclear" }),
  catchEarlyNudge(),
  detrainingReassurance(),
  detrainingReassurance({ missedWeeks: 3 }),
  crossTrainingProtocol(),
  crossTrainingProtocol({ lostRunningMinutesPerWeek: 300 }),
];

describe("the never-diagnose boundary", () => {
  it("attaches the medical note to every single guidance path", () => {
    // Structural, not conventional: guidance objects are built through one
    // helper that attaches this, so there is no path that omits it.
    expect(EVERY_GUIDANCE.length).toBeGreaterThan(20);
    for (const g of EVERY_GUIDANCE) {
      expect(g.medicalNote).toBe(MEDICAL_NOTE);
    }
  });

  it("says plainly in that note that nothing here is a diagnosis", () => {
    expect(MEDICAL_NOTE).toMatch(/not medical advice/i);
    expect(MEDICAL_NOTE).toMatch(/nothing here is a diagnosis/i);
    expect(MEDICAL_NOTE).toMatch(/doctor or physical therapist/i);
  });

  it("never names a condition anywhere in its copy", () => {
    // The module describes patterns of symptoms and paradigms of tissue.
    // It must not name what the athlete has.
    const everything = EVERY_GUIDANCE.map((g) => `${g.title} ${g.detail} ${g.actions.join(" ")}`).join(" ").toLowerCase();
    for (const condition of [
      "stress fracture",
      "tendinopathy",
      "tendinitis",
      "tendonitis",
      "plantar fasciitis",
      "shin splints",
      "runner's knee",
      "it band syndrome",
      "covid",
      "influenza",
      "bronchitis",
      "pneumonia",
      "anemia",
      "overtraining syndrome",
    ]) {
      expect(everything).not.toContain(condition);
    }
  });

  it("never clears anyone to run", () => {
    const everything = EVERY_GUIDANCE.map((g) => `${g.title} ${g.detail} ${g.actions.join(" ")}`).join(" ").toLowerCase();
    for (const clearance of ["cleared to run", "safe to run", "you are fine", "nothing to worry about", "medically cleared"]) {
      expect(everything).not.toContain(clearance);
    }
  });

  it("names its self-check outcomes as judgments about today, not as clearance", () => {
    expect(readyToRunSelfCheck([]).outcome).toBe("easy-run-reasonable");
    expect(readyToRunSelfCheck(["cough"]).outcome).toBe("rest-today");
  });
});

describe("READY_TO_RUN_CHECKLIST", () => {
  it("covers every symptom the checklist is supposed to ask about", () => {
    expect(READY_TO_RUN_CHECKLIST.map((i) => i.id)).toEqual([
      "fever",
      "chills",
      "fatigue",
      "aches",
      "breathing",
      "chest",
      "dizziness",
      "heart-rate",
      "cough",
      "headache",
      "throat-nose",
      "abdominal",
      "unwell",
    ]);
  });

  it("asks everything as a question, including the catch-all", () => {
    for (const item of READY_TO_RUN_CHECKLIST) expect(item.question.trim().endsWith("?")).toBe(true);
    expect(READY_TO_RUN_CHECKLIST.at(-1)!.id).toBe("unwell");
    expect(READY_TO_RUN_CHECKLIST.at(-1)!.systemic).toBe(true);
  });

  it("marks the whole-body signs as systemic", () => {
    const systemic = READY_TO_RUN_CHECKLIST.filter((i) => i.systemic).map((i) => i.id);
    expect(systemic).toContain("fever");
    expect(systemic).toContain("chest");
    expect(systemic).toContain("breathing");
    expect(systemic).not.toContain("throat-nose");
    expect(systemic).not.toContain("cough");
  });
});

describe("readyToRunSelfCheck", () => {
  it("all-clear says an easy run is reasonable and to re-check during and after", () => {
    const result = readyToRunSelfCheck([]);
    expect(result.flagged).toEqual([]);
    expect(result.guidance.detail).toMatch(/treat the run itself as part of the check/i);
    expect(result.guidance.actions.join(" ")).toMatch(/Check again after the run/);
  });

  it("any yes makes it a rest day, and reports which items", () => {
    const result = readyToRunSelfCheck(["cough", "headache"]);
    expect(result.outcome).toBe("rest-today");
    expect(result.flagged.map((i) => i.id)).toEqual(["cough", "headache"]);
    expect(result.anySystemic).toBe(false);
    expect(result.guidance.actions.join(" ")).toMatch(/Do not run today/);
  });

  it("weights a whole-body sign differently in the wording", () => {
    const systemic = readyToRunSelfCheck(["fever"]);
    expect(systemic.anySystemic).toBe(true);
    expect(systemic.guidance.key).toBe("self-check:rest-systemic");
    expect(systemic.guidance.detail).toMatch(/whole-body sign/i);
  });

  it("tells the athlete not to plan their return now", () => {
    expect(readyToRunSelfCheck(["fever"]).guidance.actions.join(" ")).toMatch(/Do not plan your return now/);
  });

  it("ignores answers that are not checklist items", () => {
    expect(readyToRunSelfCheck(["not-a-symptom"]).outcome).toBe("easy-run-reasonable");
  });
});

describe("illnessPattern and the coach guidance", () => {
  it("separates neck-and-above from whole-body", () => {
    expect(illnessPattern(["throat-nose"])).toBe("neck-and-above");
    expect(illnessPattern(["cough", "headache"])).toBe("neck-and-above");
    expect(illnessPattern(["fever"])).toBe("whole-body");
    expect(illnessPattern(["throat-nose", "chills"])).toBe("whole-body");
    expect(illnessPattern([])).toBe("unclear");
  });

  it("stops training entirely for whole-body symptoms", () => {
    const g = illnessGuidanceForCoach(["fever", "aches"]);
    expect(g.title).toMatch(/No training/);
    expect(g.actions.join(" ")).toMatch(/Clear the week rather than shrinking it/);
  });

  it("keeps easy running but drops workouts for neck-and-above", () => {
    const g = illnessGuidanceForCoach(["throat-nose"]);
    expect(g.title).toMatch(/Easy running is usually fine, workouts are not/);
    expect(g.detail).toMatch(/do not tolerate is intensity/i);
  });

  it("escalates if anything whole-body appears later", () => {
    expect(illnessGuidanceForCoach(["cough"]).actions.join(" ")).toMatch(/stop training entirely/i);
  });
});

describe("illnessReturnProgression", () => {
  it("is easy days, then one light workout, then full sessions", () => {
    const g = illnessReturnProgression();
    expect(g.detail).toMatch(/Easy running first/i);
    expect(g.actions.join(" ")).toMatch(/progression run, cruise intervals, or cut-down repeats/);
    expect(g.actions.join(" ")).toMatch(/Only resume full sessions/);
  });

  it("does not let the athlete jump ahead in the progression", () => {
    expect(illnessReturnProgression().actions.join(" ")).toMatch(/rather than jumping to where the plan has got to/);
  });
});

describe("raceWeekIllnessGuidance", () => {
  it("treats a fever as the one firm no", () => {
    for (const answer of ["fever", "chills"]) {
      const g = raceWeekIllnessGuidance([answer]);
      expect(g.title).toBe("Reschedule the race");
      expect(g.detail).toMatch(/heat illness/i);
      expect(g.actions.join(" ")).toMatch(/Do not start the race/);
    }
  });

  it("makes not racing the default for other whole-body symptoms, without deciding", () => {
    const g = raceWeekIllnessGuidance(["breathing"]);
    expect(g.detail).toMatch(/a judgment rather than a rule/i);
    expect(g.actions.join(" ")).toMatch(/make them argue for racing/);
  });

  it("does not treat a mild illness as a reason not to race", () => {
    const g = raceWeekIllnessGuidance(["throat-nose"]);
    expect(g.title).toMatch(/not on its own a reason not to race/);
    expect(g.detail).toMatch(/different thing from being a reason not to start/);
  });

  it("says nothing to weigh when the check is clear", () => {
    expect(raceWeekIllnessGuidance([]).key).toBe("illness:race-week:clear");
  });
});

describe("injuryGuidance", () => {
  it("sends bone-like pain for evaluation rather than managing it with training", () => {
    const g = injuryGuidance({ character: "bone-like" });
    expect(g.actions.join(" ")).toMatch(/professional evaluation now/i);
    // And it does not swing to the opposite error either.
    expect(g.detail).toMatch(/balances loading against tissue repair rather than prescribing prolonged complete rest/);
  });

  it("escalates harder for a high-risk location, and lists them", () => {
    const g = injuryGuidance({ character: "bone-like", location: "navicular" });
    expect(g.key).toBe("injury:bone:high-risk");
    expect(g.title).toMatch(/high-risk location/);
    for (const site of HIGH_RISK_BONE_LOCATIONS) expect(g.detail).toContain(site);
  });

  it("loads tendon-like pain under monitoring rules rather than resting it", () => {
    const g = injuryGuidance({ character: "tendon-like" });
    expect(g.title).toMatch(/load it rather than rest it/);
    for (const rule of TENDON_PAIN_RULES) expect(g.actions.join(" ")).toContain(rule);
    // Still routed through a professional, not self-prescribed.
    expect(g.actions.join(" ")).toMatch(/guided by a physical therapist/);
  });

  it("treats knee pain as a mechanics question, not only a volume one", () => {
    const g = injuryGuidance({ character: "knee-or-gait" });
    expect(g.detail).toMatch(/same workout injures one runner and not another/);
    expect(g.actions.join(" ")).toMatch(/mechanics question, not a volume one/);
  });

  it("refuses to pick a paradigm when the character is unclear", () => {
    const g = injuryGuidance({ character: "unclear" });
    expect(g.detail).toMatch(/Guessing between them is worse than asking/);
    expect(g.actions.join(" ")).toMatch(/refer rather than choosing an approach/);
  });

  it("keeps the pain-monitoring rules concrete and bounded", () => {
    expect(TENDON_PAIN_RULES).toHaveLength(4);
    expect(TENDON_PAIN_RULES.join(" ")).toMatch(/5 out of 10 during/);
    expect(TENDON_PAIN_RULES.join(" ")).toMatch(/no worse the next morning/i);
    expect(TENDON_PAIN_RULES.join(" ")).toMatch(/not trending worse/i);
  });
});

describe("catchEarlyNudge", () => {
  it("makes the cheap decision explicit and says why it feels unnecessary", () => {
    const g = catchEarlyNudge();
    expect(g.title).toMatch(/few days now beats weeks later/);
    expect(g.detail).toMatch(/feels unnecessary at the time/);
  });

  it("treats a recurring niggle as a reason to escalate, not to rest again", () => {
    expect(catchEarlyNudge().actions.join(" ")).toMatch(/reason to get it looked at, not a reason to rest again/);
  });
});

describe("detrainingReassurance", () => {
  it("leads with the fact that this is not starting over", () => {
    expect(detrainingReassurance().title).toMatch(/not starting over/);
    expect(detrainingReassurance({ missedWeeks: 3 }).title).toMatch(/3 weeks out is not starting over/);
    expect(detrainingReassurance({ missedWeeks: 1 }).title).toMatch(/1 week out/);
  });

  it("names what holds, what falls, and what actually fades", () => {
    const g = detrainingReassurance();
    expect(g.detail).toMatch(/sixty percent/);
    expect(g.detail).toMatch(/five percent over two weeks/);
    expect(g.detail).toMatch(/blood plasma volume/);
    expect(g.detail).toMatch(/economy is stubbornly resilient/i);
    expect(g.detail).toMatch(/glycogen storage/);
    expect(g.detail).toMatch(/resistance to muscle damage/);
  });

  it("attaches no citation to those figures", () => {
    // Inventing a source would be worse than giving none.
    const g = detrainingReassurance();
    expect(g.detail).not.toMatch(/\b(19|20)\d{2}\b/);
    expect(g.detail).not.toMatch(/et al/i);
    expect(g.detail).not.toMatch(/study|journal|research found/i);
  });

  it("tells the coach to say it out loud, because the athlete will assume otherwise", () => {
    expect(detrainingReassurance().actions.join(" ")).toMatch(/because they will assume they are/);
  });

  it("keeps intensity rather than making everything easy", () => {
    expect(detrainingReassurance().actions.join(" ")).toMatch(/Keep some intensity/);
  });
});

describe("crossTrainingProtocol", () => {
  it("puts deep-water running first and explains the heart-rate offset", () => {
    expect(CROSS_TRAINING_MODES[0].mode).toBe("Deep-water running");
    expect(CROSS_TRAINING_MODES[0].first).toBe(true);
    expect(CROSS_TRAINING_MODES[0].why).toMatch(/ten to thirteen beats lower/);
  });

  it("replaces lost time one for one, with the real number when known", () => {
    expect(crossTrainingProtocol({ lostRunningMinutesPerWeek: 300 }).detail).toMatch(/300 minutes a week/);
    expect(crossTrainingProtocol().detail).toMatch(/one for one/);
    expect(crossTrainingProtocol().actions.join(" ")).toMatch(/Match the lost running time, not a fraction of it/);
  });

  it("insists on real intensity, not just easy cross-training", () => {
    const g = crossTrainingProtocol();
    expect(g.detail).toMatch(/ninety percent of heart-rate reserve/);
    expect(g.detail).toMatch(/easy cross-training alone does not/);
  });

  it("caps total training and keeps cross-training through the return", () => {
    expect(CROSS_TRAINING_HOURS_CAP).toEqual({ min: 12, max: 15 });
    const actions = crossTrainingProtocol().actions.join(" ");
    expect(actions).toMatch(/12 to 15 hours a week/);
    expect(actions).toMatch(/through the return to running/);
  });

  it("prefers adding to a lower-volume plan over hollowing out a high-volume one", () => {
    expect(crossTrainingProtocol().actions.join(" ")).toMatch(
      /adding cross-training to a lower-volume plan over swapping easy miles out of a high-volume one/,
    );
  });
});

describe("mentionsPossibleIllness", () => {
  it("catches common illness mentions in free text", () => {
    expect(mentionsPossibleIllness("Felt a bit sick on Tuesday, skipped the workout")).toBe(true);
    expect(mentionsPossibleIllness("Sore throat and stuffy nose all week")).toBe(true);
    expect(mentionsPossibleIllness("Think I'm coming down with something")).toBe(false); // not in the list on purpose: too vague a phrase to key off
  });

  it("does not fire on unrelated concern text", () => {
    expect(mentionsPossibleIllness("Worried about my long run pace")).toBe(false);
    expect(mentionsPossibleIllness(null)).toBe(false);
    expect(mentionsPossibleIllness("")).toBe(false);
  });
});
