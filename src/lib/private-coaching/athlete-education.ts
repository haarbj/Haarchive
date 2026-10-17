// The education library a coached athlete gets alongside their schedule:
// how training works, how to pace and read effort, how to fuel, and what
// each kind of workout is for.
//
// Original copy in a coaching voice, written for this platform. Nothing
// here is transcribed from a book or another published plan, and no entry
// cites a study, a finding or a credential (CLAUDE.md §5/§15). Where the
// evidence is genuinely mixed or a number is a rule of thumb rather than a
// measurement, the copy says so rather than rounding it into false
// confidence.
//
// Authored as ContentBlock[] so it renders through the site's own
// <ContentBlocks> renderer: the callout variants carry the
// evidence-versus-philosophy distinction the rest of the site uses, and
// linkifyContent cross-links terms into the public content library for
// free. Adding a guide is a data change here, not a new route (see
// CLAUDE.md §7 on the generic-template pattern).

import type { ContentBlock } from "@/lib/sections";
import { WORKOUT_GLOSSARY, GLOSSARY_PHASE_LABELS, GLOSSARY_PHASE_ORDER } from "./workout-glossary";
import { EFFORT_LEVELS } from "./effort-levels";
import { CRASH_COURSE_EFFORT_GUIDE } from "./onboarding";

export type AthleteGuide = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  content: ContentBlock[];
};

