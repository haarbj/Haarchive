// Part I: illness, injury and setbacks.
//
// THE BOUNDARY THIS MODULE IS BUILT AROUND. The platform never diagnoses
// and never clears anyone to run. That is not a disclaimer bolted onto the
// copy, it is enforced structurally in three ways:
//
//   1. Every guidance object is built through `guidance()`, which attaches
//      MEDICAL_NOTE. There is no code path that produces a SetbackGuidance
//      without it, and a test asserts that for every exported function.
//
//   2. Nothing here returns a diagnosis. The illness functions describe
//      PATTERNS ("symptoms like these usually mean...") and never name a
//      condition. The injury functions describe PARADIGMS of tissue
//      ("pain that behaves like this is usually treated as...") and never
//      say what is wrong.
//
//   3. The self-check's outcomes are "an easy run is reasonable today" and
//      "today is a rest day", never "cleared" or "safe". The distinction
//      matters: a checklist that outputs clearance is making a medical
//      judgment, and an athlete who reads it as one will run through
//      something they should not.
//
// The athlete-facing self-check (item 22a) follows Prompt 10's gating:
// coached athletes looking at their own training, and their coach. All
// other guidance here is coach-only.
//
// All copy original. The physiological figures in the detraining section
// come from the coaching methodology this platform is built on, as supplied
// to the project; they are reproduced as coaching guidance and are
// deliberately NOT attributed to a study, because inventing a citation is
// worse than giving none (CLAUDE.md section 5).

export const MEDICAL_NOTE =
  "This is coaching guidance, not medical advice, and nothing here is a diagnosis. Anything painful, persistent, or worsening is a conversation with a doctor or physical therapist.";

export type SetbackGuidance = {
  key: string;
  title: string;
  detail: string;
  actions: string[];
  /** Always present, attached by construction. */
  medicalNote: string;
};

function guidance(input: Omit<SetbackGuidance, "medicalNote">): SetbackGuidance {
  return { ...input, medicalNote: MEDICAL_NOTE };
}

// ---------------------------------------------------------------------------
// Item 22a: the athlete-facing "ready to run?" self-check
// ---------------------------------------------------------------------------

export type SelfCheckItem = {
  id: string;
  /** What the athlete is asked, in their own terms. */
  question: string;
  /** Whole-body signs, which carry extra weight for the race-day question. */
  systemic: boolean;
};

export const READY_TO_RUN_CHECKLIST: SelfCheckItem[] = [
  { id: "fever", question: "A fever, or a temperature that feels higher than normal?", systemic: true },
  { id: "chills", question: "Chills or shivering?", systemic: true },
  { id: "fatigue", question: "Fatigue well beyond normal training tiredness?", systemic: true },
  { id: "aches", question: "Aching through your whole body, rather than in one place?", systemic: true },
  { id: "breathing", question: "Any difficulty breathing, at rest or walking around?", systemic: true },
  { id: "chest", question: "Chest pain, pressure or tightness?", systemic: true },
  { id: "dizziness", question: "Dizziness or light-headedness?", systemic: true },
  { id: "heart-rate", question: "A racing or pounding heartbeat while sitting still?", systemic: true },
  { id: "cough", question: "A cough that is more than occasional and dry?", systemic: false },
  { id: "headache", question: "A severe headache?", systemic: false },
  { id: "throat-nose", question: "Sore throat or blocked nose that has not started easing?", systemic: false },
  { id: "abdominal", question: "Stomach trouble: nausea, vomiting or diarrhoea?", systemic: false },
  { id: "unwell", question: "Or simply: do you not feel well enough to run today?", systemic: true },
];

export type SelfCheckOutcome = "easy-run-reasonable" | "rest-today";

export type SelfCheckResult = {
  outcome: SelfCheckOutcome;
  /** Which items the athlete answered yes to. */
  flagged: SelfCheckItem[];
  /** True when any flagged item is a whole-body sign. */
  anySystemic: boolean;
  guidance: SetbackGuidance;
};

/**
 * The self-check's result.
 *
 * Note what this deliberately is not: it is not a clearance, and the
 * outcome names say so. All-clear produces "an easy run is reasonable
 * today", paired with an instruction to check again DURING and after the
 * run, because a self-check answers for the moment it was taken and
 * nothing more.
 */
