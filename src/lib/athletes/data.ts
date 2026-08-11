import type { Athlete } from "./types";

// The Athlete Library's founding roster: real, well-documented athletes
// whose coach (or coaching system) already has its own Coaching Library
// page, so the coach-history link on every one of these pages actually
// resolves somewhere real rather than dead-ending. This page exists to show
// how a coaching philosophy actually showed up in training -- never a
// biography for its own sake -- so every section below is either a direct
// consequence of that philosophy or omitted where this site doesn't have
// confidently-sourced detail. Never invent: results, times, quotes, or
// training specifics. Omit rather than speculate.
export const athletes: Athlete[] = [
  {
    slug: "peter-snell",
    name: "Peter Snell",
    country: "New Zealand",
    primaryEvents: "800m / 1500m / Mile",
    personalBests: [
      { event: "800m", time: "1:44.3 (world record, 1962)" },
      { event: "1500m", time: "3:38.1 (1964 Tokyo Olympic final)" },
      { event: "Mile", time: "3:54.1 (world record, 1964)" },
    ],
    majorResults: [
      { competition: "1960 Rome Olympics", result: "Gold, 800m" },
      { competition: "1964 Tokyo Olympics", result: "Gold, 800m and 1500m: the last man to complete that double" },
    ],
    oneLiner: "An 800m/1500m runner built on a marathoner's aerobic base.",
    philosophyNarrative: [
      "Snell was Arthur Lydiard's proof of concept: a middle-distance runner whose speed sat on top of the same aerobic volume Lydiard prescribed for marathoners. Nothing about Snell's natural talent was aerobic-base-shaped (he was a powerfully built 800m/1500m runner), which is exactly why his results carried so much weight for Lydiard's broader argument that aerobic development benefits every distance, not just long ones.",
      "The training itself followed Lydiard's full periodized sequence: a base phase of high-volume aerobic running (Snell's weeks reached 100 miles), a hill phase built around bounding and circuit training on genuinely steep terrain to build both aerobic power and leg strength, an anaerobic sharpening phase introducing track intervals only once that foundation was in place, and a short taper into racing. Snell never trained the qualities in reverse order: the aerobic base always came first, regardless of how short his competitive events were.",
      "He trained under Lydiard for his entire elite career, from the late 1950s through his retirement in 1965, so there's no coaching change to track here: the throughline is how consistently the same aerobic-first sequencing applied across two Olympic cycles and three individual events spanning 800m to the mile.",
    ],
    coachHistory: [
      {
        label: "Personal Coach",
        coachName: "Arthur Lydiard",
        coachSlug: "lydiard",
        years: "c. 1958–1965",
        whatChanged: "Snell's only coach for his entire elite career: there's no coaching transition in his story, only the same aerobic-first system applied across two Olympic cycles.",
      },
    ],
    signatureTraining: [
      { name: "100-Mile Weeks", description: "The base-phase backbone: high-volume, purely aerobic running, absorbed for months before any anaerobic work was introduced." },
      { name: "Hill Circuit Training", description: "Bounding, springing, and striding on genuinely steep terrain, three days a week once the hill phase began, building leg strength and aerobic power together.", workoutLibraryHref: "/workout-library#hill-circuit-training" },
      { name: "Track Sharpening", description: "Interval and anaerobic work introduced only in the final weeks before racing, once the aerobic and hill phases had already been absorbed." },
      { name: "Fixed Time Trial", description: "A single time trial mid-cycle used to check fitness honestly, rather than racing prematurely off an unfinished base." },
    ],
    famousSessions: [
      {
        name: "The Waiatarua Circuit",
        description: "A roughly 22-mile hilly loop through Auckland's Waitakere Ranges that Lydiard's squad, Snell included, used as a weekly long-run staple during the base phase: one of the most specifically documented sessions in Lydiard's whole system. Snell's own account of finishing it is unsentimental: \"Stupid, blind determination forced me on, reeling along the streets until, somehow, I made the Halberg home.\"",
        workoutLibraryHref: "/workout-library#three-ways-lydiard-used-a-hill",
      },
      {
        name: "The Mid-Buildup Marathon",
        description: "In the middle of his 1961-62 buildup, Snell entered an ordinary marathon: led through 20 miles, faded, and was reduced to walking by mile 24, finishing in 2:41 fully depleted. Ten weeks later, on January 27, 1962, he ran 3:54.4 for the mile, a world record. The marathon wasn't a detour from his 800m/1500m training, it was part of it: a single continuous effort long enough to exhaust slow-twitch glycogen stores and force fast-twitch fibers into aerobic-endurance service ahead of the record.",
      },
    ],
    physiologicalEmphasis: ["aerobicBase", "neuromuscularPower", "runningEconomy", "mentalPerformance"],
    mentalApproachSummary: [
      "Snell's own account of his training (in his autobiography, No Bugles, No Drums) emphasizes trust in the base-building process even when it felt disconnected from his actual races: running marathon-length weeks as a miler required believing in a system before it had proven itself on the track.",
    ],
    mentalQuotes: [
      {
        quote: "When it's pouring rain and you're bowling along through the wet, there's satisfaction in knowing you're out there and the others aren't.",
        context: "No Bugles, No Drums (autobiography)",
        theme: "consistency",
      },
      {
        quote: "You just shut off and focus and I think that's what helps to define those that can do it.",
        context: "on racing under pressure",
        theme: "handling pressure",
      },
      {
        quote: "If it wasn't for him giving me the inspiration and sound training, I wouldn't have done it.",
        context: "on Arthur Lydiard's influence",
        theme: "motivation",
      },
    ],
    recoveryNotes: [
      "Lydiard's system built recovery into the calendar itself rather than treating it as a separate practice: hard hill or track days were followed by genuinely easy aerobic days, with the phase structure (base, then hills, then anaerobic sharpening, then taper) itself acting as the long-range recovery plan.",
      "There's no record of Snell using anything resembling modern recovery technology (compression, ice baths, monitored sleep): in the Lydiard system of the early 1960s, getting the aerobic-to-hard-day sequencing right was the recovery plan.",
    ],
    crossLinks: [
      { label: "Arthur Lydiard's Coaching Philosophy", href: "/coaching-library/lydiard" },
      { label: "Aerobic Base", href: "/exercise-physiology" },
      { label: "Performing Under Pressure", href: "/performing-under-pressure" },
    ],
  },
  {
    slug: "deena-kastor",
    name: "Deena Kastor",
    country: "United States",
    primaryEvents: "Marathon",
    personalBests: [{ event: "Marathon", time: "2:19:36 (American record, London Marathon, 2006)" }],
    majorResults: [{ competition: "2004 Athens Olympics", result: "Bronze, Marathon (2:27:20)" }],
    oneLiner: "An Olympic marathon medal built on Joe Vigil's aerobic, technical, and mental coaching combined.",
    philosophyNarrative: [
      "Kastor's marathon results came from a genuinely three-part program, not aerobic volume alone. Vigil's altitude-based aerobic development at Alamosa, Colorado gave her the base every marathoner needs, but Kastor has repeatedly credited the other two pillars (dedicated technical form work addressing her own specific mechanics, and structured mental-preparation routines built into regular training rather than saved for race week) as equally responsible for her results.",
      "That combination is what she points to when explaining her jump from a solid but unspectacular track career to an American-record marathon and an Olympic medal: the aerobic base wasn't new, but training it alongside technical and psychological work at the same level of rigor was.",
      "Vigil was her coach through the peak of her marathon career, including both the 2004 Olympic bronze and the 2006 American record: there's no coaching change to track across that stretch, only the same three-part structure sustained over several years.",
    ],
    coachHistory: [
      {
        label: "Professional Marathon Coach",
        coachName: "Joe Vigil",
        coachSlug: "vigil",
        years: "late 1990s–2000s",
        whatChanged: "Vigil added dedicated technical-form and mental-preparation work on top of Kastor's existing aerobic training: a three-part structure she has directly credited for her results.",
      },
    ],
    signatureTraining: [
      { name: "Altitude Aerobic Volume", description: "The bulk of her training base, built at altitude in Alamosa, Colorado, following Vigil's own physiological-adaptation research." },
      { name: "Technical Form Sessions", description: "Dedicated sessions addressing her own specific running mechanics: not generic drills, but technical work targeted at her individual inefficiencies." },
      { name: "Mental-Preparation Routines", description: "Structured psychological work built into regular training weeks, not reserved for the days immediately before a race." },
    ],
    famousSessions: [
      {
        name: "London Marathon, 2006",
        description: "The race where she ran 2:19:36, the American record: the clearest single result tying Vigil's three-part program to an outcome.",
      },
    ],
    physiologicalEmphasis: ["aerobicBase", "runningEconomy", "biomechanics", "mentalPerformance"],
    mentalApproachSummary: [
      "Kastor has spoken publicly (including in her memoir, Let Your Mind Run) about deliberately shifting her facial expression and posture during the hardest, most painful stretches of a marathon: using a relaxed appearance to signal ease back to her own brain rather than waiting for the discomfort to pass on its own.",
    ],
    mentalQuotes: [
      {
        quote: "Your mindset is your life. It's the lens through which you see through, feel, and act.",
        theme: "identity",
      },
      {
        quote: "Marathons are extraordinarily difficult, but if you've got the training under your belt, and if you can run smart, the races take care of themselves.",
        theme: "race mindset",
      },
    ],
    recoveryNotes: [
      "Training at altitude in Alamosa required Vigil's program to manage recovery deliberately: altitude adds a real physiological stress on top of training load, so easy days and technical/mental work were used partly to let the aerobic volume absorb without compounding altitude stress and hard training on the same days.",
      "Kastor has described daily massage and a scheduled afternoon nap as literal line items in her training day, not optional extras: \"Before Piper, my day was eat, run, eat, massage, nap, eat, run, eat, sleep\", a routine built to absorb roughly 140-mile weeks. On body care generally, she's put it plainly: \"Body care isn't an indulgence, it's necessary. If you only have one hour to get in your morning run before work, run 50 minutes and stretch and self-massage for 10 minutes.\"",
    ],
    equipmentNotes: [
      "Kastor has raced as an ASICS-sponsored athlete for most of her professional career.",
    ],
    crossLinks: [
      { label: "Joe Vigil's Coaching Philosophy", href: "/coaching-library/vigil" },
      { label: "Aerobic Base", href: "/exercise-physiology" },
      { label: "Goal Setting & Identity", href: "/goal-setting" },
    ],
  },
  {
    slug: "moses-mosop",
    name: "Moses Mosop",
    country: "Kenya",
    primaryEvents: "Marathon",
    personalBests: [
      { event: "Marathon", time: "2:03:06 (Boston Marathon, 2011, not record-eligible due to the course)" },
      { event: "Marathon", time: "2:05:37 (Chicago Marathon, 2011)" },
    ],
    majorResults: [
      { competition: "2011 Boston Marathon", result: "2nd place, 2:03:06: among the fastest marathon times run to that point" },
      { competition: "2011 Chicago Marathon", result: "1st place, 2:05:37" },
    ],
    oneLiner: "A marathon debut built entirely on Canova's escalating race-pace density.",
    philosophyNarrative: [
      "Mosop's marathon results are one of the clearest demonstrations of Canova's core belief: that marathon fitness comes from accumulating time at or near actual race pace, not from a traditional aerobic-base-then-taper structure. As part of Canova's Kenyan training group, his buildup was organized around escalating 'special blocks': extended segments of running at marathon race pace, layered progressively closer together as the goal race approached.",
      "That structure is unusual by most marathon-training standards, which treat race-pace running as a late-cycle sharpening tool layered on top of a much larger aerobic base. Canova's special-block approach makes race-pace density itself the organizing principle of the whole buildup, with general aerobic running filling the space around it rather than the other way around.",
      "Mosop's 2011 season (a 2:03:06 in Boston and a 2:05:37 in Chicago in the same year, run as essentially a marathon debut at that level) is exactly the kind of result Canova's system is built to produce: extreme race-specific readiness arriving quickly, rather than being built up gradually over many marathon cycles.",
    ],
    coachHistory: [
      {
        label: "Marathon Coach",
        coachName: "Renato Canova",
        coachSlug: "canova",
        years: "2010s",
        whatChanged: "Mosop's entire marathon buildup was organized around Canova's special-block, race-pace-density structure rather than a conventional aerobic-base progression.",
      },
    ],
    signatureTraining: [
      { name: "Special Blocks", description: "Extended segments of running at or near marathon race pace, escalating in length and frequency as the goal race approaches: the organizing structure of the whole buildup." },
      { name: "General Aerobic Filler", description: "Easy aerobic running filling most non-special-block days, supporting the race-pace work rather than serving as the primary training stimulus." },
    ],
    famousSessions: [
      {
        name: "40 km Progression-Style Long Runs",
        description: "Long runs building through progressively faster segments toward marathon race pace, part of the special-block structure Canova's Kenyan group used to prepare for a specific goal marathon.",
      },
    ],
    physiologicalEmphasis: ["lactateThreshold", "runningEconomy", "aerobicBase"],
    mentalApproachSummary: [
      "Training inside Canova's Kenyan group meant regularly running special-block sessions alongside training partners targeting the same or faster marathon paces: a group-based, competitive daily environment rather than a solitary buildup.",
    ],
    mentalQuotes: [
      {
        quote: "There is not much symmetry in my training, so there is no real pattern there.",
        theme: "training mindset",
      },
      {
        quote: "I expected to run 2:06 or 2:07… The training was good, body and mind were strong, but I didn't dream of 2:03 or 2:04.",
        context: "on his 2:03:06 Boston Marathon debut, 2011",
        theme: "race mindset",
      },
    ],
    recoveryNotes: [
      "Because special blocks are run at genuine race pace rather than a moderate aerobic effort, recovery in Canova's system is managed by controlling how often and how long those blocks are, not by adding extra rest days: the general aerobic running around them is deliberately easy to let the race-pace work absorb.",
      "Mosop has been candid that even this system doesn't make an off-season free: \"When I take rest, it is hard to come back after off-season, legs feel empty, but soon all goes back to normal.\" Recovery within a training block is one thing, but rebuilding from genuine time off is its own, separately difficult process.",
    ],
    crossLinks: [
      { label: "Renato Canova's Coaching Philosophy", href: "/coaching-library/canova" },
      { label: "Lactate Threshold", href: "/exercise-physiology" },
    ],
  },
  {
    slug: "jakob-ingebrigtsen",
    name: "Jakob Ingebrigtsen",
    country: "Norway",
    primaryEvents: "1500m / 5000m",
    personalBests: [
      { event: "1500m", time: "3:26.73 (European record)" },
      { event: "5000m", time: "12:48.45 (European record)" },
    ],
    majorResults: [
      { competition: "2020 Tokyo Olympics", result: "Gold, 1500m (3:28.32, Olympic record)" },
      { competition: "2022 Eugene World Championships", result: "Gold, 5000m; Silver, 1500m" },
      { competition: "2023 Budapest World Championships", result: "Gold, 1500m and 5000m" },
    ],
    oneLiner: "The most visible athlete trained under double-threshold, lactate-tested Norwegian training.",
    philosophyNarrative: [
      "Ingebrigtsen is the clearest real-world example of the Norwegian System actually applied: two to three double-threshold days a week, each one controlled by in-session lactate testing rather than pace alone, plus one weekly 'X element' session (typically short hill sprints) providing a distinct stimulus outside the threshold/aerobic structure.",
      "What makes his case unusually well-documented is the direct, in-session physiological feedback loop: training paces are adjusted in real time against measured lactate values rather than fixed in advance, which is the core claim that separates the Norwegian System from a purely pace-prescribed approach like Daniels' VDOT tables.",
      "He trained under his father, Gjert Ingebrigtsen, from childhood through 2022, when he began training independently with a smaller support team. The double-threshold, lactate-tested structure itself has continued since: the coaching change didn't replace the underlying system, since Jakob was already central to how it was built and applied in his own training.",
    ],
    coachHistory: [
      {
        label: "Youth & Developmental Coach",
        coachName: "Gjert Ingebrigtsen (father)",
        coachSlug: "norwegian-system",
        years: "childhood–2022",
        whatChanged: "Introduced and built the double-threshold, lactate-tested structure that defines his training.",
      },
      {
        label: "Current",
        coachName: "Self-directed, with a small support team",
        years: "2022–present",
        whatChanged: "Continues the same double-threshold structure without his father as head coach.",
      },
    ],
    signatureTraining: [
      { name: "Double Threshold Days", description: "Two threshold-effort sessions in the same day, two to three days a week, each dosed and adjusted against measured lactate rather than pace alone.", workoutLibraryHref: "/workout-library#double-threshold-sessions" },
      { name: "Weekly X Element", description: "One session a week providing a distinct stimulus outside the threshold/aerobic structure: typically short hill sprints." },
      { name: "Easy Aerobic Filler", description: "Easy running filling the remaining days, supporting the threshold work without adding a competing stimulus." },
    ],
    famousSessions: [
      {
        name: "Double Threshold",
        description: "The signature structure of his entire training system: not a single named session, but the recurring two-a-day threshold format that defines the Norwegian System as applied to his career.",
        workoutLibraryHref: "/workout-library#double-threshold-sessions",
      },
    ],
    physiologicalEmphasis: ["lactateThreshold", "vo2max", "aerobicBase"],
    mentalApproachSummary: [
      "Ingebrigtsen has raced as the pre-race favorite in most major championships since 2021, which puts a specific mental demand on him distinct from a challenger's: controlling a race from the front, or reacting calmly to being outkicked (as happened against Jake Wightman's 1500m upset at the 2022 Worlds), rather than racing with nothing to lose.",
    ],
    mentalQuotes: [
      {
        quote: "It's very easy to be confident because I can just tell myself, 'I've done this thousand times.'",
        theme: "handling pressure",
      },
      {
        quote: "You can't pull the carrot from the ground to check if it's growing. You have to believe in the process and wait until it's proper and until it's finished.",
        theme: "consistency",
      },
      {
        quote: "I've never run faster in training than I do on race day.",
        context: "interview with David McCarthy",
        theme: "race mindset",
      },
      {
        quote: "One of the biggest mistakes that a lot of people do, is they go too hard in training. That's basically because of their mentality and what they're struggling with – they don't believe in themselves.",
        theme: "training mindset",
      },
    ],
    recoveryNotes: [
      "Because two threshold sessions in one day is a genuinely demanding structure, the Norwegian System depends on real-time lactate feedback to hold each session at a genuinely sustainable intensity: if measured lactate runs high, the session is adjusted down rather than pushed through, treating the lactate reading itself as a recovery-and-load-management tool, not just a training-intensity gauge.",
      "\"My tempo training is not that brutal. We always try to find the balance between rest and training, and after a lot of years with the same amount of activity, your body adapts and knows what it can handle,\" Ingebrigtsen has said of how the system avoids digging a fatigue hole despite its volume.",
      "In a February 2024 interview with NRK, he described his day-to-day recovery habits in concrete terms: sitting rather than standing when possible, eating immediately after training, prioritizing sleep, and staying off his phone for the hour before bed.",
    ],
    equipmentNotes: [
      "Ingebrigtsen races and trains in Nike shoes, one of the sport's most visible Nike-sponsored athletes.",
      "A portable blood-lactate analyzer is a routine part of his training kit: sessions are monitored with an earlobe or fingertip blood sample between intervals, not just a stopwatch.",
    ],
    crossLinks: [
      { label: "The Norwegian System's Coaching Philosophy", href: "/coaching-library/norwegian-system" },
      { label: "Lactate Threshold", href: "/exercise-physiology" },
      { label: "Performing Under Pressure", href: "/performing-under-pressure" },
    ],
  },
];

export const athleteMap = new Map(athletes.map((athlete) => [athlete.slug, athlete]));