const HOW_TRAINING_WORKS: ContentBlock[] = [
  {
    type: "paragraph",
    text: "You do not need to understand any of this to do the workouts well. But knowing what each phase is reaching for makes the difference between following a plan and being able to reason about your own training, so here is the whole system in one place.",
  },

  { type: "heading", text: "Marathon fitness has four moving parts" },
  {
    type: "paragraph",
    text: "Marathon performance is not one quality. It is four trainable things, and the useful part is knowing which is which, because each one responds to different work.",
  },
  {
    type: "list",
    items: [
      { text: "Aerobic ceiling (VO2max). The most oxygen you can use per minute, set largely by how much blood your heart moves and how much blood you have. This is the roof over everything else.", items: ["Trained by hard aerobic intervals, the kind run at close to 5K pace."] },
      { text: "Maximal steady state. The fraction of that ceiling you can hold without fatigue spiraling. Driven by capillary density, mitochondria, muscle fiber composition and how well you shuttle lactate between fibers.", items: ["Trained by sustained work just below and sometimes just above that boundary."] },
      { text: "Running economy. How efficiently you turn metabolic power into forward motion, which is part fuel choice, part force production and part skill.", items: ["Trained by relaxed running at speed, by strides and hills, and improved outright by having carbohydrate available to burn."] },
      { text: "Structural integrity. How well your tendons, bones and muscle tolerate the pounding of training itself — the capacity that lets you absorb thousands of foot strikes a week without breaking down.", items: ["Trained by volume itself: the accumulated, gradually increasing load of easy running that teaches your body to carry more."] },
    ],
  },
  {
    type: "callout",
    variant: "takeaway",
    title: "They multiply, they do not add",
    text: "Your marathon speed is the product of these four, not their sum. A modest improvement in each one compounds into a large improvement in what you can hold for the full distance, which is why training works on all four across a cycle instead of maximizing one.",
  },
  {
    type: "paragraph",
    text: "That is also the logic of the phases. The general phase works on all four of those together — no single type of workout carries it, which is why it's built as an ensemble of many different sessions rather than one dominant one. The supportive phase is where a fifth thing starts getting built on top of those four: resilience, the gap between your sustainable pace and your marathon pace, meaning how little the other four deteriorate over 26.2 miles. The specific phase pushes resilience hardest of all, since by then nearly everything you do is marathon-specific. Elite marathoners race at something like 94 to 96 percent of their maximal steady state. Recreational runners are often closer to 75 to 85 percent, and that gap is usually the single largest available improvement.",
  },

  { type: "heading", text: "Intensity has three domains, not five zones" },
  {
    type: "paragraph",
    text: "Most zone charts split the range into five or seven bands. Physiologically there are three, separated by two real boundaries, and the three behave differently from each other in ways that matter.",
  },
  {
    type: "list",
    items: [
      "Easy to moderate, up to the first lactate threshold, roughly below 80 percent of 5K pace. Fatigue here is mostly central: your brain throttling output to tired muscles rather than the muscles failing.",
      "High-end aerobic, from that first threshold up to your maximal steady state, roughly 79 to 93 percent of 5K pace. The marathon lives in this domain, within about 10 percent either side of marathon pace. Fatigue is a mix of central and peripheral.",
      "Metabolically unsustainable, above maximal steady state. Lactate, ventilation and heart rate climb on their own at a fixed pace, and exhaustion is peripheral.",
    ],
  },
  {
    type: "callout",
    variant: "tip",
    title: "No pace has magic powers",
    text: "The boundaries describe how your body behaves, they are not special paces to hit. In practice you train definitively above or below your maximal steady state rather than trying to balance exactly on it, because sitting on the line gets you the costs of both sides and the benefits of neither.",
  },
  {
    type: "paragraph",
    text: "This is why your workouts are prescribed as a percentage of your 5K pace rather than as an absolute pace. The same 7:30 mile can be an easy run for one runner and an unsustainable effort for another, because it falls in a different domain for each of them. A percentage puts every athlete in the intended domain.",
  },

  { type: "heading", text: "Training is specific, so general fitness comes first" },
  {
    type: "paragraph",
    text: "You adapt to what you actually do. That cuts both ways: marathon-specific training is the only thing that builds marathon-specific fitness, and it is also the thing you are least prepared to absorb at the start of a cycle. So the order is general fitness first, then specialization, and not only toward the marathon in general but toward your marathon. A flat, fast course, a rolling one and a hot one ask for different preparation.",
  },
  {
    type: "paragraph",
    text: "The bridge is marathon-supportive speed, roughly 10 percent either side of marathon pace. You earn the right to do marathon-specific work by building those speeds first, which is exactly what the supportive phase is for.",
  },

  { type: "heading", text: "Every speed has a place" },
  {
    type: "paragraph",
    text: "Think of paces as a ladder where every rung supports its neighbors. The rung above gives speed support to the one below. The rung below gives endurance support to the one above. There are no magic paces on the ladder and there should be no gaps in it either, which is why a marathon plan still contains 5K-paced intervals and a 5K plan still contains long runs.",
  },
  {
    type: "paragraph",
    text: "What changes across a cycle is the distribution rather than the ladder. The general phase spreads volume widely across it. The supportive phase concentrates within about 10 percent of marathon pace. The specific phase peaks sharply at marathon pace itself.",
  },

  { type: "heading", text: "Improvement comes from stress plus recovery" },
  {
    type: "paragraph",
    text: "A training stimulus has to actually disturb something to provoke an adaptation, and then you have to recover enough to absorb it. That is the whole dance, and both halves are training. Bigger sessions need more easy days after them, and the swing between your hardest and easiest days grows as the cycle progresses. By the specific phase, the easy days should look remarkably easy next to the workouts they sit between.",
  },
  {
    type: "callout",
    variant: "mistake",
    title: "Faster is not the only kind of progress",
    text: "Running the same pace for longer is improvement. In the specific phase especially, your average paces may not move at all while your fitness changes substantially, because what is improving is how long you can hold a pace rather than the pace itself.",
  },

  { type: "heading", text: "Great marathons do not happen by accident" },
  {
    type: "paragraph",
    text: "Fitness is necessary and not sufficient. The race plan converts it into a result: pacing, fueling, course strategy, and what you do when something goes wrong. Something usually does go wrong, so the plan has to be able to bend without breaking. Get the big decisions right, stay adaptable on the small ones, and keep the actual goal in view rather than the ideology around it. The goal is to run 26.2 miles as fast as you can.",
  },
  {
    type: "paragraph",
    text: "Each phase of your own schedule carries its own explanation of how these principles apply to the block you are in right now.",
    linkHref: "/coaching/training",
    linkText: "See your training roadmap",
  },
];

