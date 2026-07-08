export type Category = {
  slug: string;
  title: string;
  mission: string;
};

export const categories: Category[] = [
  {
    slug: "foundations",
    title: "Foundations",
    mission:
      "Who this is for, and the core beliefs that shape everything else here.",
  },
  {
    slug: "the-science",
    title: "The Science",
    mission:
      "First-principles physiology, research, and the data behind good training.",
  },
  {
    slug: "coaching-and-training",
    title: "Coaching & Training",
    mission:
      "Structured systems, workouts, and plans drawn from proven coaching methods.",
  },
  {
    slug: "mind-and-recovery",
    title: "Mind & Recovery",
    mission:
      "The mental game and the recovery practices that sustain long-term progress.",
  },
  {
    slug: "writing-and-resources",
    title: "Writing & Resources",
    mission: "Long-form essays and curated references for continued learning.",
  },
  {
    slug: "tools",
    title: "Tools",
    mission:
      "Interactive calculators for training, pacing, and race-day conditions.",
  },
];

export type ContentBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; text: string; attribution?: string };

export type Section = {
  slug: string;
  title: string;
  mission: string;
  topics: string[];
  category: string;
  content?: ContentBlock[];
};

export const sections: Section[] = [
  {
    slug: "training-philosophy",
    title: "Training Philosophy",
    mission:
      "Core beliefs about endurance development through patience, consistency, and first-principles thinking.",
    topics: [
      "Individualization",
      "Long-term development",
      "Decision frameworks",
    ],
    category: "foundations",
    content: [
      { type: "heading", text: "Five Principles, Not a Formula" },
      {
        type: "paragraph",
        text: "Good training isn't a set of numbers copy-pasted from one athlete to the next — it's principles applied to a specific person. Five matter most:",
      },
      {
        type: "list",
        items: [
          "Miles in the bank — build the aerobic base before anything else, since every other system trains on top of it.",
          "Feeling-based effort — train by what an effort actually costs your body, not just by the watch.",
          "Response-regulated recovery — let how you're adapting dictate the next session, not a fixed schedule.",
          "Sequential development — speed sits on top of intervals, which sits on top of strength, which sits on top of endurance.",
          "Correct timing — build the whole plan backward from the goal race, not forward from today.",
        ],
      },
      { type: "heading", text: "Breath, Blood, and Brain" },
      {
        type: "paragraph",
        text: "I coach three things: the breath, the blood, and the brain — not the muscles. Most coaching in the U.S. trains until the muscles fail. I'd rather build the aerobic engine (breath, blood) and the mental game (brain) than chase muscular fatigue for its own sake. That takes longer to show results — usually 7 to 10 years for it to fully show up in a runner — which is exactly why patience is part of the philosophy, not separate from it.",
      },
      { type: "heading", text: "Footwear and Technique Aren't an Afterthought" },
      {
        type: "paragraph",
        text: "Lydiard treated running form as a skill to be taught, not something everyone arrives with. Even his most gifted athletes worked on technique — running tall, relaxed arms, a quick leg turnover — before layering on volume. He wanted shoes that interfered with the foot as little as possible: flexible enough to function \"like a second layer of skin,\" with no built-up heel, because an elevated heel creates instability a flat sole doesn't. He was skeptical of orthotics (\"the orthotics are for the shoes, not the feet\") and dead set against running with hand weights, since anything that adds tension undercuts the relaxation that makes a stride efficient. None of this is really about barefoot running as a trend — minimalist footwear and hard-surface training predate that label by decades. It's a belief that the foot should be left to do its job, and that good form has to be practiced deliberately, not assumed.",
      },
      { type: "heading", text: "Form Cues Lydiard Actually Used" },
      {
        type: "paragraph",
        text: "Beyond the general principle, Lydiard's cues were concrete. \"Try to make yourself six inches taller when you're running\" was his shorthand for the tall, upright posture he wanted, since a lot of runners never fully straighten the driving leg and lose power on every stride as a result. He'd check footfall by having athletes run across sand or a dewy lawn — a straight, efficient stride leaves footprints that form almost a single line, not a wide, wandering one. And his combination drill for both leg speed and posture at once was three cues layered together while running fast: high knees, hard ankle drive, and running tall — practiced separately first, then combined.",
      },
    ],
  },
  {
    slug: "the-philosophy-of-running",
    title: "The Philosophy of Running",
    mission:
      "Long-form essays on meaning, mastery, suffering, purpose, and character in the running life.",
    topics: ["Mastery", "Identity", "Purpose"],
    category: "foundations",
    content: [
      { type: "heading", text: "One More Step" },
      {
        type: "paragraph",
        text: "Cliff Cushman was a 400m hurdler who won Olympic silver in Rome in 1960 and spent the next four years chasing gold. At the 1964 Olympic Trials, he fell on the fifth hurdle and missed the team. Instead of retreating from it, he wrote an open letter to his hometown newspaper, addressed to the young people who might have watched him fall on television. He didn't want their sympathy — he wanted them to set their own goals and pursue them with the same honesty he'd brought to running: \"get up, pick the cinders out of your wounds, and take one more step.\" Cushman was declared missing in action over Vietnam two years later, and officially declared dead in 1975. The letter outlived him, and it's still shared for the same reason he wrote it — not because falling doesn't cost you something, but because what you do immediately after is the only part still in your control.",
      },
      { type: "heading", text: "How Jogging Became a Worldwide Movement" },
      {
        type: "paragraph",
        text: "In 1961, Arthur Lydiard opened his training methods to a group of out-of-shape, middle-aged Aucklanders — several of them past coronary patients — building an ordinary jogging club on the same aerobic principles he'd used to develop Olympic milers. Within a couple of years, some of those same men who could barely manage 30 yards on their first outing were finishing marathons. In 1962, University of Oregon coach Bill Bowerman ran with Lydiard's Auckland group, got dropped by a 75-year-old member, and went home to found the first American jogging program — his first public session drew 2,000 people. In 1965, East Germany's Leipzig Sports Medicine Institute launched a national television program called \"Run for Your Life,\" borrowed directly from the title of the book Lydiard had written with journalist Garth Gilmour. What began as one coach trying to keep a handful of unhealthy Auckland businessmen out of the hospital became, within a decade, the reason \"jogging\" is a word at all.",
      },
    ],
  },
  {
    slug: "exercise-physiology",
    title: "Exercise Physiology",
    mission:
      "First-principles explanations of VO₂ max, threshold, fatigue, adaptation, and biomechanics.",
    topics: ["Energy systems", "Muscle fibers", "Recovery biology"],
    category: "the-science",
    content: [
      { type: "heading", text: "Steady State and Oxygen Debt" },
      {
        type: "paragraph",
        text: "Every runner has a ceiling on how much oxygen they can take in, transport, and use per minute — Lydiard called this the Steady State. Run within it and you're aerobic; push past it and the body has to cover the shortfall anaerobically, building up an oxygen debt alongside lactic acid. That debt doesn't grow in a straight line — it roughly doubles, squares, then cubes as effort increases, which is why a small increase in pace can cost a disproportionate amount of endurance. A trained runner can tolerate somewhere around 15–18 liters of total oxygen debt before neuromuscular breakdown sets in. The practical upshot: raising your Steady State ceiling through aerobic work is what lets a previously hard pace become comfortably sustainable.",
      },
      { type: "heading", text: "Fast-Twitch, Slow-Twitch, and the Acid/Alkali Balance" },
      {
        type: "paragraph",
        text: "Slow-twitch (Type I) fibers run mostly on fat and thrive in a mildly alkaline system; fast-twitch Type IIA fibers lean on carbohydrate and generate more acid under load. The body's energy and hormonal systems work best in a narrow, mildly alkaline range (roughly pH 7.365–7.40), and high-intensity training pushes that balance toward acidic. That's the logic behind two ideas that show up throughout Lydiard-style programs: the harder your main sessions get, the more low-intensity recovery work you need to buffer it, and a serious volume of easy aerobic running can keep happening right up until a peak — because it doesn't fight against the acid load the way more hard sessions would.",
      },
      { type: "heading", text: "Why Anaerobic Running Is 19 Times Less Efficient" },
      {
        type: "paragraph",
        text: "One molecule of glucose broken down aerobically nets 36 molecules of ATP, the body's usable energy currency; broken down anaerobically, that same molecule nets only 2. That roughly 19-to-1 gap is the biochemical reason a large volume of hard, oxygen-starved running burns through fuel and produces fatigue so much faster than the equivalent time spent working aerobically (Morehouse & Miller, The Physiology of Exercise).",
      },
      { type: "heading", text: "Oxygen Debt: The Original Estimate vs. the Corrected One" },
      {
        type: "paragraph",
        text: "Arthur Lydiard's training writing put the ceiling on tolerable oxygen debt at 15–18 liters, the physiology understanding of his era. Exercise physiologist Peter Snell — Lydiard's own Olympic 800m/1500m champion, later a career research scientist — revisited the number decades later and put the real ceiling closer to 4 liters. Worked through with real numbers: a 70kg runner covering 5,000m in 16 minutes needs 4.31 liters of oxygen; at a Steady State of 3.5 L/min, he's accumulating debt at 0.81 L/min and can hold that pace for only about 5 minutes before hitting the ceiling. Raise that Steady State to 4.06 L/min through aerobic training, and the debt rate drops to 0.25 L/min — enough to sustain the same pace for the full 16 minutes. The specific numbers changed; the underlying logic didn't: a higher aerobic ceiling is what lets a given pace be held longer, not a higher tolerance for suffering through the debt.",
      },
      { type: "heading", text: "The Crossover Point" },
      {
        type: "paragraph",
        text: "At low exercise intensities, fat supplies most of the fuel; as intensity climbs, the mix shifts toward carbohydrate, crossing over to carb-dominant somewhere around 60–65% of VO₂max for most trained athletes (Achten et al., Medicine & Science in Sports & Exercise, 2002). Insulin is one of the biggest levers on that crossover: elevated blood insulin actively suppresses lipolysis, the release of fat for fuel, which is why fat-burning capacity is consistently higher in a fasted or low-insulin state than right after a high-carbohydrate meal.",
      },
      { type: "heading", text: "What a Diet Does to Peak Fat-Burning Rate" },
      {
        type: "paragraph",
        text: "The FASTER study tested elite ultra-endurance runners split between habitual high-carbohydrate and long-term fat-adapted (\"keto-adapted\") diets, all similarly trained. Under identical treadmill protocol, the fat-adapted group hit a peak fat oxidation rate of 1.54 g/min — more than double the 0.67 g/min recorded in the high-carbohydrate group. Training status alone didn't explain the gap; the metabolic state built by chronic diet did (Volek, Phinney, et al., \"Metabolic characteristics of keto-adapted ultra-endurance runners,\" Metabolism, 2016).",
      },
    ],
  },
  {
    slug: "the-aerobic-base",
    title: "The Aerobic Base",
    mission:
      "Why aerobic fitness is the foundation of endurance performance and long-term progression.",
    topics: ["Mileage progression", "Easy running", "Durability"],
    category: "the-science",
    content: [
      { type: "heading", text: "The Adaptation Curve" },
      {
        type: "paragraph",
        text: "Every workout is a stress that temporarily makes you less fit, not more — fatigue shows up first, and fitness only rebounds during the recovery that follows, often landing slightly above where you started. That's super-compensation, and it's the whole mechanism behind why training works. Push too hard or rest too little and the curve never gets the chance to rebound: training success = moderate stress + adequate rest.",
      },
      { type: "heading", text: "Why Miles in the Bank Actually Works" },
      {
        type: "paragraph",
        text: "Oxygen acts as a catalyst for the aerobic system; the anaerobic system, by contrast, is muscles with molecules sitting around waiting for oxygen that hasn't arrived. Building the aerobic engine means growing more capillaries into working muscle, adding mitochondria, and developing the enzymatic pathways that convert oxygen to usable energy — and none of it happens on one run. The body's development shifts at defined points during sustained aerobic effort, roughly 20, 30, 55, 90, 120, 150, and 180 minutes in, which is part of why long, easy running does something shorter running can't replicate. Build the capillaries, then rest — the growth happens during recovery, not the run itself.",
      },
      { type: "heading", text: "60,000 Miles of Plumbing" },
      {
        type: "paragraph",
        text: "The capillary network reaching into working muscle spans an estimated 60,000 miles in an adult body — the fine-scale delivery system that gets oxygen-rich blood and glucose to muscle cells and clears the waste products back out. Easy aerobic running is what builds it out: steady, low-intensity volume is the primary stimulus for new capillary growth into the muscles that actually need it, which is a large part of why \"just go slow and build the base\" isn't a cop-out — it's targeting a specific adaptation that hard running doesn't reach nearly as efficiently.",
      },
      { type: "heading", text: "What the Capillary Difference Actually Looks Like" },
      {
        type: "paragraph",
        text: "One comparative study Lydiard cites puts a real number on the capillary-building payoff: Swedish runners averaged four to five capillaries per muscle cell in their quadriceps, while Kenyan runners averaged seven to eight — nearly double the delivery network in the exact muscles doing the work. The Kenyan runners also carried a higher concentration of the enzymes that break down fat, including citrate synthase, the enzyme that supplies muscle with energy aerobically. Genetics plays some role in a gap like that, but both adaptations — capillary density and fat-oxidizing enzyme concentration — are exactly the ones built by sustained aerobic volume, not inherited outright (Lydiard, Running to the Top).",
      },
      { type: "heading", text: "What a Trained Heart Does Differently" },
      {
        type: "paragraph",
        text: "Consistent aerobic training measurably enlarges the heart, increases stroke volume (blood pumped per beat), and lowers resting heart rate — meaning the same amount of blood moves with less effort. The net effect shows up as a rightward shift in the \"deflection point,\" the exercise intensity at which blood acidity starts climbing sharply: after training, a pace that used to tip a runner into that acid spike no longer does, because the same absolute output now costs a smaller fraction of total capacity.",
      },
      { type: "heading", text: "Training the Fat-Burning Ceiling" },
      {
        type: "paragraph",
        text: "An untrained athlete typically can't fuel much past 50% of their capacity on fat alone before switching over to carbohydrate; a well-trained aerobic athlete can push that fat-fueled ceiling to roughly 80% of capacity. That shift matters because carbohydrate stores are finite and fat stores effectively aren't — an athlete who can run harder before tapping into glycogen has a longer runway before bonking becomes a risk, which is exactly the adaptation months of easy aerobic volume are built to produce (Costill, Distance Running, TAFNEWS, 1979).",
      },
    ],
  },
  {
    slug: "research-library",
    title: "Research Library",
    mission:
      "Summaries of books, papers, and historical methods that shaped distance running knowledge.",
    topics: ["Scientific papers", "Coaching texts", "Emerging research"],
    category: "the-science",
    content: [
      {
        type: "heading",
        text: "Polarized Training: What Elite Endurance Athletes Actually Do",
      },
      {
        type: "paragraph",
        text: "Sports scientist Stephen Seiler's research on Olympic gold medalists found their training wasn't evenly split across intensities — it was heavily polarized. A 2014 study of 12 cross-country skiing and biathlon gold medalists found roughly 90% of training volume was done at low intensity, with only a small fraction spent at threshold or above, even in the weeks leading directly into the Games (Tønnessen et al., PLOS ONE, 2014, \"The Road to Gold\"). A published breakdown of Eliud Kipchoge's training log in the 41 days before his 2017 Berlin Marathon world-record attempt showed the same pattern at the individual-session level: 34 of 59 sessions were easy runs, with only a handful of tempo, fartlek, or track sessions mixed in.",
      },
      {
        type: "heading",
        text: "Does the Order of Intensity Progression Matter?",
      },
      {
        type: "paragraph",
        text: "A 2016 study in Medicine & Science in Sports & Exercise (Bossi et al.) tested three ways of sequencing interval training over a 12-week cycle with well-trained cyclists — one group progressed from long, less-intense intervals toward short, harder ones, one did the reverse, and one mixed all three lengths throughout. All three groups improved similarly in power output and VO₂ peak, with no significant difference between approaches. The takeaway isn't that sequencing is irrelevant — it's that consistent, well-recovered interval work matters more than finding one correct order to build it in.",
      },
      { type: "heading", text: "Rating of Perceived Exertion (the Borg Scale)" },
      {
        type: "paragraph",
        text: "Long before GPS watches, physiologist Gunnar Borg proposed in 1960 that how hard an effort feels correlates closely with what a machine would measure — closely enough that perceived effort is, by itself, a reliable training guide. His scale runs from 6 (\"very, very light\") to 20 (\"very, very hard\"), and multiplying the rating by ten gives a rough estimate of heart rate at that effort. It's the scientific basis for pace-by-feel training: if you can hold a conversation, you're in the aerobic range that builds a base.",
      },
      { type: "heading", text: "Two Poles, Not a Straight Line" },
      {
        type: "paragraph",
        text: "The \"polarized\" model isn't training spread evenly across every effort level — it's concentrated at two distinct poles, roughly 65% and 90% of VO₂max, with comparatively little time spent in between. That middle ground sits right around the lactate threshold, and Seiler's research flags it as a kind of gravitational trap: threshold-paced running feels productive and sustainable enough that it's easy to drift there by default, even though it accumulates fatigue faster than low-intensity work while building fitness no faster than genuinely hard intervals (Seiler, \"Training Intensity Distribution for Endurance Performance,\" Vienna 2017).",
      },
      { type: "heading", text: "Polarized Isn't the Only Split With Evidence Behind It" },
      {
        type: "paragraph",
        text: "Polarized training gets most of the attention, but it isn't the only intensity distribution with real research behind it. In at least one study, the best results actually came from runners who did roughly equal amounts of moderate- and high-intensity training rather than sticking to a strict 80/20 split, and there's separate evidence that athletes preparing for longer events get more out of moderate-intensity work specifically than they do out of high-intensity work. The honest read: polarized and 80/20 distributions are strong defaults, not settled science (Fitzgerald, 80/20 Running).",
      },
      { type: "heading", text: "One Skier's Actual Training Log" },
      {
        type: "paragraph",
        text: "Norwegian cross-country skier Ingrid Kristiansen — five world records, world champion — logged the overwhelming majority of her training hours in the lowest intensity zone essentially year-round, including through her competitive season. Zones 3 through 5 combined rarely exceeded a few hours a month, even during her heaviest build phases. It's a useful reality check against the instinct to train harder as a race approaches: her hardest work stayed a small fraction of total volume even while she was setting world records.",
      },
      { type: "heading", text: "How Much Do Elites Actually Train — and Has It Changed?" },
      {
        type: "paragraph",
        text: "Peak annual training volume varies enormously by sport — roughly 550 hours a year for an elite distance runner versus 1,300 for an elite swimmer — largely because running loads the skeleton with body weight on every single stride in a way swimming and rowing don't, so comparing raw hours across sports is close to meaningless. Within a single sport, though, volume has climbed steadily: elite cross-country skiers trained around 450 hours a year in 1965 and roughly 900 hours a year by 2015 — double the volume, at a broadly similar intensity distribution shape (Sandbakk, \"The Evolution of Champion Cross-Country Skier Training,\" 2017).",
      },
      { type: "heading", text: "Same Effort, Very Different Cost" },
      {
        type: "paragraph",
        text: "A series of studies out of Seiler's lab compared interval sessions matched for perceived \"maximal session effort\" but built from different work-bout lengths — four sets of 16, 8, or 4 minutes. All three felt like giving everything, but they weren't physiologically equal: the 4-minute intervals produced nearly triple the blood lactate of the 16-minute version (12.7 vs. 4.7 mmol/L) and pushed 61% of sessions to a peak RPE of 19–20, compared to just 8% for the longer intervals. Counterintuitively, the longer, lower-intensity intervals produced equal or greater fitness gains — more accumulated work at 90% of max heart rate beat less accumulated work nearer to max. The practical read: work-bout duration and total accumulated interval time are the real levers on intensity, and going slightly longer and slightly easier on intervals often buys more fitness for less damage (Seiler & Sylta, International Journal of Sports Physiology and Performance, 2017).",
      },
      {
        type: "heading",
        text: "Why Long, Slow Runs Fatigue You in a Way Sprints Don't",
      },
      {
        type: "paragraph",
        text: "Prolonged low-intensity running releases large amounts of interleukin-6 (IL-6), a cell-signaling compound triggered primarily by glycogen depletion in the working muscles rather than by speed — which is why IL-6 release tracks with duration more than pace. Well-trained runners produce measurably less of it, and the leading theory is that repeated exposure to IL-6 during long runs is itself the trigger for the adaptations that make future long runs feel easier. It's a distinct mechanism from the capillary and mitochondrial growth already covered in The Aerobic Base — a second, separate reason duration matters on its own (Fitzgerald, 80/20 Running).",
      },
      {
        type: "heading",
        text: "The Brain Fatigues Too, and It's Trainable Separately From the Body",
      },
      {
        type: "paragraph",
        text: "Physical aerobic capacity isn't the only thing that limits endurance — a separate, largely independent system matters just as much: the brain's tolerance for the discomfort of sustained effort. Prolonged low-intensity exercise fatigues the insular and temporal lobes (which register the physical sensation of discomfort) and the anterior cingulate cortex (which manages the internal tug-of-war between pushing on and quitting) far more than short, hard efforts do — part of why an easy two-hour run can be more mentally taxing than a hard 20-minute interval session, despite being less physically demanding. The finding gets stranger: sustained mental focus on any sufficiently demanding cognitive task, with no physical exercise at all, measurably builds the same fatigue resistance (Fitzgerald, 80/20 Running).",
      },
      {
        type: "heading",
        text: "Don't Fix Your Form — Run More and Let It Fix Itself",
      },
      {
        type: "paragraph",
        text: "A recurring finding across running-form research: deliberately imposed changes to a runner's natural stride almost always make performance worse, not better. The stride behaves like a self-optimizing system — the brain continuously searches for the movement pattern that produces a given speed with the least muscular effort, and that search runs automatically as training volume accumulates. The practical implication is blunt: the most reliable way to develop a more efficient stride is to run enough that the body has the mileage to optimize against, not to consciously rebuild mechanics (Fitzgerald, 80/20 Running). That's in real tension with Lydiard's insistence on deliberately coached technique (see Training Philosophy) — a genuine unresolved disagreement, not an oversight on either page.",
      },
    ],
  },
  {
    slug: "data-and-analytics",
    title: "Data & Analytics",
    mission:
      "Use heart rate, pace, and training data to support sound coaching judgment.",
    topics: ["Training zones", "Race analytics", "Technology with context"],
    category: "the-science",
    content: [
      { type: "heading", text: "Three Layers of Measurement" },
      {
        type: "paragraph",
        text: "Every training session can be measured three different ways — the external workload (pace, power, distance), the physiological response it produces (heart rate, blood lactate), and how it actually felt (rated perceived exertion). None of the three tells the full story alone: a GPS watch can't see how depleted you were walking in, and RPE alone drifts with mood and sleep. Good monitoring triangulates all three rather than leaning on whichever one happens to be easiest to record (Seiler, University of Agder, \"Quantifying Training in Endurance Athletes,\" Vienna 2017).",
      },
      { type: "heading", text: "Heart Rate Is a Useful Tool, Not a Precise One" },
      {
        type: "paragraph",
        text: "The 220-minus-age formula for max heart rate is a population average, and individuals routinely fall far outside it. In one dataset of 37 trained cyclists tested under identical lab conditions, only 11 had a measured peak heart rate within 3 beats of their age-predicted number — 12 were off by 10 beats or more. Heart rate is still genuinely useful: it's objective, easy to log daily, and the relationship between heart rate and lactate threshold stays remarkably stable over time. But it drifts with heat, fatigue, and caffeine, and it says almost nothing meaningful during a short maximal interval. Treat a heart rate zone as a loose guide calibrated to how the effort actually feels, not a number to chase for its own sake.",
      },
      { type: "heading", text: "How Many Zones Do You Actually Need?" },
      {
        type: "paragraph",
        text: "There's no consensus answer. An informal poll of coaches split 43% using five distinct intensity zones, 36% using a simple low/medium/high, and 14% using just easy and hard. All three framings can work, because what matters more than zone count is consistency — comparing this week's Zone 2 pace to last month's Zone 2 pace only means something if the boundaries haven't quietly shifted underneath you.",
      },
      { type: "heading", text: "The Simplest Load Formula That Actually Holds Up" },
      {
        type: "paragraph",
        text: "Multiply session duration in minutes by a 0–10 session RPE — rated roughly 30 minutes after finishing, using exercise physiologist Carl Foster's scale — and you get a single training-load number that's crude but genuinely useful for spotting trends. A 90-minute easy run at an RPE of 3 comes out to 270; a 60-minute interval session at an RPE of 7 comes out to 420, despite being 30 minutes shorter. Across roughly 4,500 logged sessions, session RPE tracked cleanly with independently measured intensity category, which is a big part of why this crude multiplication still earns a place in serious training logs alongside heart rate and power data.",
      },
      { type: "heading", text: "What's Worth Tracking, Consistently" },
      {
        type: "list",
        items: [
          "The actual prescription — what the session was meant to be, in plain, repeatable language.",
          "Duration, defined the same way every time (does the warm-up count? does the cool-down?).",
          "Session RPE, recorded roughly 30 minutes after finishing, not while still catching your breath.",
          "A simple load number (duration × sRPE) — not because it's precise, but because trends over months matter more than precision on any single day.",
          "Heart rate or lactate, if you have access to it.",
          "Test and race results, to check whether all the above is actually translating.",
        ],
      },
    ],
  },
  {
    slug: "coaching-library",
    title: "Coaching Library",
    mission:
      "Comparative study of influential coaching systems and shared principles across eras.",
    topics: ["Lydiard", "Daniels", "Canova and modern systems"],
    category: "coaching-and-training",
    content: [
      { type: "heading", text: "The Lydiard System" },
      {
        type: "paragraph",
        text: "Arthur Lydiard's system came out of Auckland, New Zealand, and produced Olympic medalists Peter Snell and John Davies. The core premise: most runners lack endurance, not speed, and the aerobic base has to be built before anything else is layered on top of it — a structural bet that shows up clearly against Daniels' more VO2max-and-pace-zone-driven system and Canova's higher-intensity marathon-specific blocks. All three systems agree endurance matters; they disagree on how much of training should be spent building it versus sharpening it.",
      },
      { type: "heading", text: "The Pyramid" },
      {
        type: "paragraph",
        text: "Lydiard structured training as a pyramid: three to six months of aerobic conditioning at the base, then four-week blocks of hill strength, interval training, and speed and skills work, finishing with a three-to-four-week taper into the goal race. The wider the base, the higher the peak it can support.",
      },
      { type: "heading", text: "Best Prepared, Not Best Talented" },
      {
        type: "paragraph",
        text: "Lydiard's own summary of why his system worked across so many events and eras: it is not the best athletes who succeed in important competitions, but the best prepared. Many of the medal winners at the 1992 Olympics, in his assessment, weren't the most talented athletes in their fields — they were simply the ones whose preparation held together. Champions, in his view, are developed, not born, even though some start with more natural ability than others (Lydiard, Running to the Top).",
      },
      { type: "heading", text: "Why Poorer Coaches Get Early Results, Then Stall" },
      {
        type: "paragraph",
        text: "Lydiard's read on why so many promising young runners flame out: poorer coaches can produce fast early results by loading on anaerobic work before an athlete's aerobic base is ready for it, but that early success comes at the cost of the athlete's long-term ceiling. The best coaches take longer to produce results precisely because they're building the base first. In Lydiard's blunter framing, anaerobic training is what destroys young runners — and he pointed specifically at the American high school and college system, where a runner who shows early talent typically gets put straight onto the track and loaded with anaerobic work, instead of being allowed to build an aerobic foundation first (Lydiard, Running to the Top).",
      },
      { type: "heading", text: "Identical Workouts, Different Outcomes" },
      {
        type: "paragraph",
        text: "At the '64 Tokyo Olympics, Lydiard's athletes ran a hard session of 20 quarter-miles. The next day, a rival Canadian runner watched them, then ran the exact same session himself. Asked what he thought of it, Lydiard said, \"I think it was the last nail in his coffin.\" His own athletes had needed that session; the Canadian didn't — he missed his event's final while Snell and Davies medaled. Good training and bad training can look identical on paper. What matters is whether that specific athlete needed it.",
      },
      { type: "heading", text: "How Peter Snell Trained for a World Record" },
      {
        type: "paragraph",
        text: "In 1962, Peter Snell — coached by Lydiard — built up to a 100-mile training week, ran hill circuits, and logged long aerobic runs up to 22 miles, all in the months before he broke the world mile record (3:54.4) and, weeks later, the 880-yard world record. He wasn't doing marathon-specific training; he was an 800/1500m runner. But the aerobic capacity built through that volume is what let him hold his speed deep into a race when it mattered most.",
      },
      { type: "heading", text: "Same Ingredients, Different Distances" },
      {
        type: "paragraph",
        text: "Lydiard's own explanation for why he had milers run marathon-length long runs rather than piling on track intervals: speed is common — plenty of runners can manage a single fast quarter-mile — but almost none can hold that pace for four in a row. His view was that stamina, not raw speed, was the real limiter for most runners, and that endurance built through volume translated directly into the ability to finally use the speed they already had, right when the race demanded it.",
      },
      { type: "heading", text: "Comparing the Major Systems" },
      {
        type: "paragraph",
        text: "Lydiard, Jack Daniels, Renato Canova, Joe Vigil, Steve Magness, Phil Maffetone, and the Norwegian national systems all produced genuinely fast athletes, and none of them trained the same way. Some of that is personality — Lydiard trusted feel, Daniels trusted a formula — but most of it is a real disagreement about which adaptation matters most and how directly a session should target it. What follows is where they converge, where they don't, and what each one is actually training for.",
      },
      { type: "heading", text: "Polarized Training (80/20): The One I Lean On Most" },
      {
        type: "paragraph",
        text: "Of everything on this page, this is the one I lean on most — and it's worth being precise about where it actually comes from. The research is Stephen Seiler's, not any single coach's: across a huge range of endurance athletes, roughly 80% of total training time sits at low intensity and 20% at moderate-to-high, and drifting far from that ratio in either direction tends to cost fitness rather than add it. I first ran into the idea through Matt Fitzgerald's book 80/20 Running, which popularized Seiler's research for a general audience — Fitzgerald didn't originate the concept, he wrote the book that taught it to me. It isn't prescriptive about pace to the degree Daniels is, and it isn't purely feel-based the way Lydiard is — it sits in between, with a real ratio to check yourself against but enough flexibility to apply it by RPE, heart rate, or pace depending on the workout (see the Five Training Zones in the Workout Library). What actually sold me wasn't the ratio itself so much as the mechanism underneath it — the IL-6 and brain-fatigue research covered in the Research Library gives a real reason why \"mostly easy, genuinely hard when it counts\" works, rather than it just being a rule that happens to hold up statistically.",
      },
      { type: "heading", text: "Jack Daniels: Precision Through Pace Zones" },
      {
        type: "paragraph",
        text: "Daniels built his system around VDOT — a single number derived from a recent race result that maps onto five training paces: Easy, Marathon, Threshold, Interval, and Repetition. Where Lydiard asks an athlete to run by feel, Daniels prescribes a literal pace band for every session, recalculated as fitness changes. Periodization follows a similar logic to Lydiard's pyramid — an aerobic phase before a sharpening phase — but the boundaries between phases are set by VDOT math rather than a fixed number of weeks (Daniels, Daniels' Running Formula).",
      },
      { type: "heading", text: "Renato Canova: Marathon-Specific Density" },
      {
        type: "paragraph",
        text: "Canova, who has coached a long list of world-class Kenyan and Ethiopian marathoners, periodizes almost in reverse of the classic base-then-sharpen model. Rather than building a wide aerobic base and tapering into speed, his marathon buildups load in \"special blocks\" — sustained stretches of running at or near marathon race pace, sometimes 20-plus kilometers long, that get denser and more frequent as the race approaches. The aerobic base still has to be there; it just isn't the visible structure of the plan the way it is for Lydiard.",
      },
      {
        type: "heading",
        text: "Joe Vigil: Altitude, Biomechanics, and the Whole Athlete",
      },
      {
        type: "paragraph",
        text: "Vigil coached at altitude in Alamosa, Colorado, and built his system on a similar aerobic-first premise to Lydiard's, layered with an unusually heavy emphasis on running mechanics and psychology — he treated economical form and mental composure as trainable skills, not fixed traits. His best-known result, Deena Kastor's American record and Olympic bronze in the marathon, came from exactly that combination: high-altitude aerobic volume paired with deliberate technical and mental work most programs treat as secondary.",
      },
      { type: "heading", text: "Phil Maffetone: The MAF Method" },
      {
        type: "paragraph",
        text: "Maffetone runs the strictest aerobic-only system on this list: build the base almost exclusively below a hard heart-rate ceiling — his rule-of-thumb formula is 180 minus age, adjusted a few beats for training history and health — for months before adding any faster work at all. Critics point out that a flat age-based formula ignores real differences in individual aerobic fitness the way lactate testing or VDOT don't — but the underlying instinct, that most runners run their easy days too hard, is the same one driving Lydiard's pyramid, Norwegian threshold work, and 80/20 Running alike.",
      },
      { type: "heading", text: "Steve Magness: Testing the Folklore" },
      {
        type: "paragraph",
        text: "Magness approaches coaching less like a system and more like an audit — a coach and physiologist who spends most of his writing (Peak Performance, Do Hard Things) testing inherited assumptions against actual research. Where a lot of American coaching still runs on the idea that suffering builds toughness, Magness's read of the evidence is closer to the opposite: performance under pressure is built by managed stress and real recovery, not by seeing how much punishment an athlete can absorb.",
      },
      {
        type: "heading",
        text: "Norwegian Threshold Training: Living at the Edge of the Threshold",
      },
      {
        type: "paragraph",
        text: "Popularized by the Ingebrigtsen family and later adopted in triathlon by Kristian Blummenfelt and Gustav Iden, the Norwegian model runs directly against the polarized-training research covered in the Research Library. Instead of concentrating almost all quality work at low and very high intensities, Norwegian athletes often run two threshold sessions in a single day, several days a week, holding pace just below the point where lactate starts accumulating faster than the body can clear it — a boundary tracked with frequent blood-lactate testing rather than feel or heart rate alone.",
      },
      { type: "heading", text: "What Each System Is Actually Training For" },
      {
        type: "paragraph",
        text: "Strip away the branding and each system is chasing a specific adaptation. Lydiard's base phase, Vigil's altitude volume, and Maffetone's heart-rate-capped base phase are all after the same capillary density and mitochondrial growth — see The Aerobic Base for the mechanism — just enforced by feel, altitude, or a strict intensity ceiling respectively. Norwegian threshold work targets lactate clearance and buffering capacity directly, at the exact intensity where that system is normally the limiter. Canova's marathon-specific blocks target glycogen-sparing efficiency at goal race pace specifically, rather than fitness in general. Daniels' interval and repetition paces target VO2max and running economy respectively. None of it is mysterious once you ask what's actually being trained instead of what the workout is called.",
      },
      { type: "heading", text: "A Week, Compared" },
      {
        type: "list",
        items: [
          "Lydiard base week — daily aerobic running at a conversational effort, no interval work at all, one longer run on the weekend. Volume is the entire session.",
          "Daniels formula week — one quality day each for a long run at Marathon pace, a Threshold session, and an Interval or Repetition session, each dosed in minutes or meters calculated from current VDOT.",
          "Canova marathon-specific week (late buildup) — two \"special block\" sessions at or near marathon pace, aerobic mileage filling the rest of the week, minimal easy junk volume.",
          "Norwegian threshold week — up to four days with two sub-threshold sessions each, intensity controlled by lactate testing rather than pace or feel.",
          "Maffetone MAF week — every run held under a hard heart-rate ceiling (180 minus age, adjusted), often for months at a stretch, with no speed work until an aerobic time trial at that heart rate stops improving.",
          "Elite Kenyan week — daily mileage varies widely rather than staying constant (10, 15, 12, 18, 10, 15, then a 24-mile long run), aerobic-effort-dominant, built around one very long day rather than a fixed weekly template.",
          "80/20 week — not a fixed shape at all, just a ratio checked against whatever week you're already running: tally low-intensity time against total time and see how close it lands to 80%.",
        ],
      },
      { type: "heading", text: "Where They Agree" },
      {
        type: "list",
        items: [
          "Aerobic volume is the foundation, even in the systems that don't advertise it that way — Canova's marathon-specific blocks and Norwegian threshold work both sit on top of large aerobic mileage, not instead of it. 80/20 Running is just the most literal statement of the same rule, spelled out as a ratio.",
          "Recovery is trainable and has to be managed deliberately, not treated as time off from the real work.",
          "Progression has to move toward race specificity — general fitness eventually has to convert into the exact demand of the goal race.",
        ],
      },
      { type: "heading", text: "Where They Disagree" },
      {
        type: "list",
        items: [
          "How much quality work should sit near threshold. Norwegian training spends heavily there; Seiler's polarized-training research (see Research Library) argues that's exactly the zone to minimize.",
          "How prescriptive training should be. Daniels calculates paces to the second and Maffetone locks a heart-rate ceiling to a formula; Lydiard and Magness lean on feel and context over a fixed number.",
          "How much technical and mental coaching matters. Vigil and Lydiard treat form and psychology as core training; Daniels' formula is largely agnostic to either.",
        ],
      },
      {
        type: "quote",
        text: "There have been many examples of top high schoolboys who, on natural ability, could beat everyone... but then, at twenty or so, were no longer champions... the boys they had been beating, who didn't have the natural talent but had worked harder and more sensibly at developing their running, and maintained a high oxygen uptake capability as a consequence, went on to be the champions.",
        attribution: "Arthur Lydiard",
      },
      { type: "heading", text: "How Much Volume Is Actually Required" },
      {
        type: "paragraph",
        text: "Numbers vary by event and level, but the pattern holds across nearly every system above: more volume, applied consistently, is the most reliable long-term lever available. Most elite 5K runners train in the 70–100-plus mile-per-week range; maximizing performance from 1500m up typically takes something in the 80–90-mile range, with many elite milers well over 100. It's possible to compete on 50 miles a week and run reasonably well — plenty of runners do — but that volume caps how much of the aerobic adaptation is actually available. The load itself is what builds resilience and the ability to recover faster between sessions, which is exactly why \"add more consistent volume\" remains the simplest lever in every system above, disagreements about pacing and intensity aside.",
      },
    ],
  },
  {
    slug: "marathon-training",
    title: "Marathon Training",
    mission:
      "Structured marathon cycles with practical frameworks for workouts, fueling, tapering, and race execution.",
    topics: ["Workouts", "Fueling", "Race strategy"],
    category: "coaching-and-training",
    content: [
      { type: "heading", text: "How Long a Buildup Should Actually Be" },
      {
        type: "paragraph",
        text: "The body can't keep absorbing increasing training load indefinitely — most runners hit a wall around 24 weeks of steadily building volume, after which further increases stop producing fitness gains and start just producing fatigue. That ceiling is why serious marathon buildups run in cycles rather than one long uninterrupted ramp: build for up to about 24 weeks, then take a recovery block of at least a couple of weeks before the next cycle. Counterintuitively, the runner comes back from that break able to train harder and reach a higher peak than if the buildup had never stopped, despite losing some fitness during the break itself (Fitzgerald, 80/20 Running).",
      },
      { type: "heading", text: "Racing the Last 25%" },
      {
        type: "paragraph",
        text: "A more useful question than pace splits: how long can this athlete actually think clearly under race stress? Mental fatigue tends to hit early, so if all the concentration gets spent in the first mile, there's nothing left for the finish. The fix is to bookend the effort — a controlled open, a quiet middle third that conserves mental energy, and a hard, deliberate close — decided before the start. Changing strategy mid-race rarely works.",
      },
      { type: "heading", text: "Race-Day Checklist" },
      {
        type: "list",
        items: [
          "Eat normally in the days beforehand — protein, carbs, and fat are all part of a balanced pre-race diet; finish your last full meal about three hours before the start.",
          "Lace your shoes with your heel forced back into the shoe first, snug but not tight — loose lacing is what causes blistering.",
          "Start conservatively and warm into the effort. Going out too fast early costs far more than it can ever gain back.",
          "On hot days, drink water and electrolytes throughout the race, not just at the start — and keep your body wet. Sponging is one of the simplest defenses against overheating.",
          "Don't surge mid-race. Every surge spends energy you don't get back.",
          "Never sprint the finish, even if you feel great in the closing miles — the ideal way to finish a race is still feeling like you could run some more.",
        ],
      },
      { type: "heading", text: "Honey Over Carb-Loading, and Skip the Salt Tablets" },
      {
        type: "paragraph",
        text: "Lydiard's own marathon fueling advice predates modern carb-loading protocols by decades, and it's simpler: keep eating your normal balanced meals in the days before the race, add up to 8 ounces of honey on top of that over the final two days for easy-to-digest calories, and finish eating about three hours before the gun. He was just as direct about what to skip — salt tablets, which he considered unnecessary and potentially harmful, in favor of diluted electrolyte drink and plain water taken steadily through the race rather than a concentrated dose swallowed all at once.",
      },
      { type: "heading", text: "How Often You Can Actually Race a Marathon" },
      {
        type: "paragraph",
        text: "A hard-raced marathon costs more recovery than most runners budget for. Lydiard's own guidance: no more than one full marathon every couple of months if you're racing it honestly rather than jogging it, and after a hard half or full marathon, two full weeks of easy jogging only — nothing fast — before any quality work resumes. The two-day carb top-up before a race has a ceiling too: up to about 200 grams (roughly half a pound) of glucose or fructose in the two days beforehand is sufficient, and more than that doesn't buy additional benefit (Lydiard, Running to the Top).",
      },
    ],
  },
  {
    slug: "workout-library",
    title: "Workout Library",
    mission:
      "Workout references organized by objective, adaptation target, and training phase.",
    topics: ["Aerobic sessions", "Threshold sessions", "Specificity"],
    category: "coaching-and-training",
    content: [
      { type: "heading", text: "Five Training Zones, Anchored to One Number" },
      {
        type: "paragraph",
        text: "Matt Fitzgerald's 80/20 Running system defines five intensity zones off a single anchor point: lactate threshold heart rate, found via a 30-minute time trial (average heart rate over the last 10 minutes) or a simpler talk test (the fastest pace at which conversation stays comfortable). Zones 1–2 are low intensity (RPE 1–4), Zone 3 is moderate (RPE 5–6), and Zones 4–5 are high (RPE 7–10) — with the rule that pace should never be the primary gauge in Zones 1–2, heart rate and pace should both govern Zone 3, and pace takes over as primary once effort climbs into Zones 4–5, since heart rate lags a sudden change in effort by a minute or more. A foundation run — Fitzgerald's term for what most coaches just call an easy run — is simply a Zone 1–2 effort bookended by a Zone 1 warm-up and cool-down; nearly everything else on this page is built by layering moderate or high-intensity segments onto that same base.",
      },
      { type: "heading", text: "What a Warm-Up Is Actually For" },
      {
        type: "paragraph",
        text: "A warm-up has exactly two jobs: raise pulse rate and blood circulation, and warm the muscles enough to reduce their viscosity so they function properly. Both are satisfied by about five minutes of jogging or running in place at a genuinely easy aerobic effort, while staying warm throughout — a track suit over the running gear if conditions call for it. It doesn't need to be more complicated than that, but skipping it isn't free: going out too fast before the aerobic mechanism has actually taken over is exactly how a race or session gets away from a runner early (Lydiard, Running to the Top).",
      },
      { type: "heading", text: "Dialing In a Tempo Run" },
      {
        type: "paragraph",
        text: "A tempo run works best around 20–24 minutes of sustained effort, held at roughly a 6 out of 10 perceived effort — hard enough to be real work, controlled enough that you could keep going if you had to. Struggling to hold pace past 7–9 minutes in is the signal to back off, not push through: the point is time spent at the right intensity, not a number on the watch. Full duration at the correct effort beats redlining for half the time, usually within months.",
      },
      { type: "heading", text: "Hill Circuit Training" },
      {
        type: "paragraph",
        text: "Find a hill graded around 1-in-3, with a flat stretch at the bottom for sprint work. After warming up, spring up the hill with a bouncing action, using your own body weight as resistance rather than just lifting the knees higher. Jog for about three minutes at the top, then stride back down fast to develop leg speed. At the bottom, run a few windsprints (50–400m) before starting the next lap. Repeat for about an hour, three days a week, alternating with dedicated leg-speed days.",
      },
      { type: "heading", text: "Leg-Speed Repetitions" },
      {
        type: "paragraph",
        text: "On a flat or gently sloped stretch of 120–150 meters, run it ten times with a full three-minute recovery between each rep. The only thing to focus on is turning the legs over as fast as possible — not stride length. It can feel unproductive at first; results typically show up after four to six weeks of consistent work.",
      },
      { type: "heading", text: "Four Ways to Structure an Interval Session" },
      {
        type: "list",
        items: [
          "Traditional long intervals — 2–15 minute work bouts above lactate threshold, with 60–180 seconds of recovery between them.",
          "Micro-interval blocks — short 10–60 second efforts with 5–60 seconds of rest, usually grouped into 2–4 blocks separated by 3–5 minutes of recovery.",
          "Repeated sprint training — sprints under 10 seconds, separated by 30–60 seconds of recovery, aimed at the anaerobic and neuromuscular systems rather than aerobic capacity.",
          "Sprint interval training — 4–8 maximal 30-second efforts with 3–5 minutes of recovery between them, closer to a power and capacity session than an endurance one.",
        ],
      },
      {
        type: "paragraph",
        text: "(Buchheit & Laursen, \"High-Intensity Interval Training: Solutions to the Programming Puzzle,\" Sports Medicine, 2013)",
      },
      { type: "heading", text: "What Actually Controls the Intensity of an Interval Session" },
      {
        type: "paragraph",
        text: "Work-bout duration and total accumulated work time are the two variables that push or pull an athlete into a given intensity zone — not the rest period, which turns out to matter surprisingly little once it's above roughly 90 seconds. A practical rule that comes out of this: fix recovery at around two minutes and stop fiddling with it, prescribe the session to be run at a genuinely maximal, sustainable effort, and let heart rate land wherever it lands rather than using heart-rate recovery to decide when the next interval starts.",
      },
      { type: "heading", text: "Three Ways Lydiard Used a Hill" },
      {
        type: "list",
        items: [
          "Steep hill running — slow forward progress up a steep grade, exaggerating full leg and foot extension on every stride, kept short and essentially alactic (10 seconds or less, 50 meters or less).",
          "Hill bounding — long, triple-jump-style bounds up a gentler slope, emphasizing full extension of the rear leg on push-off.",
          "Hill springing — very slow forward progress where nearly all the movement comes from the ankle, gentle enough to sustain for longer without breaking down.",
        ],
      },
      {
        type: "paragraph",
        text: "Three different hills doing three different jobs — one alactic power, one bounding strength, one ankle-specific springiness — all built before any of it gets asked to hold pace on flat ground.",
      },
    ],
  },
  {
    slug: "5k-training",
    title: "5K Training",
    mission:
      "Structured 5K and cross country training built for the distances high school and collegiate racers actually run — periodization, pacing, and race-week execution.",
    topics: ["Track periodization", "Race-week schedule", "Pacing"],
    category: "coaching-and-training",
    content: [
      { type: "heading", text: "Building Toward the Track Season" },
      {
        type: "paragraph",
        text: "Lydiard broke a track buildup into three phases. The first four weeks focus on anaerobic and speed development — hard running totaling around three miles per session (whether that's 12x400m, 6x600m, or similar), always with at least a day of recovery between hard efforts, alternating with dedicated sprint-technique days. The next four and a half weeks shift to coordination: a weekly sharpening session of short, fast accelerations, a time trial near race distance to diagnose weaknesses, and a development race or two. The final ten days are for freshening up — small volume, short efforts, legs kept fresh rather than fatigued going into the goal race.",
      },
      { type: "heading", text: "Non-Race Week" },
      {
        type: "list",
        items: [
          "Repetitions early in the week to develop anaerobic capacity.",
          "Aerobic running mid-week to hold the base.",
          "A time trial near race pace to check fitness and pacing.",
          "Fast relaxed striding to keep leg speed sharp.",
          "A second time trial later in the week.",
          "An aerobic run to close out the week and recover into the next cycle.",
        ],
      },
      { type: "heading", text: "Race Week" },
      {
        type: "list",
        items: [
          "Monday: windsprints.",
          "Tuesday: easy fartlek.",
          "Wednesday: a short time trial.",
          "Thursday: fast relaxed striding.",
          "Friday: an easy jog.",
          "Saturday: the race.",
          "Sunday: a long aerobic run.",
        ],
      },
    ],
  },
  {
    slug: "training-plans",
    title: "Training Plans",
    mission:
      "Progressive plans from beginner to elite for cross country, 5K, 10K, half marathon, and marathon.",
    topics: ["Beginner to elite", "Race-specific plans", "Progression"],
    category: "coaching-and-training",
    content: [
      { type: "heading", text: "From Zero to 20 Minutes: An 8-Week Start" },
      {
        type: "paragraph",
        text: "The Lydiard Foundation's beginner program is built on walk/jog intervals, three days a week, starting at just 15 minutes total. Each week, the jogging segments get slightly longer and the walking segments get shorter, with one slightly longer session built in on the third training day. By the end of eight weeks, most beginners are running 20 minutes continuously — not because the schedule pushed them there, but because the body adapts faster than most people expect once the stress is applied consistently and recovery days are respected.",
      },
      { type: "heading", text: "The Golden Rules" },
      {
        type: "list",
        items: [
          "Train, don't strain — you genuinely cannot run too slowly.",
          "It's not the distance that stops you, it's the speed. If in doubt, do less.",
          "If a week feels too hard, repeat it rather than pushing forward on schedule.",
          "Listen to your body over the plan on paper — the schedule is a guide, not an order.",
        ],
      },
      { type: "heading", text: "Finding Your Training Heart Rate" },
      {
        type: "paragraph",
        text: "A simple formula for an approximate training range: (220 minus your age, minus your resting heart rate) times 70%, plus your resting heart rate again — add 3 if you're a woman. Give yourself about five beats on either side of that number as your range. Treat it as a rough guideline, not gospel — how an effort feels should always override what a number on a screen says.",
      },
      { type: "heading", text: "A More Precise Way to Find Your Zones: The Talk Test" },
      {
        type: "paragraph",
        text: "The heart-rate formula above is a reasonable starting estimate, but it's still a population average. A more individualized alternative: start jogging slowly, and every minute, speed up slightly and try to talk — recite something memorized, or just count out loud. The fastest pace at which you can still speak in full, comfortable sentences, with breathing back to normal within about three breaths of stopping, marks your lactate threshold. Everything below that pace is low intensity; conversation getting noticeably harder to hold is where moderate and high intensity begin. It costs nothing, needs no equipment, and adjusts automatically as fitness changes — which a fixed formula can't do (Fitzgerald, 80/20 Running).",
      },
      { type: "heading", text: "Pleasantly Tired: The Only Metric a Beginner Needs" },
      {
        type: "paragraph",
        text: "Lydiard's original instruction for a first-time jogger wasn't a pace or a distance — it was a feeling. Run for 15 minutes, walking whenever the effort stops feeling comfortable, and stop when you're \"pleasantly tired\": worked hard enough to know you've trained, not so hard that tomorrow is compromised. No coach, however experienced, can look at a person and predict how far or fast they should go on day one — that gets discovered by running and paying attention, not assigned from a chart.",
      },
      { type: "heading", text: "The Beginner Progression, Stage by Stage" },
      {
        type: "list",
        items: [
          "Starting out: 15 minutes daily, run/walk, at a pleasantly tired effort — no distance goal at all.",
          "Second stage (6–8 weeks): alternate 15- and 30-minute days across the week, with one rest or easy day built in.",
          "Third stage (6–8 weeks): the 30-minute days stretch to a full hour twice a week, still bracketed by easy days.",
          "Fourth stage: long runs extend to 1.5–2 hours on the longest day of the week, with 30-minute recovery days around it.",
          "Only once two continuous hours feels genuinely manageable does it make sense to start running to a watch and pace rather than to time and feel.",
        ],
      },
    ],
  },
  {
    slug: "sports-psychology",
    title: "Sports Psychology",
    mission:
      "How confidence, motivation, identity, and resilience shape championship performance.",
    topics: ["Mental toughness", "Intrinsic motivation", "Pressure management"],
    category: "mind-and-recovery",
    content: [
      { type: "heading", text: "The Mental Performance Plan" },
      {
        type: "paragraph",
        text: "A simple template worth filling out before a big race — not just once, but before every one:",
      },
      {
        type: "list",
        items: [
          "My team at its best",
          "Myself at my best",
          "To fear and pain",
          "Start",
          "First third",
          "Second third",
          "Final third",
          "Finish",
          "What matters",
        ],
      },
      {
        type: "paragraph",
        text: "Writing real answers to each turns vague nerves into something specific enough to act on.",
      },
      { type: "heading", text: "Demand Sincerity, Explain the Why" },
      {
        type: "paragraph",
        text: "Lydiard's policy was blunt: a coach's time is the most valuable thing they can give an athlete, and it's wasted on someone who isn't sincere about training or honest with their coach. But sincerity runs both directions — an athlete sent out to do something demanding without being told why is unlikely to put real effort into it. Explaining the physiological and mechanical reason behind a session, not just assigning it, is what turns compliance into genuine investment (Lydiard, Running to the Top).",
      },
      { type: "heading", text: "Leave Them Alone Before It Starts" },
      {
        type: "paragraph",
        text: "Many coaches deliver a team talk moments before competition starts, when athletes are already keyed up and mentally out on the course or field. Lydiard's read: that's the wrong moment entirely — minds are already gone, and there's nothing left for a pep talk to land on. Tactics get discussed two nights before, not two minutes before; once the race is close, the best thing a coach can do is leave the athlete alone with what they already know.",
      },
      { type: "heading", text: "Keep a Log, Not a Comparison Tool" },
      {
        type: "paragraph",
        text: "The strongest predictor of long-term success isn't raw talent — it's having a coach, a team, and a training log. Write the week's goals at the top of each page, note anything that isn't going well plus your own best guess at a solution, and write down what went right and why. Apps that let you compare your splits against everyone else's turn your own training into someone else's competition. Keep the comparison out of it.",
      },
      { type: "heading", text: "Every Failure Is Data, Not a Verdict" },
      {
        type: "paragraph",
        text: "A bad race or a missed workout deserves the same treatment as a lab result: analyze it objectively, figure out why it went the way it did, and use the answer to avoid repeating it — not hurl your shoes across the locker room and berate yourself over it. Every error is a learning experience only if it's actually treated as one, rather than just an occasion for self-punishment (Lydiard, Running to the Top).",
      },
      { type: "heading", text: "Tolerance for Suffering Is a Trainable Skill" },
      {
        type: "paragraph",
        text: "Mental toughness isn't just a personality trait — it's a specific, trainable capacity that responds to the same stimulus-then-adaptation logic as the aerobic system: exposure to discomfort now builds a higher tolerance for it later. Skilled, experienced athletes in virtually every sport show measurably less brain activity while performing than novices do, a \"quieter brain\" that shows up in running as the relaxed, effortless-looking stride of a well-trained runner deep into a hard effort. The training implication: long, low-intensity runs that stay uncomfortable for a sustained period build this tolerance more effectively than short, hard efforts do, even though the short efforts hurt more in the moment (Fitzgerald, 80/20 Running).",
      },
      { type: "heading", text: "Goal Setting" },
      {
        type: "paragraph",
        text: "Write the goal itself as a \"cloud\" — something not entirely in your control, like a time or a place. Then write the steps as things that ARE in your control. A goal only really takes hold when it's roughly 10% written down, 45% felt — the emotions attached to reaching it — and 45% visualized. Share it with people who will lift you up, not weigh it down.",
      },
      { type: "heading", text: "Mantras and Affirmations" },
      {
        type: "paragraph",
        text: "A real affirmation isn't a negated worry — \"I will not procrastinate\" doesn't function the same way in your head as \"I always do things on time.\" They work best positive, present tense, specific, and stated as already true. Think of the conscious mind as an ant riding an elephant, the subconscious: the ant can steer, but only by repeating the direction until the elephant actually turns.",
      },
      { type: "heading", text: "Ten Rules for the Long Game" },
      {
        type: "list",
        items: [
          "Take chances.",
          "Sleep often.",
          "Dream big.",
          "Be positive.",
          "Be nervous in a good way — it means it matters.",
          "The journey is what you're actually here for.",
          "Smile when a race hurts.",
          "Being alone is sometimes exactly what you need.",
          "Ask for help when you need it.",
          "Believe in belief, and believe in yourself.",
        ],
      },
      { type: "heading", text: "Five Things to Carry Into a Race" },
      {
        type: "list",
        items: [
          "Be happy in the moment and enjoy the process rather than waiting for results to justify it.",
          "Learn from defeats, but hold on to victories vividly.",
          "You can't control what happens mid-race, only your reaction to it.",
          "Keep affirmations and goals visible — see them daily.",
          "Visualize daily: write, read, visualize.",
        ],
      },
      { type: "heading", text: "Running as Medicine, Dosed Correctly" },
      {
        type: "paragraph",
        text: "In the late 1970s, University of Wisconsin psychiatry researchers John Greist and Marjorie Klein, running therapist Roger Eischens, and Madison physician John Faris — all runners themselves who'd separately noticed their own low moods lift on a run — studied running as a treatment for depression. The same consistency logic that builds fitness turned out to apply to mood: the goal on any given day wasn't to extract maximum benefit from one hard session, it was to finish wanting to come back tomorrow.",
      },
      {
        type: "quote",
        text: "If there is any secret to the success our patients have had in treating their depression with running, it is that they have tried to run each day in such a way that they would want to run again the next day.",
        attribution: "Greist and Klein, University of Wisconsin, cited in Lydiard's Running to the Top",
      },
      { type: "heading", text: "The Wheel" },
      {
        type: "paragraph",
        text: "A team is a wheel, and each runner is a spoke — self-investment, goal setting, prioritizing, positive self-talk, and visualizing success. No spoke matters more than another, and the wheel only holds together if every spoke does its job. One spoke might reach the finish first, but without the others, the wheel doesn't arrive at all. There's no time to feel sorry for yourself mid-race — slowing down or waiting doesn't just cost you, it costs the team.",
      },
    ],
  },
  {
    slug: "recovery",
    title: "Recovery",
    mission:
      "Sustainable performance through sleep, nutrition, strength, mobility, and injury prevention.",
    topics: ["Sleep and stress", "Nutrition", "Injury prevention"],
    category: "mind-and-recovery",
    content: [
      { type: "heading", text: "Eat Without a Label" },
      {
        type: "paragraph",
        text: "If it's man-made, it's probably not good for you — the simplest nutrition rule that actually holds up. Eat whatever you want, as much as you want, as long as it doesn't have a label on it: fruits, vegetables, and meat, not processed food. Carbohydrates digest faster than protein or fat, which is why they belong before training or racing, not after. Complex carbs — rice, potatoes, pasta — provide longer-lasting energy than simple sugars. Unsaturated fats, liquid at room temperature, are the better everyday choice over saturated fats, solid at room temperature, though the body needs some of both, along with sugar and red meat in moderation. Papaya and pineapple are worth having on hand for sore muscles.",
      },
      { type: "heading", text: "Fueling Before You Race" },
      {
        type: "paragraph",
        text: "Eat 3–4 hours before a race — something carbohydrate-based, around 300–400 calories — and give it time to clear, since digestion competes with running muscles for blood flow. For early starts where a full meal isn't practical, liquid calories (100–200 calories) digest faster and sit better than solid food. Test the routine in training first, not on race morning.",
      },
      { type: "heading", text: "Hydration" },
      {
        type: "paragraph",
        text: "A simple daily target: water need in ounces equals body weight in pounds divided by two. Sip through the day — aim for at least one sip every 20 minutes — rather than trying to catch up all at once.",
      },
      { type: "heading", text: "Salt Tablets, Potassium, and Heatstroke" },
      {
        type: "paragraph",
        text: "Lydiard's skepticism of salt tablets had a specific physiological reason behind it: in one review, roughly half of athletes hospitalized for heatstroke after intense exercise turned out to be potassium-depleted, and many of them had been taking salt tablets — which force potassium out of the body as sodium is added. Athletes who don't sweat heavily don't need extra potassium in the first place; those who do and still take salt tablets need to double their potassium intake just to break even, which is a real argument for skipping the tablets and taking salt in through food and a diluted electrolyte drink instead (Lydiard, Running to the Top).",
      },
      { type: "heading", text: "Cross-Training That Actually Carries Over" },
      {
        type: "paragraph",
        text: "Not all cross-training transfers evenly to running. Research comparing supplemental training modes found cycling produced a real, measurable improvement in running performance, while swimming did not — the likely reason is that swimming removes both gravity and the alternating-leg-drive pattern running depends on, while cycling keeps the alternating-leg mechanics intact even though it removes the impact. The practical rule when picking a nonimpact option during an injury or a heavy-volume block — cycling, the elliptical, pool running — is to favor whatever keeps that alternating-leg action closest to running's own movement pattern (Fitzgerald, 80/20 Running).",
      },
      { type: "heading", text: "Strength Training Actually Needs a Schedule" },
      {
        type: "paragraph",
        text: "How often a strength stimulus repeats matters as much as the stimulus itself. Training the same muscle group every second day produces roughly 80% of the maximum attainable strength gain; twice a week drops that to about 60%; once a week to about 40%; and a stimulus spaced 14 days apart produces no measurable strength gain at all. The muscle reinforces the point locally, too — after one real training stimulus, it's essentially unresponsive to a second stimulus later the same day, the same recovery logic that governs hard running sessions applied to the weight room (Lydiard, Running to the Top).",
      },
      { type: "heading", text: "Jog Through Soreness, Don't Wait It Out" },
      {
        type: "paragraph",
        text: "The instinct to rest completely until sore muscles feel normal again is usually the wrong call. A slow, easy jog the day after a hard effort pushes blood through the muscle and helps clear the waste products causing the soreness — the heart doing, in effect, a gentle massage a resting runner can't get any other way. Stopping until the soreness fully resolves just means starting from scratch and working through the same soreness again once training resumes (Lydiard, Running to the Top).",
      },
      { type: "heading", text: "Relative Energy Deficiency in Sport (RED-S)" },
      {
        type: "paragraph",
        text: "The old \"Female Athlete Triad\" framework — amenorrhea, disordered eating, osteoporosis — has been superseded by the broader RED-S model, which applies to male and female athletes alike. The cornerstone concept is energy availability: energy intake minus exercise energy expenditure, relative to lean body mass. Drop consistently below roughly 30 kcal per kilogram of lean mass per day, and the body starts down-regulating systems that aren't immediately essential to survival — menstrual function, bone formation, metabolic rate, immune function, and in some cases mood and cognition — regardless of whether the low availability comes from intentional restriction or simply under-eating relative to training load (Mountjoy et al., British Journal of Sports Medicine, 2014).",
      },
      { type: "heading", text: "The Recovery Timeline Doesn't Move at One Speed" },
      {
        type: "paragraph",
        text: "Fixing low energy availability doesn't fix everything on the same clock. Energy status itself can start recovering within days to weeks of increased intake or reduced training load; menstrual function typically takes months to normalize even after energy status improves; bone mineral density can lag years behind both, meaning an athlete can feel and perform better long before the skeleton has actually caught up (2014 Female Athlete Triad Coalition consensus statement). That mismatch is exactly why a fast return to full training after a short break from RED-S symptoms is often premature — feeling recovered and being recovered aren't the same timeline.",
      },
    ],
  },
  {
    slug: "articles",
    title: "Articles",
    mission:
      "Educational writing that connects physiology, psychology, and philosophy to practical training.",
    topics: ["Deep dives", "Practical lessons", "Applied theory"],
    category: "writing-and-resources",
    content: [
      { type: "heading", text: "Why Running Is Valuable for Everyone" },
      {
        type: "paragraph",
        text: "Let's consider a simple question: who is running for? Is it for the potential Olympic champion chasing marginal gains and podium finishes, or is it for the man or woman, the girl or boy, who simply wants to feel a little more alive and experience the quiet satisfaction that comes from physical and mental well-being? The answer is both. Running is one of the few pursuits that scales perfectly across ambition. It meets you where you are and grows with you, offering the same fundamental benefits whether you are chasing excellence or simply seeking clarity.",
      },
      {
        type: "paragraph",
        text: "It is possible to be healthy without being fit, and it is equally possible to be fit without being truly healthy. What we should aim for is both, and at the center of that balance is oxygen. Nearly every metabolic process in the human body depends, directly or indirectly, on oxygen, which means that improving our ability to take in, transport, and use oxygen has far-reaching effects on how we function. The key is not simply to exercise harder, but to train in a way that steadily improves oxygen uptake over time. That process requires consistency, patience, and a level of effort that can be sustained day after day.",
      },
      {
        type: "paragraph",
        text: "There are two primary ways the body produces energy: aerobic and anaerobic metabolism. Aerobic metabolism depends on oxygen and allows for efficient, long-duration energy production, while anaerobic metabolism operates without oxygen and is inherently limited in both duration and efficiency. This distinction is not trivial. When energy is produced aerobically, the body is able to extract far more usable energy from a given amount of fuel, making it possible to sustain effort over long periods. Anaerobic energy, by contrast, is short-lived and accumulates byproducts that quickly limit performance. For anyone interested in building lasting fitness rather than temporary strain, the aerobic system must be the priority.",
      },
      {
        type: "paragraph",
        text: "The heart plays a central role in this process. It is the muscle responsible for delivering oxygen-rich blood throughout the body, and like any muscle, it adapts to the demands placed upon it. To strengthen the heart and improve its capacity, it must be trained through sustained, controlled effort. Effort that is too easy will not stimulate adaptation, but effort that is too intense cannot be maintained long enough to produce meaningful change. The most effective training lies in the space between these extremes, where the body is challenged but not overwhelmed.",
      },
      {
        type: "paragraph",
        text: "Few activities create this kind of sustained aerobic demand as effectively as running. Each stride requires lifting and propelling the body against gravity, engaging the large muscles of the legs in a continuous and demanding rhythm. This places a consistent pressure on the cardiovascular system, forcing it to adapt in ways that improve overall efficiency. Other forms of exercise have their place, but many fall short in this specific regard. Cycling reduces the load by supporting body weight, swimming removes the effect of gravity altogether, and walking often lacks the intensity required to significantly challenge the system. Cross-country skiing may rival running in its total-body engagement, but it is limited by geography and season. Running, by contrast, is almost universally accessible and requires little more than the willingness to begin.",
      },
      {
        type: "paragraph",
        text: "Using running as the cornerstone of fitness requires an understanding of how to maintain effort at an aerobic level for extended periods. This is where many runners go wrong, mistaking constant intensity for progress. The body does not adapt best under relentless strain. It adapts when stress is applied intelligently and consistently. Building a strong aerobic foundation is essential, much like building a house on solid ground. Without it, any gains in speed or strength are fragile and short-lived.",
      },
      {
        type: "paragraph",
        text: "At a deeper level, these adaptations are driven by changes within the body itself. The development of capillary networks improves the delivery of oxygen to working muscles, while an increase in mitochondria enhances the body's ability to convert fuel into usable energy. These changes allow for greater endurance, more efficient movement, and improved resistance to fatigue. The body becomes not just stronger, but more capable of sustaining effort over time.",
      },
      {
        type: "paragraph",
        text: "Energy production lies at the core of this transformation. The body relies on adenosine triphosphate, or ATP, as its primary source of energy, but stores of ATP are limited and quickly depleted during intense activity. Aerobic metabolism solves this problem by continuously regenerating ATP through the use of oxygen, allowing for sustained performance over long durations. This is why a trained runner can maintain a steady effort for hours, while untrained efforts are often short-lived and exhausting.",
      },
      {
        type: "paragraph",
        text: "The benefits of this system extend beyond physical performance. As oxygen delivery improves, so too does the function of other systems, including the brain. Many runners notice greater mental clarity, improved focus, and a higher resistance to fatigue in their daily lives. Running becomes more than a physical activity; it becomes a way to sharpen the mind and stabilize the body as a whole.",
      },
      {
        type: "paragraph",
        text: "Running is valuable not because it is difficult, but because it is effective. It develops the systems that matter most, creating a foundation that supports both health and performance. It does not require elite talent or specialized conditions, only consistency and an understanding of how to train in a way that aligns with the body's natural processes. That is what makes it universal. Not everyone will become fast, but everyone can become better.",
      },
      { type: "heading", text: "The Onus to Quit" },
      {
        type: "quote",
        text: "Sometimes quitting is the right answer.",
      },
      {
        type: "paragraph",
        text: "For most of my life, quitting was not in my vocabulary. I was the kid who signed up for every sport, every season, every chance to test myself. Tennis in the summer, basketball in the winter, soccer and football whenever I could squeeze them in. I thrived on activity, on the sweat and effort that proved I had given my all.",
      },
      {
        type: "paragraph",
        text: "Then, in seventh grade, my middle school soccer coach who was also the P.E. teacher and cross-country coach pulled me aside after practice. He told me he thought I would make a great distance runner. At the time, I did not even know what cross country was. I thought it meant road trips across state lines, not an endurance sport. Still, his suggestion stayed with me.",
      },
      {
        type: "paragraph",
        text: "That fall, I lined up for my first race having never run more than a mile straight. The course was a mile and a half. I finished 14th overall, second on my team, and something clicked. By the end of the season, I was hooked. Running had found me, and it quickly became the sport where I could shine.",
      },
      {
        type: "paragraph",
        text: "In high school, I gave myself fully to the discipline. I ran for Brophy College Prep, where by sophomore year I was the only underclassman on the varsity state team. By junior year, I helped lead us to a state championship. Senior year, I was our top runner, finishing a full minute ahead of my teammates. Running was not just an activity anymore. It was an identity, a purpose.",
      },
      {
        type: "paragraph",
        text: "So when it came time for college, I asked myself: Do I want to keep doing this? Do I want running to dictate where I go and who I become? After much thought, I decided the answer was yes. I could not imagine myself without it. When Vanderbilt offered me a guaranteed roster spot, I jumped at it. It felt like the natural next step in a story that had been writing itself since seventh grade.",
      },
      {
        type: "paragraph",
        text: "It turned out to be one of the hardest decisions of my life.",
      },
      {
        type: "paragraph",
        text: "The warning signs came quickly. Our coach, Michael Porter, did not send out summer training until late June, weeks after I had graduated. His plan called for \"mileage runs\" that were nearly two minutes faster than what I had considered recovery in high school. Every day was a test, and if I failed to hit the right pace, I was told to make it up later in the week. The logic was rigid. The joy was gone.",
      },
      {
        type: "paragraph",
        text: "Over the next two years, the things I once loved about running began to fade. My personal records stagnated. Practices felt suffocating. Anxiety spread through the team as we pushed ourselves to exhaustion. The stopwatch and clipboard became symbols of pressure rather than progress.",
      },
      {
        type: "paragraph",
        text: "Even worse, I realized the training was not just failing me physically. It was stripping me of why I had started running in the first place. Running had been my way of connecting: to teammates, to other schools' athletes, to the outdoors, even to God. Now it was reduced to numbers, intervals, and survival.",
      },
      {
        type: "paragraph",
        text: "By the end of my sophomore year, I knew I could not keep going. So I did the unthinkable: I quit.",
      },
      {
        type: "paragraph",
        text: "Walking away was not easy. But quitting the team did not mean quitting the sport. It meant reclaiming it. It meant returning to the Lydiard way of training, which focused on running smarter rather than harder. Long aerobic runs, time spent in nature, and building endurance and joy replaced hammering myself into the ground. It meant asking not, \"How fast must I go today?\" but \"How far can I go?\"",
      },
      {
        type: "paragraph",
        text: "I realized quitting was not about weakness. It was about strength, the strength to step away from something that was breaking me, to trust my instincts, and to redefine what running meant in my life.",
      },
      {
        type: "paragraph",
        text: "Now, when I lace up, I do it with gratitude. Running is once again a place where I find connection, peace, and possibility. Sometimes quitting is the only way to start again.",
      },
    ],
  },
  {
    slug: "resources",
    title: "Resources",
    mission:
      "Curated books, podcasts, tools, and references for lifelong learning in the sport.",
    topics: ["Reading list", "Tools", "External references"],
    category: "writing-and-resources",
    content: [
      { type: "heading", text: "Foundational Reading" },
      {
        type: "list",
        items: [
          "Run to the Top / Running to the Top — Arthur Lydiard",
          "Jogging with Arthur Lydiard — Arthur Lydiard",
          "Healthy Intelligent Training — Keith Livingstone",
          "Daniels' Running Formula — Jack Daniels",
          "On the Wings of Mercury — Lorraine Moller",
          "\"The Basics of Jogging\" — Dr. George Sheehan",
        ],
      },
      { type: "heading", text: "Where the Physiology Comes From" },
      {
        type: "paragraph",
        text: "Much of the research referenced on this site traces back to Stephen Seiler's work at the University of Agder on training-intensity distribution in elite endurance athletes, including the 2014 PLOS ONE study \"The Road to Gold.\" See the Research Library for the specific findings.",
      },
    ],
  },
  {
    slug: "contact",
    title: "Contact",
    mission:
      "Reach out for coaching questions, collaborations, speaking, and long-term development support.",
    topics: ["Coaching inquiries", "Collaborations", "Speaking"],
    category: "writing-and-resources",
  },
  {
    slug: "heat-tracker",
    title: "Heat Tracker",
    mission:
      "Live WBGT readings and a 48-hour outlook to help you plan safe training around heat.",
    topics: ["WBGT estimate", "48-hour outlook", "ACSM flag guidance"],
    category: "tools",
  },
];

export const sectionMap = new Map(
  sections.map((section) => [section.slug, section]),
);

export const categoryMap = new Map(
  categories.map((category) => [category.slug, category]),
);

export function sectionsInCategory(categorySlug: string): Section[] {
  return sections.filter((section) => section.category === categorySlug);
}
