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
  | { type: "list"; items: string[] };

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
    slug: "about",
    title: "About",
    mission:
      "My journey as a Division I runner, marathoner, lifelong student of the sport, and coach.",
    topics: [
      "Division I background",
      "Marathon focus",
      "Coaching and mentorship",
    ],
    category: "foundations",
  },
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
    ],
  },
  {
    slug: "the-philosophy-of-running",
    title: "The Philosophy of Running",
    mission:
      "Long-form essays on meaning, mastery, suffering, purpose, and character in the running life.",
    topics: ["Mastery", "Identity", "Purpose"],
    category: "foundations",
  },
  {
    slug: "exercise-physiology",
    title: "Exercise Physiology",
    mission:
      "First-principles explanations of VO₂ max, threshold, fatigue, adaptation, and biomechanics.",
    topics: ["Energy systems", "Muscle fibers", "Recovery biology"],
    category: "the-science",
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
    ],
  },
  {
    slug: "research-library",
    title: "Research Library",
    mission:
      "Summaries of books, papers, and historical methods that shaped distance running knowledge.",
    topics: ["Scientific papers", "Coaching texts", "Emerging research"],
    category: "the-science",
  },
  {
    slug: "data-and-analytics",
    title: "Data & Analytics",
    mission:
      "Use heart rate, pace, and training data to support sound coaching judgment.",
    topics: ["Training zones", "Race analytics", "Technology with context"],
    category: "the-science",
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
      { type: "heading", text: "Identical Workouts, Different Outcomes" },
      {
        type: "paragraph",
        text: "At the '64 Tokyo Olympics, Lydiard's athletes ran a hard session of 20 quarter-miles. The next day, a rival Canadian runner watched them, then ran the exact same session himself. Asked what he thought of it, Lydiard said, \"I think it was the last nail in his coffin.\" His own athletes had needed that session; the Canadian didn't — he missed his event's final while Snell and Davies medaled. Good training and bad training can look identical on paper. What matters is whether that specific athlete needed it.",
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
      { type: "heading", text: "Racing the Last 25%" },
      {
        type: "paragraph",
        text: "A more useful question than pace splits: how long can this athlete actually think clearly under race stress? Mental fatigue tends to hit early, so if all the concentration gets spent in the first mile, there's nothing left for the finish. The fix is to bookend the effort — a controlled open, a quiet middle third that conserves mental energy, and a hard, deliberate close — decided before the start. Changing strategy mid-race rarely works.",
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
      { type: "heading", text: "Dialing In a Tempo Run" },
      {
        type: "paragraph",
        text: "A tempo run works best around 20–24 minutes of sustained effort, held at roughly a 6 out of 10 perceived effort — hard enough to be real work, controlled enough that you could keep going if you had to. Struggling to hold pace past 7–9 minutes in is the signal to back off, not push through: the point is time spent at the right intensity, not a number on the watch. Full duration at the correct effort beats redlining for half the time, usually within months.",
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
      { type: "heading", text: "Keep a Log, Not a Comparison Tool" },
      {
        type: "paragraph",
        text: "The strongest predictor of long-term success isn't raw talent — it's having a coach, a team, and a training log. Write the week's goals at the top of each page, note anything that isn't going well plus your own best guess at a solution, and write down what went right and why. Apps that let you compare your splits against everyone else's turn your own training into someone else's competition. Keep the comparison out of it.",
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
    ],
  },
  {
    slug: "articles",
    title: "Articles",
    mission:
      "Educational writing that connects physiology, psychology, and philosophy to practical training.",
    topics: ["Deep dives", "Practical lessons", "Applied theory"],
    category: "writing-and-resources",
  },
  {
    slug: "resources",
    title: "Resources",
    mission:
      "Curated books, podcasts, tools, and references for lifelong learning in the sport.",
    topics: ["Reading list", "Tools", "External references"],
    category: "writing-and-resources",
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