export function readyToRunSelfCheck(yesAnswers: string[]): SelfCheckResult {
  const flagged = READY_TO_RUN_CHECKLIST.filter((item) => yesAnswers.includes(item.id));
  const anySystemic = flagged.some((item) => item.systemic);

  if (flagged.length === 0) {
    return {
      outcome: "easy-run-reasonable",
      flagged,
      anySystemic: false,
      guidance: guidance({
        key: "self-check:clear",
        title: "An easy run is reasonable today",
        detail:
          "Nothing on the list is a yes, so easy running is a sensible choice. Keep it easy, and treat the run itself as part of the check: if you start feeling worse once you are moving, that is the answer and you should stop and walk home. Run the check again afterwards, and again tomorrow.",
        actions: [
          "Keep it easy. Today is not the day to find out how a workout goes.",
          "Stop and walk if anything on the list shows up mid-run.",
          "Check again after the run, and again tomorrow before running.",
        ],
      }),
    };
  }

  return {
    outcome: "rest-today",
    flagged,
    anySystemic,
    guidance: guidance({
      key: anySystemic ? "self-check:rest-systemic" : "self-check:rest",
      title: "Today is a rest day",
      detail: anySystemic
        ? "At least one of the things you flagged is a whole-body sign rather than something local, and those are the ones worth taking seriously. Rest today, tell your coach, and run the check again tomorrow rather than deciding now when you will be back."
        : "Something on the list is a yes, so today is a rest day. Rest, tell your coach, and check again tomorrow. Most of this resolves in a few days and costs nothing.",
      actions: [
        "Do not run today.",
        "Tell your coach, so the week can be adjusted rather than quietly missed.",
        "Run this check again tomorrow. Do not plan your return now.",
      ],
    }),
  };
}

// ---------------------------------------------------------------------------
// Item 22b: cold-like versus flu-like, for the coach
// ---------------------------------------------------------------------------

export type IllnessPattern = "neck-and-above" | "whole-body" | "unclear";

/**
 * Which pattern a set of flagged symptoms fits.
 *
 * A PATTERN, not a diagnosis. The distinction it draws is the long-standing
 * coaching one: symptoms confined to the head and throat behave differently
 * from symptoms involving the whole system, and the training answer differs.
 * It names no illness and identifies no cause.
 */
export function illnessPattern(yesAnswers: string[]): IllnessPattern {
  const flagged = READY_TO_RUN_CHECKLIST.filter((item) => yesAnswers.includes(item.id));
  if (flagged.length === 0) return "unclear";
  if (flagged.some((item) => item.systemic)) return "whole-body";
  return "neck-and-above";
}

export function illnessGuidanceForCoach(yesAnswers: string[]): SetbackGuidance {
  const pattern = illnessPattern(yesAnswers);

  if (pattern === "whole-body") {
    return guidance({
      key: "illness:whole-body",
      title: "No training while this is whole-body",
      detail:
        "Fever, chills, aching all over, chest tightness or breathlessness are the signs that say stop rather than reduce. Training through them does not build anything, delays the recovery, and carries risks that have nothing to do with fitness. There is no version of this week worth protecting.",
      actions: [
        "No training at all until the whole-body signs have gone.",
        "Clear the week rather than shrinking it, and tell the athlete you have.",
        "Ask them to see a doctor if it is not clearly improving, and sooner than that if breathing or chest symptoms are involved.",
      ],
    });
  }

  if (pattern === "neck-and-above") {
    return guidance({
      key: "illness:neck-and-above",
      title: "Easy running is usually fine, workouts are not",
      detail:
        "Symptoms from the neck up, a blocked nose or a mild sore throat with nothing systemic alongside them, generally tolerate easy running. What they do not tolerate is intensity: a workout run on top of even a mild illness is how a three-day inconvenience becomes a two-week one.",
      actions: [
        "Keep easy running if the athlete wants to, and drop every workout.",
        "Have them use the self-check daily rather than deciding in advance.",
        "If anything whole-body appears, stop training entirely.",
      ],
    });
  }

  return guidance({
    key: "illness:unclear",
    title: "Nothing flagged",
    detail:
      "The self-check came back clear, so there is no illness guidance to give. If the athlete still feels wrong, that is itself on the list and worth asking about directly.",
    actions: ["Ask how they actually feel, rather than relying on the checklist alone."],
  });
}

/** Item 22c: coming back once the illness has passed. */
export function illnessReturnProgression(): SetbackGuidance {
  return guidance({
    key: "illness:return",
    title: "Easy days first, then one lighter workout",
    detail:
      "The mistake is going straight back to the session that was missed. Easy running first, for as many days as it takes to feel normal doing it, then one deliberately light workout to find out where things actually are before committing to a full session. A Kenyan-style progression run, a set of cruise intervals, or cut-down repeats all work for this, because all three can be abandoned halfway through without wasting anything.",
    actions: [
      "Easy days until easy running feels normal again, however many that is.",
      "Then one light workout to test the water: a progression run, cruise intervals, or cut-down repeats.",
      "Only resume full sessions once that one goes well.",
      "Pick the progression up where it left off rather than jumping to where the plan has got to.",
    ],
  });
}