const PACING_AND_EFFORT: ContentBlock[] = [
  {
    type: "paragraph",
    text: "Nearly every workout you are assigned is expressed as a percentage rather than as a pace. This explains what the percentages are measured against, what to do when the pace and the effort disagree, and how precise any of it actually needs to be.",
  },

  { type: "heading", text: "What the percentages are measured against" },
  {
    type: "paragraph",
    text: "In the general phase, paces are a percentage of your current 5K pace. In the supportive and specific phases they become a percentage of your current marathon pace. The basis switches because the training switches: general work is organized around your aerobic ceiling, for which 5K pace is the better index, while supportive and specific work is organized around the race itself.",
  },
  {
    type: "callout",
    variant: "mistake",
    title: "Current fitness, not your personal best and not your goal",
    text: "Always pace off an honest estimate of what you could run today. A personal best from two years ago and a goal time you have not yet earned both produce workouts in the wrong intensity domain, and the damage is asymmetric: an optimistic estimate quietly turns every session into a harder one than was intended.",
  },
  {
    type: "paragraph",
    text: "For the marathon basis specifically, the useful framing is the pace you could hold today for the first 16 miles of a marathon, not the pace you are hoping to average on race day. Conservative is correct. Your estimate then gets revised as workouts give you evidence, which is one of the things your coach is watching for.",
  },

  { type: "heading", text: "Effort first, precision later" },
  {
    type: "paragraph",
    text: "Early in a cycle, effort outranks the number on the watch. Heat, humidity, wind, hills, bad sleep and accumulated fatigue all make a given pace cost more than it should. In those conditions, run the effort the workout is asking for and let the pace be whatever it turns out to be.",
  },
  {
    type: "paragraph",
    text: "That relationship inverts as training specializes. In the general phase you run the right effort and check the pace afterwards. In the supportive and specific phases you run the right pace and check the effort afterwards, because by then the pace is the thing being trained and the effort is how you learn whether your fitness estimate is right.",
  },

  { type: "heading", text: "What each effort should feel like" },
  {
    type: "list",
    items: EFFORT_LEVELS.map((level) => `${level.label}. ${level.feel}`),
  },
  {
    type: "paragraph",
    text: "These are the same labels as the effort field on your workout log, so logging one is a direct answer to the question your coach is actually asking.",
  },
  {
    // Item 33. A simpler six-level table for anyone new to structured
    // training, most often an athlete working through the 5K Crash
    // Course before their first real fitness estimate exists. Kept
    // alongside the main seven-level scale rather than instead of it: the
    // two serve different moments, and an athlete who outgrows this one
    // keeps reading the fuller scale above it.
    type: "callout",
    variant: "tip",
    title: "New to structured training? A simpler version",
    text: `${CRASH_COURSE_EFFORT_GUIDE.map((level) => `${level.effort}: ${level.feelsLike}.`).join(" ")} This is the scale the 5K Crash Course uses, and it is a fine substitute for the fuller one above until pacing by feel is itself familiar.`,
  },

  { type: "heading", text: "A compact map of the three domains" },
  {
    type: "list",
    items: [
      {
        text: "Easy to moderate (up to the first lactate threshold)",
        items: ["Below about 80 percent of 5K pace", "Roughly 65 to 80 percent of max heart rate", "Roughly 50 to 70 percent of heart rate reserve", "Perceived effort around 4 to 5 out of 10 at the top of the range"],
      },
      {
        text: "High-end aerobic (first threshold up to maximal steady state)",
        items: ["About 79 to 93 percent of 5K pace", "Roughly 80 to 91 percent of max heart rate", "Roughly 70 to 88 percent of heart rate reserve", "Perceived effort around 6 to 7 out of 10 at maximal steady state"],
      },
      {
        text: "Metabolically unsustainable (above maximal steady state)",
        items: ["Above about 93 percent of 5K pace", "Above roughly 91 percent of max heart rate", "Heart rate, ventilation and lactate all climb at a fixed pace", "Perceived effort 8 and up"],
      },
    ],
  },
  {
    type: "callout",
    variant: "research",
    title: "Why pace, and not a lab number",
    text: "Percentage of 5K pace is the anchor because it maps onto these three domains better than the alternatives do. The thresholds occur at widely different percentages of VO2max from runner to runner, so a percentage of VO2max does not reliably place two athletes in the same domain. Percentage of max heart rate is worse than percentage of heart rate reserve. Age-based max heart rate formulas are not usable for prescription at all, since true max heart rate varies enormously between runners of the same age. And no absolute heart rate means anything across two different people.",
  },
  {
    type: "callout",
    variant: "tip",
    title: "Two caveats on the numbers you log",
    items: [
      "Heart rate drifts upward by something like 10 to 15 percent over 30 to 60 minutes at a constant pace, and more in heat. That makes it least useful exactly where you might most want it, on long continuous efforts, and it means a climbing heart rate late in a run is not proof that your effort is climbing.",
      "Perceived effort is instantaneous, not a summary. Log it separately from how hard the session was overall, because a 7 out of 10 repeat can sit comfortably inside a 6 out of 10 workout.",
    ],
  },

  { type: "heading", text: "Adjusting for conditions and shoes" },
  {
    type: "list",
    items: [
      "Steady wind or a gradual, consistent grade: applying a correction factor to the target pace is reasonable.",
      "Gusty wind, rolling hills, or real heat: stop correcting and run by effort instead. There is no factor that captures a day like that.",
      "Super shoes are worth roughly 2 to 3 percent. If a session is precisely paced, account for which shoes you are in rather than treating the two as interchangeable.",
    ],
  },

  { type: "heading", text: "A diagnostic worth knowing" },
  {
    type: "paragraph",
    text: "Across race distances, each step up tends to cost about five percent of pace. If your 10K is much slower than about 95 percent of your 5K pace, endurance is your limiter. If your 5K is much slower than about 112 percent of your marathon pace, speed is. Treat this as a curiosity that points at a training emphasis, not as a rule your paces have to obey.",
  },
  {
    type: "callout",
    variant: "takeaway",
    title: "Your estimate does not need to be perfect",
    text: "It is a typical-day number, and plans are built with flex in them: pace ranges rather than single values, and rep options rather than one mandatory set. A slightly wrong estimate never ruins a workout. A wildly optimistic one does, which is the only reason to err conservative.",
  },
];

