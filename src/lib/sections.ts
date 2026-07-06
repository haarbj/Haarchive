export type Section = {
  slug: string;
  title: string;
  mission: string;
  topics: string[];
};

export const sections: Section[] = [
  {
    slug: "about",
    title: "About",
    mission:
      "My journey as a Division I runner, marathoner, lifelong student of the sport, and coach.",
    topics: ["Division I background", "Marathon focus", "Coaching and mentorship"],
  },
  {
    slug: "training-philosophy",
    title: "Training Philosophy",
    mission:
      "Core beliefs about endurance development through patience, consistency, and first-principles thinking.",
    topics: ["Individualization", "Long-term development", "Decision frameworks"],
  },
  {
    slug: "the-aerobic-base",
    title: "The Aerobic Base",
    mission:
      "Why aerobic fitness is the foundation of endurance performance and long-term progression.",
    topics: ["Mileage progression", "Easy running", "Durability"],
  },
  {
    slug: "exercise-physiology",
    title: "Exercise Physiology",
    mission:
      "First-principles explanations of VO₂ max, threshold, fatigue, adaptation, and biomechanics.",
    topics: ["Energy systems", "Muscle fibers", "Recovery biology"],
  },
  {
    slug: "coaching-library",
    title: "Coaching Library",
    mission:
      "Comparative study of influential coaching systems and shared principles across eras.",
    topics: ["Lydiard", "Daniels", "Canova and modern systems"],
  },
  {
    slug: "sports-psychology",
    title: "Sports Psychology",
    mission:
      "How confidence, motivation, identity, and resilience shape championship performance.",
    topics: ["Mental toughness", "Intrinsic motivation", "Pressure management"],
  },
  {
    slug: "the-philosophy-of-running",
    title: "The Philosophy of Running",
    mission:
      "Long-form essays on meaning, mastery, suffering, purpose, and character in the running life.",
    topics: ["Mastery", "Identity", "Purpose"],
  },
  {
    slug: "marathon-training",
    title: "Marathon Training",
    mission:
      "Structured marathon cycles with practical frameworks for workouts, fueling, tapering, and race execution.",
    topics: ["Workouts", "Fueling", "Race strategy"],
  },
  {
    slug: "workout-library",
    title: "Workout Library",
    mission:
      "Workout references organized by objective, adaptation target, and training phase.",
    topics: ["Aerobic sessions", "Threshold sessions", "Specificity"],
  },
  {
    slug: "training-plans",
    title: "Training Plans",
    mission:
      "Progressive plans from beginner to elite for cross country, 5K, 10K, half marathon, and marathon.",
    topics: ["Beginner to elite", "Race-specific plans", "Progression"],
  },
  {
    slug: "recovery",
    title: "Recovery",
    mission:
      "Sustainable performance through sleep, nutrition, strength, mobility, and injury prevention.",
    topics: ["Sleep and stress", "Nutrition", "Injury prevention"],
  },
  {
    slug: "data-and-analytics",
    title: "Data & Analytics",
    mission:
      "Use heart rate, pace, and training data to support sound coaching judgment.",
    topics: ["Training zones", "Race analytics", "Technology with context"],
  },
  {
    slug: "research-library",
    title: "Research Library",
    mission:
      "Summaries of books, papers, and historical methods that shaped distance running knowledge.",
    topics: ["Scientific papers", "Coaching texts", "Emerging research"],
  },
  {
    slug: "articles",
    title: "Articles",
    mission:
      "Educational writing that connects physiology, psychology, and philosophy to practical training.",
    topics: ["Deep dives", "Practical lessons", "Applied theory"],
  },
  {
    slug: "resources",
    title: "Resources",
    mission:
      "Curated books, podcasts, tools, and references for lifelong learning in the sport.",
    topics: ["Reading list", "Tools", "External references"],
  },
  {
    slug: "contact",
    title: "Contact",
    mission:
      "Reach out for coaching questions, collaborations, speaking, and long-term development support.",
    topics: ["Coaching inquiries", "Collaborations", "Speaking"],
  },
];

export const sectionMap = new Map(sections.map((section) => [section.slug, section]));