/**
 * Item 22d: illness in race week.
 *
 * INFORMS the call, never makes it. The one firm line is a fever: running
 * hard with one carries a real heat-illness risk, which is a safety matter
 * rather than a performance one. Everything else is handed back to the
 * coach and athlete with the tradeoff named.
 */
export function raceWeekIllnessGuidance(yesAnswers: string[]): SetbackGuidance {
  const pattern = illnessPattern(yesAnswers);
  const hasFever = yesAnswers.includes("fever") || yesAnswers.includes("chills");

  if (hasFever) {
    return guidance({
      key: "illness:race-week:fever",
      title: "Reschedule the race",
      detail:
        "Racing hard with a fever is the one case here that is a safety question rather than a performance one: it meaningfully raises the risk of heat illness, and a marathon offers hours in which that can develop. This is the call that gets made for the athlete rather than with them.",
      actions: [
        "Do not start the race.",
        "Have them see a doctor rather than waiting it out alone.",
        "Find another date once they are well, and run the recovery arc into it.",
      ],
    });
  }

  if (pattern === "whole-body") {
    return guidance({
      key: "illness:race-week:systemic",
      title: "Whole-body symptoms in race week point to not racing",
      detail:
        "Without a fever this is a judgment rather than a rule, but whole-body signs in race week usually mean the race will go badly and the recovery from it will go worse. A marathon run from a compromised start is a long time to spend digging a hole.",
      actions: [
        "Treat not racing as the default and make them argue for racing, rather than the other way round.",
        "If they do start, agree in advance what would make them stop.",
        "Involve a doctor before the decision, not after it.",
      ],
    });
  }

  if (pattern === "neck-and-above") {
    return guidance({
      key: "illness:race-week:mild",
      title: "A mild illness is not on its own a reason not to race",
      detail:
        "Symptoms from the neck up, with nothing systemic, are not a reason to abandon a race the athlete has spent months building toward. It may cost some performance. That is a different thing from being a reason not to start, and the fitness is not going anywhere in a week.",
      actions: [
        "Have them run the self-check on race morning and take it seriously.",
        "Adjust the goal rather than the start line if they feel flat warming up.",
        "Agree a stopping point in advance, so that decision is not being made at mile 18 while depleted.",
      ],
    });
  }

  return guidance({
    key: "illness:race-week:clear",
    title: "Nothing flagged in race week",
    detail: "The self-check is clear, so there is nothing here to weigh against racing.",
    actions: ["Carry on with race week as planned."],
  });
}

// ---------------------------------------------------------------------------
// Item 23: injury
// ---------------------------------------------------------------------------

export type PainCharacter = "bone-like" | "tendon-like" | "knee-or-gait" | "unclear";

/**
 * High-risk locations where bone-like pain warrants prompt evaluation.
 *
 * A list of PLACES, not a list of diagnoses. Its only job is to make the
 * coach escalate faster when the pain is somewhere that tolerates delay
 * badly.
 */
export const HIGH_RISK_BONE_LOCATIONS = [
  "femoral neck (deep in the hip or groin)",
  "patella (kneecap)",
  "anterior tibial shaft (the front edge of the shin)",
  "talus (deep in the ankle)",
  "navicular (the top inside of the midfoot)",
  "base of the fifth metatarsal (the outside edge of the foot)",
];

/** Item 23's tendon pain-monitoring rules, as a coach can actually apply them. */
export const TENDON_PAIN_RULES = [
  "Pain stays at or below 5 out of 10 during the run.",
  "Pain stays at or below 5 out of 10 afterwards.",
  "It is no worse the next morning than it was before the run.",
  "It is not trending worse across weeks.",
];