const FUELING_AND_HYDRATION: ContentBlock[] = [
  {
    type: "paragraph",
    text: "Fueling is a trainable part of marathoning, not an accessory to it. Most of what follows is about finding what works for you specifically, because the single biggest variable is your own stomach.",
  },

  { type: "heading", text: "Why fuel at all" },
  {
    type: "paragraph",
    text: "Your muscles run mostly on stored carbohydrate, and you have a finite amount of it. Gels and drinks add a second fuel source on top of those stores rather than replacing them, which is worth a meaningful amount over the second half of a marathon. Carbohydrate is also the more efficient fuel: burning it yields more energy per unit of oxygen than burning fat does, so being fueled makes you measurably more economical, not just less tired.",
  },

  { type: "heading", text: "The rate, and the two-sugar reason for it" },
  {
    type: "paragraph",
    text: "Aim for at least 60 grams of carbohydrate per hour from a glucose and fructose mix. The mix matters because your gut absorbs the two sugars through different pathways, so splitting the load across both lets you take in more than either alone would allow. Gels, chews and sports drinks all deliver this equally well, so the only real selection criterion is what your stomach likes.",
  },
  {
    type: "heading",
    text: "Finding your own rate",
    level: 3,
  },
  {
    type: "list",
    items: [
      "Start at 30 to 45 grams per hour on easy long runs, purely to find a source you tolerate.",
      "Move to 50 to 60 grams per hour in marathon-specific workouts.",
      "If that sits well, try 70 to 90.",
      "If stomach problems appear, back the rate off or switch forms before giving up on the rate entirely.",
      "Race at the highest rate that still leaves you feeling strong, which is not necessarily the highest rate you can physically swallow.",
    ],
  },
  {
    type: "callout",
    variant: "tip",
    title: "Your gut trains like a muscle",
    text: "Practice your intended race rate in workouts rather than discovering it on race day. Taking 60 to 90 grams per hour in training, if you tolerate it, is how you build the tolerance you want to have available.",
  },

  { type: "heading", text: "Carb loading without the feast" },
  {
    type: "paragraph",
    text: "A moderate protocol of 8 to 10 grams per kilogram of body weight per day for 24 to 36 hours before the race covers most runners. Practice it before a big workout first so race week is not the first time you find out how it feels. A more aggressive 10 to 12 grams per kilogram over 36 to 48 hours is worth considering only if you fade badly late in marathons or cannot tolerate high in-race fueling rates.",
  },
  {
    type: "paragraph",
    text: "Race morning, take 1 to 4 grams per kilogram of carbohydrate within three hours of the start. That is enough to top off liver glycogen and to prompt the bathroom stop you want before the gun, and it is deliberately not a feast.",
  },

  { type: "heading", text: "Caffeine" },
  {
    type: "paragraph",
    text: "Roughly 3 milligrams per kilogram, which is about 200 milligrams for many runners, peaks around 60 minutes after you take it. A practical approach is a dose 45 to 60 minutes before the start and another 30 to 60 minutes into the race. Test it in training, since jitters or nausea mean you want a smaller dose or none at all. There is no need to quit coffee the week beforehand, and it is worth skipping caffeine in the final hour before the start so the timing lands where you intended.",
  },

  { type: "heading", text: "Hydration, and the thing people get backwards" },
  {
    type: "paragraph",
    text: "Drink to thirst. Small sips as you want them. Your thirst does a good job of regulating the concentration of your blood, and losing some water weight over a marathon is harmless. The real risk runs the other way: forcing fluids on a schedule your body did not ask for is the dangerous end of this, not finishing a few pounds lighter.",
  },
  {
    type: "callout",
    variant: "mistake",
    title: "Electrolyte tablets do not prevent cramps",
    text: "Your gels and sports drinks already contain electrolytes. Extra tablets and extra salt will not stop cramps and will not make you faster. Cramps come from neuromuscular fatigue and muscle damage, which means the real prevention is resilience training, and the real mid-race management is easing the pace and stretching the cramping muscle.",
  },

  { type: "heading", text: "When your stomach rebels" },
  {
    type: "paragraph",
    text: "Work down this list in order rather than abandoning fueling altogether.",
  },
  {
    type: "list",
    items: [
      "Moderate the rate first: around 15 grams every 20 to 30 minutes rather than larger, less frequent doses.",
      "Keep training your gut at the rate you can currently tolerate.",
      "Eat 30 to 60 minutes before running so the bathroom stop happens before the run rather than during it.",
      "Go low-fiber for 36 to 48 hours before the race.",
      "If that is not enough, try low-FODMAP for 24 to 48 hours as the next step. Practice both of these before race week rather than experimenting during it.",
      "If nausea is the main symptom, look at race-day anxiety and your caffeine dose before looking at the fuel.",
      "Dial the rate back in heat, which independently slows gastric emptying.",
      "Persistent problems that do not respond to any of this are worth a doctor's visit, since celiac disease, lactose intolerance, irritable bowel syndrome and Crohn's disease can all present this way.",
    ],
  },
];

