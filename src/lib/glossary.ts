// A curated, hand-maintained list of recurring concepts that have a real,
// dedicated home elsewhere on the site. Deliberately NOT heuristic/NLP --
// only terms listed here ever get auto-linked, and each points at a page or
// anchor that genuinely explains the term, not just mentions it in passing.
//
// To add one: find the section/heading that actually defines the concept,
// confirm its anchor id (headingId() of the exact heading text, see
// src/lib/heading-id.ts), and add an entry. aliases are the literal strings
// to match in prose (case-insensitive); the original casing found in the
// text is preserved when rendering the link.
export type GlossaryTerm = {
  id: string;
  aliases: string[];
  href: string;
};

export const glossaryTerms: GlossaryTerm[] = [
  {
    id: "lactate-threshold",
    aliases: ["lactate threshold heart rate", "lactate threshold", "anaerobic threshold"],
    href: "/workout-library#five-training-zones-anchored-to-one-number",
  },
  {
    id: "muscle-tone",
    aliases: ["muscle tone"],
    href: "/exercise-physiology#muscle-tone-elasticity-and-stiffness-defined",
  },
  {
    id: "double-threshold",
    // Consolidated with the former separate "norwegian-threshold-training"
    // term (Phase 2D) -- both resolved to the same coach page, and keeping
    // them as two term ids meant two separate links could fire on the same
    // page (even the same sentence) for what's really one destination.
    aliases: ["Norwegian Threshold Training", "double threshold training", "double threshold"],
    href: "/coaching-library/norwegian-system",
  },
  {
    id: "cardiac-drift",
    aliases: ["cardiac drift"],
    href: "/data-and-analytics#cardiac-drift-what-a-rising-heart-rate-at-a-held-pace-actually-means",
  },
  {
    id: "vo2-max",
    aliases: ["VO2 max", "VO2max", "VO₂ max", "VO₂max"],
    href: "/exercise-physiology",
  },
  {
    id: "running-economy",
    aliases: ["running economy"],
    href: "/research-library#don-t-fix-your-form-run-more-and-let-it-fix-itself",
  },
  {
    id: "glycogen-depletion",
    aliases: ["glycogen depletion", "glycogen depleted"],
    href: "/research-library#why-long-slow-runs-fatigue-you-in-a-way-sprints-don-t",
  },
  {
    id: "glycogen",
    aliases: ["glycogen"],
    href: "/nutrition-and-fueling#how-much-carbohydrate-a-session-actually-needs",
  },
  {
    id: "periodization",
    aliases: ["periodization", "periodized"],
    href: "/coaching-library#the-pyramid",
  },
  {
    id: "red-s",
    aliases: ["RED-S", "Relative Energy Deficiency in Sport"],
    href: "/recovery#relative-energy-deficiency-in-sport-red-s",
  },
  {
    id: "super-compensation",
    // Was "/training-philosophy#why-response-regulated-recovery-actually-works"
    // -- that heading no longer exists (training-philosophy is now a bespoke
    // component, not sections.ts content). Repointed (Phase 2D) to the real
    // heading that actually explains supercompensation: The Adaptation
    // Curve on The Aerobic Base, directly above the paragraph containing
    // this exact term ("That's super-compensation, and it's the whole
    // mechanism behind why training works").
    aliases: ["super-compensation", "supercompensation"],
    href: "/the-aerobic-base#the-adaptation-curve",
  },
  {
    id: "polarized-training",
    // Consolidated with the former separate "eighty-twenty" term (Phase 3)
    // -- that one pointed at "/coaching-library#polarized-training-80-20-
    // the-one-i-lean-on-most", a dead anchor traced back to a personal "How
    // I Learn" blurb on about-page.tsx ("The one I lean on most: roughly
    // 80% of training time easy, 20% genuinely hard...") that was never a
    // real heading. "80/20" is the same concept this term already
    // correctly explains -- Research Library's own numbers ("roughly 90%
    // of training volume... at low intensity," "roughly 65% and 90% of
    // VO2max") are the research-grade version of the same split -- so
    // rather than invent a new destination, the working synonym now
    // resolves through the entry that already had a real one.
    aliases: ["polarized training", "80/20 Rule", "80/20 rule"],
    href: "/research-library#polarized-training-what-elite-endurance-athletes-actually-do",
  },
  {
    id: "carb-loading",
    aliases: ["carb loading", "carb-loading"],
    href: "/nutrition-and-fueling#carb-loading-before-a-long-race",
  },
  {
    id: "talk-test",
    aliases: ["talk test"],
    href: "/data-and-analytics#two-diy-ways-to-find-your-threshold",
  },
  {
    id: "gut-training",
    aliases: ["gut training"],
    href: "/nutrition-and-fueling#gut-training-is-a-real-trainable-skill",
  },
  {
    id: "gi-distress",
    aliases: ["GI distress", "gastrointestinal distress"],
    href: "/nutrition-and-fueling#gut-training-is-a-real-trainable-skill",
  },
  {
    id: "carbohydrate-oxidation",
    aliases: ["exogenous carbohydrate oxidation", "carbohydrate oxidation", "exogenous carbohydrate"],
    href: "/nutrition-and-fueling#why-fueling-mixes-glucose-and-fructose",
  },
  {
    id: "bonking",
    aliases: ["bonking", "bonk"],
    href: "/the-aerobic-base#training-the-fat-burning-ceiling",
  },
  {
    id: "central-governor",
    aliases: ["central governor"],
    href: "/exercise-physiology#what-actually-limits-endurance-two-competing-models",
  },
  {
    id: "psychobiological-model",
    aliases: ["psychobiological model"],
    href: "/exercise-physiology#what-actually-limits-endurance-two-competing-models",
  },
  {
    id: "perceived-effort",
    aliases: ["perceived effort"],
    href: "/exercise-physiology#what-actually-limits-endurance-two-competing-models",
  },
  {
    id: "perceived-exertion",
    aliases: ["rate of perceived exertion", "perceived exertion", "RPE"],
    href: "/research-library#rating-of-perceived-exertion-the-borg-scale",
  },
  {
    id: "il-6",
    aliases: ["interleukin-6", "IL-6"],
    href: "/research-library#why-long-slow-runs-fatigue-you-in-a-way-sprints-don-t",
  },
  {
    id: "cardiac-lag",
    aliases: ["cardiac lag"],
    href: "/data-and-analytics#why-heart-rate-misleads-on-short-hard-efforts",
  },
  {
    id: "vdot",
    aliases: ["VDOT"],
    href: "/coaching-library/daniels",
  },
  {
    id: "steady-state",
    aliases: ["Steady State"],
    href: "/exercise-physiology#steady-state-and-oxygen-debt",
  },
  {
    id: "oxygen-debt",
    aliases: ["oxygen debt"],
    href: "/exercise-physiology#steady-state-and-oxygen-debt",
  },
  {
    id: "capillary-density",
    aliases: ["capillary density", "capillary beds", "capillaries"],
    href: "/the-aerobic-base",
  },
  {
    id: "mitochondria",
    aliases: ["mitochondria", "mitochondrial"],
    href: "/the-aerobic-base",
  },
  {
    id: "flow-state",
    aliases: ["flow state"],
    href: "/performing-under-pressure#the-chemistry-of-flow",
  },
  {
    id: "curse-of-talent",
    aliases: ["curse of talent"],
    href: "/goal-setting#where-your-beliefs-actually-came-from",
  },
  {
    id: "curse-of-perfection",
    aliases: ["curse of perfection"],
    href: "/performing-under-pressure#a-bad-day-is-only-a-day",
  },
  {
    id: "hyponatremia",
    aliases: ["hyponatremia"],
    href: "/nutrition-and-fueling#sodium-is-the-electrolyte-that-actually-matters",
  },
  {
    id: "size-principle",
    aliases: ["size principle"],
    href: "/exercise-physiology#the-size-principle-why-easy-running-never-touches-your-fastest-fibers",
  },
  {
    id: "alactic",
    aliases: ["alactic"],
    href: "/exercise-physiology#three-fiber-types-three-different-jobs",
  },
  {
    id: "glycolytic",
    aliases: ["glycolytic"],
    href: "/exercise-physiology#three-fiber-types-three-different-jobs",
  },
  {
    id: "voluntary-activation",
    aliases: ["voluntary activation"],
    href: "/exercise-physiology#central-vs-peripheral-fatigue-when-the-muscle-itself-gives-out",
  },
  {
    id: "critical-power",
    aliases: ["critical power", "critical velocity"],
    href: "/data-and-analytics#critical-power-a-sharper-ceiling-than-lactate-threshold",
  },
  {
    id: "pain-tolerance",
    aliases: ["pain tolerance", "Tolerance for Suffering Is a Trainable Skill"],
    href: "/sports-psychology#tolerance-for-suffering-is-a-trainable-skill",
  },
  {
    id: "belief-effects",
    aliases: ["belief effects"],
    href: "/sports-psychology#belief-effects-the-real-science-of-placebo-in-sport",
  },
  {
    id: "plasma-osmolality",
    aliases: ["plasma osmolality"],
    href: "/nutrition-and-fueling#what-the-body-actually-monitors-isn-t-water-volume",
  },
  // Phase 4 (content coverage expansion) -- concepts added to give
  // marathon-training, how-to-start-running, training-philosophy, and
  // workout-library a real, resolvable concept anchor for the first time,
  // grounded in each page's own existing prose (see each topic's Concept
  // in taxonomy.ts for why this specific heading, not a generic term).
  {
    id: "medium-long-run",
    // Not "medium-long run" itself -- that generic phrase also appears in
    // 5k-training's and for-coaches' own, unrelated weekly-structure prose
    // (verified by direct grep), which would auto-link an unrelated
    // mention on a different page straight to this one. The week's-most-
    // skipped-session framing is this page's own distinctive phrase and
    // appears nowhere else in sections.ts.
    aliases: ["the week's most skipped session"],
    href: "/marathon-training#the-medium-long-run-the-week-s-most-skipped-session",
  },
  {
    id: "marathon-pace-paradox",
    // Same reasoning as medium-long-run above: bare "marathon pace" is a
    // generic phrase used in at least 3 other, unrelated sections.ts
    // contexts (data-and-analytics, nutrition-and-fueling, workout-library's
    // workout catalog) -- verified by direct grep. This heading's own
    // distinctive phrasing doesn't collide anywhere else.
    aliases: ["doesn't belong in most of your training"],
    href: "/marathon-training#why-marathon-pace-doesn-t-belong-in-most-of-your-training",
  },
  {
    id: "buildup-cycle-length",
    aliases: ["marathon buildup"],
    href: "/marathon-training#how-long-a-buildup-should-actually-be",
  },
  {
    id: "beginner-progression",
    aliases: ["beginner progression"],
    href: "/how-to-start-running#the-beginner-progression-stage-by-stage",
  },
  {
    id: "training-heart-rate-formula",
    aliases: ["training heart rate"],
    href: "/how-to-start-running#finding-your-training-heart-rate",
  },
  {
    id: "individualization",
    aliases: ["individualization"],
    href: "/training-philosophy#individualization-matters",
  },
  {
    id: "consistency-beats-perfection",
    aliases: ["consistency beats perfection"],
    href: "/training-philosophy#consistency-beats-perfection",
  },
  {
    id: "advanced-periodization",
    aliases: ["advanced periodization", "clustering quality work"],
    href: "/workout-library#advanced-periodization-clustering-quality-work-instead-of-spreading-it-out",
  },
  {
    id: "matching-interval-pace",
    aliases: ["matching interval pace"],
    href: "/workout-library#matching-interval-pace-to-real-fitness-not-aspiration",
  },
  // Whole-page references -- lets a bare mention of a page's title anywhere
  // in prose (as opposed to a specific heading on it) still link somewhere,
  // without needing a dedicated entry for every passing "see Sports
  // Psychology" or "see Training Philosophy" style reference.
  {
    id: "sports-psychology-page",
    aliases: ["Sports Psychology"],
    href: "/sports-psychology",
  },
  {
    id: "training-philosophy-page",
    aliases: ["Training Philosophy"],
    href: "/training-philosophy",
  },
  {
    id: "consistency-and-daily-practice-page",
    aliases: ["Consistency & Daily Practice"],
    href: "/daily-practice",
  },
  {
    id: "for-coaches-page",
    aliases: ["For Coaches"],
    href: "/for-coaches",
  },
  {
    id: "training-plans-page",
    aliases: ["Training Plans"],
    href: "/training-plans",
  },
  {
    id: "mental-attitude-during-the-race",
    aliases: ["Mental Attitude During the Race"],
    href: "/sports-psychology#mental-attitude-during-the-race",
  },
  {
    id: "racing-the-last-25",
    aliases: ["Racing the Last 25%"],
    href: "/marathon-training#racing-the-last-25",
  },
  {
    id: "the-adaptation-curve",
    aliases: ["The Adaptation Curve"],
    href: "/the-aerobic-base#the-adaptation-curve",
  },
  {
    id: "letting-go-of-the-outcome",
    aliases: ["Letting Go of the Outcome"],
    href: "/sports-psychology#letting-go-of-the-outcome",
  },
  {
    id: "the-wheel",
    aliases: ["The Wheel"],
    href: "/sports-psychology#the-wheel",
  },
  {
    id: "the-star-of-the-team-is-the-team",
    aliases: ["The Star of the Team Is the Team"],
    href: "/for-coaches#the-star-of-the-team-is-the-team",
  },
  {
    id: "consistency-over-emotion",
    aliases: ["Consistency Over Emotion"],
    href: "/for-coaches#consistency-over-emotion",
  },
  {
    id: "dont-let-the-scoreboard-set-your-standard",
    aliases: ["Don't Let the Scoreboard Set Your Standard"],
    href: "/for-coaches#don-t-let-the-scoreboard-set-your-standard",
  },
  {
    id: "adversity-is-not-an-excuse",
    aliases: ["Adversity Is Not an Excuse"],
    href: "/for-coaches#adversity-is-not-an-excuse",
  },
  {
    id: "the-practice-plan-is-the-product",
    aliases: ["The Practice Plan Is the Product"],
    href: "/for-coaches#the-practice-plan-is-the-product",
  },
  {
    id: "what-winning-actually-means",
    aliases: ["What Winning Actually Means"],
    href: "/performing-under-pressure#what-winning-actually-means",
  },
  {
    id: "no-such-thing-as-110-percent",
    aliases: ["There's No Such Thing as 110 Percent"],
    href: "/performing-under-pressure#there-s-no-such-thing-as-110-percent",
  },
  {
    id: "how-much-of-your-practice-is-actually-practice",
    aliases: ["How Much of Your Practice Is Actually Practice"],
    href: "/performing-under-pressure#how-much-of-your-practice-is-actually-practice",
  },
  {
    id: "where-your-beliefs-actually-came-from",
    aliases: ["Where Your Beliefs Actually Came From"],
    href: "/goal-setting#where-your-beliefs-actually-came-from",
  },
  // Coach names -- links the first genuine narrative-prose mention of each
  // coach (not bibliography/citation-list entries, which cite a book title
  // and author, not the coach as a subject) to their real Coaching Library
  // profile. Only coaches with a real prose mention get an entry here; see
  // Phase 2B notes for why Pete Pfitzinger and "Norwegian System" (the
  // exact phrase) don't have one.
  {
    id: "arthur-lydiard",
    aliases: ["Arthur Lydiard"],
    href: "/coaching-library/lydiard",
  },
  {
    id: "tom-schwartz",
    aliases: ["Tom Schwartz"],
    href: "/coaching-library/tom-schwartz",
  },
  {
    id: "renato-canova",
    aliases: ["Renato Canova: Marathon-Specific Density", "Renato Canova"],
    href: "/coaching-library/canova",
  },
  {
    id: "joe-vigil",
    // Consolidated with the former separate "altitude-training" term
    // (Phase 2D) -- same reasoning as the double-threshold consolidation
    // above: both resolved to /coaching-library/vigil, so both could fire
    // in the same paragraph for the same destination.
    aliases: ["Joe Vigil: Altitude, Biomechanics, and the Whole Athlete", "altitude training", "Joe Vigil"],
    href: "/coaching-library/vigil",
  },
  // Athlete names -- same "genuine narrative prose only" rule as the coach
  // names above. Deena Kastor and Moses Mosop both have real Athlete
  // Library pages too, but the only place either is named in sections.ts
  // is a UI topics tag list (not linkifyable prose), so neither gets an
  // entry here (Phase 2E re-verified this).
  {
    id: "peter-snell",
    aliases: ["Peter Snell"],
    href: "/athlete-library/peter-snell",
  },
  {
    id: "jakob-ingebrigtsen",
    // The only sections.ts prose mention is plural ("the Norwegian system
    // that produced the Ingebrigtsens and the Blummenfelt/Iden triathlon
    // program," workout-library) -- genuinely about the family's results
    // under that system, not a passing mention, and Jakob is the one
    // brother with a real Athlete Library page (his own philosophyNarrative
    // opens "the clearest real-world example of the Norwegian System
    // actually applied," and his signatureTraining already links back to
    // this exact workout-library heading).
    aliases: ["Ingebrigtsens"],
    href: "/athlete-library/jakob-ingebrigtsen",
  },
];