export function injuryGuidance(input: { character: PainCharacter; location?: string | null }): SetbackGuidance {
  const location = input.location?.trim() || null;

  if (input.character === "bone-like") {
    const highRisk = location
      ? HIGH_RISK_BONE_LOCATIONS.some((known) => known.toLowerCase().includes(location.toLowerCase()) || location.toLowerCase().includes(known.split(" ")[0].toLowerCase()))
      : false;
    return guidance({
      key: highRisk ? "injury:bone:high-risk" : "injury:bone",
      title: highRisk
        ? "Sharp, localised pain in a high-risk location: get it looked at now"
        : "Sharp, localised pain: get it evaluated before training through it",
      detail: highRisk
        ? `Pain that is sharp and that you can point to with one finger, in a location like this one, is the combination that tolerates waiting worst. The high-risk sites are: ${HIGH_RISK_BONE_LOCATIONS.join("; ")}. Prompt professional evaluation is the whole of the coaching advice here.`
        : `Pain that is sharp and highly localised, rather than dull and spread out, is handled differently from the tendon pattern and should be evaluated rather than managed by a training adjustment. Note that current practice balances loading against tissue repair rather than prescribing prolonged complete rest, so "stop everything indefinitely" is usually not the answer either. That balance is a clinician's call to make, not a coach's.`,
      actions: [
        "Refer them for professional evaluation now, not after another week of training.",
        "Stop the running that reproduces it in the meantime.",
        "Do not prescribe a graded return until someone qualified has looked at it.",
      ],
    });
  }

  if (input.character === "tendon-like") {
    return guidance({
      key: "injury:tendon",
      title: "Dull, load-dependent pain: load it rather than rest it",
      detail:
        "Pain that is dull, that tracks with how much load went through it, and that often warms up as you go, behaves differently from the bone pattern. Tendon tissue generally responds to heavy, progressive strength work aimed at the tendon itself, and responds poorly to being rested until it stops hurting. Some pain during and after running is acceptable while that is happening, within monitoring rules rather than by feel alone.",
      actions: [
        `Apply the pain-monitoring rules: ${TENDON_PAIN_RULES.join(" ")}`,
        "Add heavy, progressive strength work targeting the tendon, guided by a physical therapist.",
        "Any rule broken means back off, rather than pushing to see whether it settles.",
      ],
    });
  }

  if (input.character === "knee-or-gait") {
    return guidance({
      key: "injury:knee",
      title: "Knee pain: the load is only half the question",
      detail:
        "How much damage a given training load does at the knee is mediated by strength and by how the athlete moves. That is why the same workout injures one runner and not another, and why cutting mileage alone often only postpones it. The useful work is finding the strength deficit or the mechanical pattern underneath, which needs an assessment rather than a guess.",
      actions: [
        "Have them assessed for strength deficits and gait mechanics rather than only reducing load.",
        "Reduce the specific load that reproduces it in the meantime.",
        "Treat a knee problem that keeps returning at the same mileage as a mechanics question, not a volume one.",
      ],
    });
  }

  return guidance({
    key: "injury:unclear",
    title: "Not enough to tell which pattern this is",
    detail:
      "Where the pain is and how it behaves are what decide the approach, and they point in genuinely different directions: sharp and pinpoint is handled one way, dull and load-dependent another, and the knee a third. Guessing between them is worse than asking.",
    actions: [
      "Ask where exactly it is, whether it is sharp or dull, and whether it changes with load.",
      "If it is not clear, refer rather than choosing an approach.",
    ],
  });
}

/** The catch-early nudge, shown wherever pain is first reported. */
export function catchEarlyNudge(): SetbackGuidance {
  return guidance({
    key: "injury:catch-early",
    title: "A few days now beats weeks later",
    detail:
      "Almost every long layoff started as something small that was trained through for another week or two. Taking three or four days at the first sign is the cheapest decision available, and it is cheap precisely because it feels unnecessary at the time.",
    actions: [
      "Take the few days now.",
      "Replace the running rather than simply losing it, if the athlete wants to keep moving.",
      "Treat a niggle that returns in the same place as a reason to get it looked at, not a reason to rest again.",
    ],
  });
}

// ---------------------------------------------------------------------------
// Item 24: detraining reassurance
// ---------------------------------------------------------------------------

/**
 * What actually happens to fitness during a layoff, for use wherever the
 * helper compresses or shortens a plan.
 *
 * The figures are the methodology's own and are reproduced as coaching
 * guidance without a citation attached, because inventing one would be
 * worse than giving none. The point is not the exact numbers; it is that
 * the shape of the loss is far kinder than athletes assume.
 */