// The glossary rendered as a browsable page, grouped by the phase each
// session belongs to. Built from WORKOUT_GLOSSARY rather than hand-written
// prose so a new or edited entry shows up here and on the workout detail
// page from one edit, never two.
function buildWorkoutTypesContent(): ContentBlock[] {
  const blocks: ContentBlock[] = [
    {
      type: "paragraph",
      text: "Every kind of session you get assigned, what it is for, and how to run it well. Each entry also names which components of marathon fitness it builds, so you can see where a given workout fits into the whole system.",
    },
  ];

  for (const phase of GLOSSARY_PHASE_ORDER) {
    const entries = WORKOUT_GLOSSARY.filter((entry) => entry.phase === phase);
    if (entries.length === 0) continue;
    blocks.push({ type: "heading", text: GLOSSARY_PHASE_LABELS[phase] });
    for (const entry of entries) {
      blocks.push({ type: "heading", text: entry.name, level: 3 });
      blocks.push({ type: "paragraph", text: entry.whatItIs });
      blocks.push({ type: "paragraph", text: entry.howToExecute });
      blocks.push({
        type: "callout",
        variant: entry.coachAssignOnly ? "advanced" : "takeaway",
        title: entry.coachAssignOnly ? "What it builds, and who it is for" : "What it builds",
        text: entry.coachAssignOnly
          ? `${entry.whatItBuilds} Your coach assigns this deliberately. It is not a session to add on your own initiative.`
          : entry.whatItBuilds,
        collapsed: false,
      });
    }
  }

  return blocks;
}

export const ATHLETE_GUIDES: AthleteGuide[] = [
  {
    slug: "how-training-works",
    title: "How training works",
    eyebrow: "Foundations",
    summary: "The four components of marathon fitness, the three intensity domains, and why your training is ordered the way it is.",
    content: HOW_TRAINING_WORKS,
  },
  {
    slug: "pacing-and-effort",
    title: "Pacing and effort",
    eyebrow: "Execution",
    summary: "What the workout percentages are measured against, what to do when pace and effort disagree, and how precise any of it needs to be.",
    content: PACING_AND_EFFORT,
  },
  {
    slug: "fueling-and-hydration",
    title: "Fueling and hydration",
    eyebrow: "Execution",
    summary: "Carbohydrate rates, gut training, carb loading, caffeine, hydration, and what to do when your stomach rebels.",
    content: FUELING_AND_HYDRATION,
  },
  {
    slug: "workout-types",
    title: "Workout types",
    eyebrow: "Reference",
    summary: "Every kind of session you get assigned, what it targets, and how to execute it.",
    content: buildWorkoutTypesContent(),
  },
];

export function getAthleteGuide(slug: string): AthleteGuide | null {
  return ATHLETE_GUIDES.find((guide) => guide.slug === slug) ?? null;
}