export function detrainingReassurance(input: { missedWeeks?: number } = {}): SetbackGuidance {
  const weeks = input.missedWeeks;
  return guidance({
    key: "detraining",
    title: weeks != null && weeks > 0 ? `${weeks} week${weeks === 1 ? "" : "s"} out is not starting over` : "A missed week is not starting over",
    detail:
      "Training volume can come down a long way, on the order of sixty percent, without a significant loss of fitness, provided the intensity distribution is preserved. What falls fastest early is aerobic capacity, around five percent over two weeks, and most of that early drop is blood plasma volume rather than anything structural, which is also why the fittest athletes have the most to lose at first and regain it quickest. Running economy is stubbornly resilient. What genuinely fades is glycogen storage, noticeable within a week, and resistance to muscle damage, which is why the first weeks back feel sorer than they should.",
    actions: [
      "Keep some intensity rather than making everything easy, if the athlete is training at all.",
      "Expect the first sessions back to feel worse than the fitness actually is.",
      "Expect soreness out of proportion to the effort, and plan easy days around it.",
      "Tell the athlete plainly that they are not starting over, because they will assume they are.",
    ],
  });
}

// ---------------------------------------------------------------------------
// Item 25: cross-training
// ---------------------------------------------------------------------------

export const CROSS_TRAINING_MODES = [
  {
    mode: "Deep-water running",
    why: "The closest thing to running without the impact: a flotation belt and a running gait rather than a swim stroke. Expect maximum heart rate in water to sit roughly ten to thirteen beats lower, so judge by effort rather than comparing the numbers to a run.",
    first: true,
  },
  {
    mode: "Elliptical",
    why: "Works well when the cadence is kept running-like rather than slow and grinding.",
    first: false,
  },
  {
    mode: "Cycling",
    why: "An upright bike at eighty to a hundred revolutions a minute. Lower cadence turns it into strength work, which is a different session.",
    first: false,
  },
];

/** Total weekly training ceiling once cross-training is added on top. */
export const CROSS_TRAINING_HOURS_CAP = { min: 12, max: 15 } as const;

export function crossTrainingProtocol(input: { lostRunningMinutesPerWeek?: number } = {}): SetbackGuidance {
  const lost = input.lostRunningMinutesPerWeek;
  return guidance({
    key: "cross-training",
    title: "Replace the time one for one, and keep some intensity in it",
    detail:
      lost != null && lost > 0
        ? `Replace the ${lost} minutes a week of lost running with about the same amount of cross-training at a similar intensity, rather than a token amount. ${CROSS_TRAINING_MODES[0].mode} is the first choice: ${CROSS_TRAINING_MODES[0].why} On top of that, one or two interval sessions a week at ninety percent of heart-rate reserve or above are what preserve mitochondrial function and cardiac structure; easy cross-training alone does not.`
        : `Replace lost running time one for one with cross-training at a similar intensity, rather than a token amount. ${CROSS_TRAINING_MODES[0].mode} is the first choice: ${CROSS_TRAINING_MODES[0].why} On top of that, one or two interval sessions a week at ninety percent of heart-rate reserve or above are what preserve mitochondrial function and cardiac structure; easy cross-training alone does not.`,
    actions: [
      "Match the lost running time, not a fraction of it.",
      "Add one or two hard interval sessions a week at ninety percent of heart-rate reserve or above.",
      `Cap total training at ${CROSS_TRAINING_HOURS_CAP.min} to ${CROSS_TRAINING_HOURS_CAP.max} hours a week including the cross-training.`,
      "Keep some cross-training going through the return to running, rather than dropping it the week they run again.",
      "Prefer adding cross-training to a lower-volume plan over swapping easy miles out of a high-volume one: workout volume should scale with running mileage, not with total training time.",
    ],
  });
}

// ---------------------------------------------------------------------------
// Item 22, trigger: spotting a possible illness mention in a check-in
// ---------------------------------------------------------------------------
//
// A keyword scan over free text, used ONLY to decide whether to OFFER the
// illness guidance panel -- never to apply a protocol, never to decide
// anything about training on its own. Same discipline as plan-health.ts's
// hasAdverseConditions: a false positive costs nothing (the coach opens a
// panel and finds nothing to act on), and a false negative costs nothing
// new either, since the coach reads the check-in's own text regardless.
// This exists only to make the offer easier to notice, not to replace
// reading the check-in.
const ILLNESS_MENTION_WORDS = [
  "sick", "illness", "ill", "unwell", "not feeling well", "not feeling good",
  "cold", "flu", "fever", "cough", "sore throat", "congestion", "congested",
  "stuffy", "runny nose", "nausea", "nauseous", "vomit", "diarrhea", "diarrhoea",
  "chills", "achy", "aches all over", "body aches",
];

export function mentionsPossibleIllness(text: string | null | undefined): boolean {
  if (!text) return false;
  const value = text.toLowerCase();
  return ILLNESS_MENTION_WORDS.some((word) => value.includes(word));
}
