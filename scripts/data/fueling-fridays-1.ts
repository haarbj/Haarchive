// Fueling Fridays #1: Carbohydrate Absorption and Delivery. See
// scripts/seed-fueling-fridays-1.ts for how this gets written to the
// database.
//
// Revision history worth knowing: the first draft carried bracketed [n]
// inline citation markers and several claims stated more absolutely than
// the underlying research supports (a fixed "tripling concentration halves
// emptying" rule, an 80% VO2max "cliff," fixed liver-uptake percentages,
// rigid pre-workout/recovery starch timing rules). A close editorial and
// scientific review corrected all of that: inline citation markers were
// removed in favor of the numbered Sources list alone, several paragraphs
// were rewritten to qualify causal/performance claims honestly, and every
// reference below was checked against its actual publication (title,
// author list, journal, volume/issue/pages, and DOI where one exists) --
// not just its abbreviated form. Two references that could not be
// verified against a real publication under their original title/author
// pairing (a "Foster C" gastric-emptying paper and a "Malone JJ 2021" GI-
// symptoms paper) were replaced with verified papers that support the same
// claims; one reference ("Zhu J et al. 2023") could not be confirmed to
// exist under that title/author pairing and was dropped rather than kept
// on faith, since the starch-classification claims it was attached to are
// already well supported by the remaining, verified starch references.
import type { ContentBlock } from "@/lib/sections";

export const ARTICLE_TITLE = "Carbohydrate Absorption and Delivery";
export const ARTICLE_SUBTITLE = "Fueling Fridays #1: how carbohydrate travels from your stomach to your working muscles.";
export const ARTICLE_TAGS = ["fueling fridays", "fueling", "nutrition", "marathon"];

export type CitationInput = {
  paperTitle: string;
  authors: string;
  year: number;
  linkOrDoi: string | null;
};

// A verified, standardized reference list -- see this file's header comment.
// The article body no longer carries inline [n] markers; this list
// documents the sources the article draws on, rendered as the numbered
// "Sources" list by src/components/article-citations.tsx. Journal,
// volume/issue, and page range are folded into paperTitle (the schema has
// no separate fields for them), so the rendered line reads as a complete
// citation: "Authors. Title. Journal. Vol(Issue):Pages (Year). DOI".
export const CITATIONS: CitationInput[] = [
  {
    paperTitle:
      "Some changes in the chemical constituents of the blood following a marathon race: with special reference to the development of hypoglycemia. JAMA. 82(22):1778-1779",
    authors: "Levine SA, Gordon B, Derick CL",
    year: 1924,
    linkOrDoi: "https://doi.org/10.1001/jama.1924.02650480034015",
  },
  {
    paperTitle:
      "Sugar content of the blood in runners following a marathon race: with especial reference to the prevention of hypoglycemia: further observations. JAMA. 85(7):508-509",
    authors: "Gordon B, Kohn LA, Levine SA, Matton M, Scriver WDM, Whiting WB",
    year: 1925,
    linkOrDoi: "https://doi.org/10.1001/jama.1925.02670070028009",
  },
  {
    paperTitle:
      "The ergogenic effects of acute carbohydrate feeding on endurance performance: a systematic review, meta-analysis and meta-regression. Critical Reviews in Food Science and Nutrition. 64(30)",
    authors: "Ramos Campo DJ, Clemente-Suárez VJ, Cupeiro R, Benítez-Muñoz JA, Andreu-Caravaca L, Rubio-Arias JÁ",
    year: 2024,
    linkOrDoi: "https://doi.org/10.1080/10408398.2023.2233633",
  },
  {
    paperTitle: "Effects of acute carbohydrate supplementation on endurance performance: a meta-analysis. Sports Medicine. 41(9):773-792",
    authors: "Vandenbogaerde TJ, Hopkins WG",
    year: 2011,
    linkOrDoi: "https://doi.org/10.2165/11590520-000000000-00000",
  },
  {
    paperTitle: "Gastric emptying with repeated drinking during running and bicycling. International Journal of Sports Medicine. 11(3):238-243",
    authors: "Rehrer NJ, Brouns F, Beckers EJ, ten Hoor F, Saris WHM",
    year: 1990,
    linkOrDoi: "https://doi.org/10.1055/s-2007-1024799",
  },
  {
    paperTitle: "Gastric emptying, absorption, and carbohydrate oxidation during prolonged exercise. Journal of Applied Physiology. 72(2):468-475",
    authors: "Rehrer NJ, Wagenmakers AJM, Beckers EJ, Halliday D, Leiper JB, Brouns F, Maughan RJ, Westerterp K, Saris WHM",
    year: 1992,
    linkOrDoi: "https://doi.org/10.1152/jappl.1992.72.2.468",
  },
  {
    paperTitle:
      "Gastric emptying during walking and running: effects of varied exercise intensity. European Journal of Applied Physiology and Occupational Physiology. 58(4):440-445",
    authors: "Neufer PD, Young AJ, Sawka MN",
    year: 1989,
    linkOrDoi: "https://doi.org/10.1007/BF00643522",
  },
  {
    paperTitle:
      "Systematic review: exercise-induced gastrointestinal syndrome, implications for health and intestinal disease. Alimentary Pharmacology & Therapeutics. 46(3):246-265",
    authors: "Costa RJS, Snipe RMJ, Kitic CM, Gibson PR",
    year: 2017,
    linkOrDoi: "https://doi.org/10.1111/apt.14157",
  },
  {
    paperTitle:
      "Carbohydrate and exercise performance: the role of multiple transportable carbohydrates. Current Opinion in Clinical Nutrition and Metabolic Care. 13(4):452-457",
    authors: "Jeukendrup AE",
    year: 2010,
    linkOrDoi: "https://doi.org/10.1097/MCO.0b013e328339de9f",
  },
  {
    paperTitle: "Initial splanchnic extraction of ingested glucose in normal man. Metabolism. 27(6):657-669",
    authors: "Radziuk J, McDonald TJ, Rubenstein D, Dupré J",
    year: 1978,
    linkOrDoi: "https://doi.org/10.1016/0026-0495(78)90003-3",
  },
  {
    paperTitle: "The role of the liver in the homeostasis of blood glucose. Current Topics in Cellular Regulation. 11:51-97",
    authors: "Stalmans W",
    year: 1976,
    linkOrDoi: null,
  },
  {
    paperTitle: "Metabolic response to [13C]glucose and [13C]fructose ingestion during exercise. Journal of Applied Physiology. 61(3):1180-1184",
    authors: "Massicotte D, Péronnet F, Allah C, Hillaire-Marcel C, Ledoux M, Brisson G",
    year: 1986,
    linkOrDoi: "https://doi.org/10.1152/jappl.1986.61.3.1180",
  },
  {
    paperTitle:
      "Fructose and glucose co-ingestion during prolonged exercise increases lactate and glucose fluxes and oxidation compared with an equimolar intake of glucose. American Journal of Clinical Nutrition. 92(5):1071-1079",
    authors: "Lecoultre V, Benoit R, Carrel G, Schutz Y, Millet GP, Tappy L, Schneiter P",
    year: 2010,
    linkOrDoi: "https://doi.org/10.3945/ajcn.2010.29566",
  },
  {
    paperTitle:
      "Is there a specific role for sucrose in sports and exercise performance? International Journal of Sport Nutrition and Exercise Metabolism. 23(6):571-583",
    authors: "Wallis GA, Wittekind A",
    year: 2013,
    linkOrDoi: "https://doi.org/10.1123/ijsnem.23.6.571",
  },
  {
    paperTitle: "Carbohydrate and noncarbohydrate sweeteners. In: Carbohydrate Chemistry for Food Scientists, 3rd ed. AACC International Press; pp. 371-399",
    authors: "BeMiller JN",
    year: 2019,
    linkOrDoi: null,
  },
  {
    paperTitle: "The classification and measurement of dietary carbohydrates. Food Chemistry. 57(1):15-21",
    authors: "Englyst HN, Hudson GJ",
    year: 1996,
    linkOrDoi: "https://doi.org/10.1016/0308-8146(96)00056-8",
  },
  {
    paperTitle: "Resistant starch intakes in the United States. Journal of the American Dietetic Association. 108(1):67-78",
    authors: "Murphy MM, Douglass JS, Birkett A",
    year: 2008,
    linkOrDoi: "https://doi.org/10.1016/j.jada.2007.10.012",
  },
  {
    paperTitle: "Starch analysis in food. In: Encyclopedia of Analytical Chemistry. John Wiley & Sons; pp. 4246-4262",
    authors: "Englyst KN, Englyst HN",
    year: 2006,
    linkOrDoi: "https://doi.org/10.1002/9780470027318.a1029",
  },
  {
    paperTitle: "Slowly digestible starch: its structure and health implications, a review. Trends in Food Science & Technology. 18(7):346-355",
    authors: "Lehmann U, Robin F",
    year: 2007,
    linkOrDoi: "https://www.sciencedirect.com/science/article/abs/pii/S0924224407000817",
  },
];

export const CONTENT: ContentBlock[] = [
  {
    type: "paragraph",
    text: "In 1924, the doctors staffing the finish line at the Boston Marathon noticed something they hadn't expected: how a runner looked and felt after the race tracked closely with a number they could measure in a blood sample. The winner, Clarence DeMar, crossed the line with normal blood glucose and a world's best time of 2:29:40, and he felt good. Other finishers weren't so lucky. Runners with low blood glucose were pale, weak, and confused. The lowest reading the medical team recorded that day belonged to a runner who had to be carried into the medical tent completely unconscious.",
  },
  { type: "figure", figureId: "boston-marathon-fueling" },
  {
    type: "paragraph",
    text: "The following year, that same medical team followed up with a nutritional intervention that was among the earliest documented attempts to prevent marathon hypoglycemia through deliberate fueling. Runners were advised to eat carbohydrate-rich food before the race and were given candy to consume during it. The investigators reported improved post-race condition and an average improvement in finishing time of approximately ten minutes. This was an observational follow-up, not a randomized or controlled trial, so the time difference cannot be attributed to carbohydrate alone. Still, the experiment anticipated a principle that a century of sports nutrition research has since supported: making carbohydrate available during prolonged exercise can improve endurance performance, particularly when the effort lasts long enough for endogenous carbohydrate availability to become limiting.",
  },
  {
    type: "paragraph",
    text: "Controlled endurance studies have consistently found performance benefits from carbohydrate ingestion, although the magnitude varies substantially with exercise duration, intensity, fueling strategy, and the performance test used. The results from cycling studies are informative, but they should not be treated as a universal percentage improvement for marathon runners. For an individual runner, the practical benefit depends on how much carbohydrate can be delivered and used without causing gastrointestinal distress.",
  },
  {
    type: "paragraph",
    text: "The mechanism is straightforward in outline: carbohydrate you eat during a race is exogenous fuel, meaning it comes from outside your body rather than from the glycogen already stored in your muscles and liver. Burning it lets you sustain a higher rate of carbohydrate oxidation for longer, which matters because carbohydrate yields more energy per liter of oxygen consumed than fat does. That efficiency advantage is small at any given moment, but it compounds over 26.2 miles, and it becomes decisive once your endogenous glycogen starts running low in the back half of the race. None of that happens automatically, though. Eating a gel is not the same thing as fueling your muscles. Between the two sits a chain of physiological steps, each one capable of becoming the bottleneck, and understanding that chain is what separates a fueling strategy that works from one that just sounds reasonable on paper.",
    linkHref: "/exercise-physiology",
    linkText: "See how carbohydrate and fat oxidation actually compare",
  },
  { type: "heading", text: "The first bottleneck: getting out of your stomach", level: 2 },
  {
    type: "paragraph",
    text: "Whatever you swallow during a run sits in your stomach until it's released into the small intestine, where absorption actually happens. That release rate is called gastric emptying, and it's the first place a fueling plan can go wrong. Early sports nutrition research found something that seems backward at first: dilute carbohydrate solutions generally empty from the stomach faster than more concentrated ones. If your main goal is fluid delivery, that can be advantageous. But gastric emptying rate and carbohydrate delivery rate are not the same thing. A concentrated drink contains more carbohydrate per unit of fluid, so even if it empties more slowly, it may deliver more carbohydrate to the small intestine over a given period. Whether it actually does so depends on the concentration, carbohydrate source, volume consumed, and exercise conditions. The relationship is not linear, and a more concentrated drink is not automatically a faster or better-fueled option.",
  },
  {
    type: "paragraph",
    text: "This is part of the logic behind gels and concentrated fueling products. They allow runners to consume substantial amounts of carbohydrate without having to drink a correspondingly large volume of fluid. But concentration is a trade-off, not an unconditional advantage. A gel still needs to be tolerated, hydrated appropriately when necessary, and delivered through the stomach and small intestine. The practical goal is not to maximize concentration; it is to find the combination of carbohydrate source, fluid, and intake rate that delivers usable fuel without compromising gastrointestinal comfort.",
  },
  { type: "heading", text: "When intensity becomes the real problem", level: 2 },
  {
    type: "paragraph",
    text: "Much of the foundational research on gastric emptying was conducted at easy to moderate effort, somewhere in the range of 45 to 70 percent of VO2max. That's informative, but it undersells what a marathon actually demands: a well-trained runner can hold something close to 80 percent of VO2max for the entire distance, and higher exercise intensities are consistently associated with slower gastric emptying. As running intensity rises, more blood is redirected away from the gastrointestinal tract and toward the working muscles, and the resulting drop in gut blood flow is one plausible explanation for the familiar trio of bloating, nausea, and diarrhea at hard efforts. Exactly where that slowdown becomes noticeable isn't a fixed line; it varies with the individual runner, the fueling strategy, and conditions on the day.",
  },
  { type: "figure", figureId: "gastric-emptying-explorer" },
  {
    type: "paragraph",
    text: "What the research also shows, and what the chart above is built to illustrate, is that this decline isn't uniform from one runner to the next. Some people hold onto a reasonably functional gut at hard marathon effort. Others start struggling at a much lower intensity. That spread is a large part of why one runner has what feels like an iron stomach while another can barely choke down a gel without regretting it a mile later, and it means a single universal fueling target was never going to fit everyone. Heat and humidity pile onto the same problem: both are known to slow gastric emptying further, so a fueling rate you handle fine on a cool morning long run might not survive a hot afternoon race. If you find yourself struggling on a hot day, the honest fix usually isn't willpower. It's backing off your intake rate or switching to a more dilute source of carbohydrate until conditions or your own gut adaptation catch up.",
    linkHref: "/heat-tracker",
    linkText: "Check race-day WBGT conditions with the Heat Tracker",
  },
  { type: "heading", text: "The small intestine: where the paths split", level: 2 },
  {
    type: "paragraph",
    text: "Once carbohydrate clears the stomach, its fate depends on exactly what kind of sugar it is, because different sugars take genuinely different routes through the small intestine and the liver. The three simple sugars relevant to fueling are glucose, fructose, and sucrose (which is just the two of them bonded together), and the first two use completely separate absorption machinery.",
  },
  {
    type: "paragraph",
    text: "Glucose is the default currency of cellular energy, the molecule virtually every cell in your body, muscle included, is built to burn directly. It's the base ingredient in essentially every sports drink, gel, and energy chew on the market, and it's also the building block complex carbohydrates are made from. Glucose crosses into the small intestine's blood supply through a specific transporter, SGLT1, and from there travels to the liver before reaching general circulation. How much of that glucose the liver keeps for its own glycogen store isn't a fixed fraction: it depends on things like how depleted liver glycogen already is, how much glucose arrives at once, and your metabolic state at the time, though studies following an oral glucose load have generally found the liver capturing somewhere on the order of 10 to 30 percent, with the rest reaching the bloodstream, where rising glucose levels signal your muscles to shift toward burning more carbohydrate and less fat. The liver also responds by dialing back its own glucose production from stored glycogen, which has the effect of conserving those liver stores for later. The whole trip, from swallowing to a usable rise in blood glucose at the muscle, takes roughly 20 to 30 minutes, and the rate-limiting step in that chain is intestinal absorption itself, not digestion or circulation. You can see this clearly in a lab setting: infusing glucose directly into the bloodstream during exercise produces a much higher rate of carbohydrate oxidation than drinking the equivalent amount ever does, because an IV skips the intestinal bottleneck entirely. One consequence worth knowing: since that bottleneck is set by how many glucose transporters line your intestine, and larger and smaller runners have roughly the same number of them, your optimal carbohydrate intake rate isn't really a function of body size. It's a function of gut capacity, which is a different thing.",
  },
  {
    type: "paragraph",
    text: "Fructose, the sugar naturally abundant in fruit, differs from glucose by a single molecular detail but ends up somewhere entirely different once it's inside you. It's absorbed through its own separate transporter, and where glucose mostly passes through the liver on its way to general circulation, fructose gets grabbed by the liver at a much higher rate. The exact share varies by study and by individual, but a substantial majority, commonly cited around 85 to 90 percent of what's ingested, is typical. Inside the liver, that fructose gets converted into a mix of glucose, lactate, and liver glycogen, and the balance among the three shifts with conditions like how much fructose arrives, how depleted liver glycogen already is, and the pace of ingestion; studies have reported roughly comparable thirds going to each of glucose, lactate, and glycogen as one representative pattern, not a fixed rule. The glucose and lactate both get released back into the bloodstream, ready to be burned by working muscle, while the glycogen stays stored in the liver, at least until it's needed later and broken back down into glucose itself.",
  },
  {
    type: "paragraph",
    text: "Two things about that fructose pathway are worth sitting with. First, lactate shows up again as a genuine fuel shuttle here, ferrying energy from a gel or drink to the muscle doing the work, which is one more example of lactate behaving as a resource rather than the metabolic waste product it's often mistaken for. It's been proposed that runners with a greater capacity to shuttle lactate around the body might get more out of fructose-containing fuel than runners with a lower capacity, but that particular explanation for individual differences is speculative, not established fact, and I want to be clear about that distinction rather than presenting it as settled. Second, and much more practically useful: because fructose enters through a transporter completely separate from glucose's, your gut can run both absorption pathways at once. Combine the two sugars and you can absorb and burn more total carbohydrate per hour than an equivalent amount of either sugar alone would allow.",
  },
  { type: "figure", figureId: "carbohydrate-transport-diagram" },
  { type: "heading", text: "Why fueling mixes glucose and fructose", level: 2 },
  {
    type: "paragraph",
    text: "That two-transporter mechanism is the actual reason modern fueling products so often combine glucose (or maltodextrin, which behaves like glucose once digested) with fructose, rather than relying on one sugar alone. [Nutrition & Fueling](/nutrition-and-fueling) already covers the practical side of this in detail, including the specific ratios products use and how much total carbohydrate a given session actually calls for, so I won't repeat that ground here. The mechanism underneath it is what this section is about: using two transporters raises the ceiling on how much carbohydrate you can absorb and oxidize per hour, but it doesn't remove the other limits already covered above. Gastric emptying still has to cooperate. Your gut still has to tolerate the intensity and the heat. A glucose-fructose blend widens one specific bottleneck; it doesn't eliminate the pipe it's flowing through.",
  },
  { type: "heading", text: "Sucrose, maltodextrin, and starch: not all complex carbs are the same", level: 2 },
  {
    type: "paragraph",
    text: "Sucrose is ordinary table sugar, and at the molecular level it's nothing more than a glucose molecule and a fructose molecule bonded together. An enzyme in your small intestine breaks that bond almost immediately, so eating sucrose has essentially the same practical effect as drinking a pre-mixed one-to-one blend of glucose and fructose. It's a genuinely simple, genuinely effective fueling source for exactly that reason.",
  },
  {
    type: "paragraph",
    text: "Complex carbohydrates are longer chains of glucose molecules strung together, and they have an undeserved reputation for being uniformly slow to digest. That reputation doesn't hold up. Maltodextrin, a common ingredient in gels and drink mixes, is a complex carbohydrate made of short chains, no more than about 20 glucose units long, and the same intestinal enzymes that split sucrose apart make quick work of it too. The result is an absorption profile that looks a lot like glucose's own, not like a slow-release starch. Other starches, the kind found in potatoes, wheat, and oats, are built from far longer chains, anywhere from a few hundred to several million glucose units, and how fast they digest depends entirely on how readily your digestive enzymes can take those chains apart.",
  },
  {
    type: "paragraph",
    text: "Food scientists sort starch into three categories based on exactly that: rapidly digestible, slowly digestible, and resistant starch, and most real foods are some mixture of all three. Potato starch is almost entirely rapidly digestible, fully absorbed within about an hour of eating it. Pasta is different: roughly half its starch digests slowly, releasing glucose gradually over a few hours rather than in one hour-long burst. Resistant starch, true to its name, isn't digested in the small intestine at all. It behaves as dietary fiber, and beans, lentils, and split peas are particularly rich sources of it.",
  },
  {
    type: "paragraph",
    text: "Some foods change categories depending on how you treat them, which is a genuinely useful thing to know. Unripe bananas are high in resistant starch; ripe ones are almost entirely rapidly digestible. Raw oats keep over ten percent of their starch locked inside molecular bundles the enzymes in your gut can't reach, but cooking unfolds those bundles, and about three-quarters of the newly accessible starch becomes rapidly digestible, with the rest slowly digestible. Let those cooked oats cool back down, though, and a portion of that starch reverts to its resistant form. Potatoes, pasta, and rice behave the same way: cooling them after cooking pushes some of their starch back toward resistant.",
  },
  {
    type: "paragraph",
    text: "None of this makes complex carbohydrates wrong for fueling, and it doesn't make them uniformly right either. Digestion speed is one factor among several, alongside taste, tolerance, and how quickly the carbohydrate needs to be available, that can inform when a given starch makes sense. A rapidly digestible starch delivers glucose sooner; a slowly digestible one releases it more gradually over a longer window. Resistant starch behaves as dietary fiber rather than race fuel, supporting gut health through its effect on the microbiome, and most runners find it easier on the stomach away from a hard effort, the same way any high-fiber food is a common source of gastrointestinal discomfort close to intense exercise.",
    linkHref: "/recovery",
    linkText: "Read more on recovery nutrition timing",
  },
  { type: "heading", text: "From the gel to the finish line", level: 2 },
  {
    type: "paragraph",
    text: "Trace the whole path and it looks like this: a gel or drink leaves your stomach at a rate set by its concentration and your running intensity, splits in the small intestine according to which sugars it contains, gets partly filtered by the liver, and finally reaches circulation where your muscles can actually burn it. Each link in that chain can be the one that limits you on a given day. A concentrated fuel source that would otherwise deliver carbohydrate quickly does you no good if your effort is hard enough, or the day hot enough, to stall your gut. A perfectly tolerated gel still has to clear the intestinal bottleneck, which is exactly why blending glucose and fructose raises your ceiling instead of just changing your flavor options.",
  },
  {
    type: "paragraph",
    text: "That's the real answer to the question this article opened with. Why does something as ordinary as sugar move the needle on a marathon? Not because eating carbohydrate is magic, but because there's an entire supply chain standing between the gel in your hand and the muscle fiber that needs the energy inside it, and a good fueling strategy is really just a plan for keeping that supply chain open under race conditions. The 1924 doctors stumbled onto the outcome before anyone understood the mechanism. A century of physiology since has filled in the how. Future installments of Fueling Fridays will build on this foundation with the practical side: how much carbohydrate a given session actually calls for, how to train your gut to tolerate more of it, and what a real race-day fueling plan looks like when you put all of this together.",
    linkHref: "/marathon-pacing-calculator",
    linkText: "Plan your race-day pacing",
  },
  {
    type: "callout",
    variant: "takeaway",
    title: "Key Takeaways",
    items: [
      "Concentration is a trade-off: dilute drinks tend to empty from the stomach faster, but a concentrated gel or drink can still deliver more total carbohydrate to the small intestine, depending on the carbohydrate source, volume, and exercise conditions.",
      "Gastric emptying tends to slow as running intensity rises, and heat makes it worse, but how much it slows, and at what intensity, varies a great deal from runner to runner.",
      "Glucose and fructose use separate intestinal transporters, so combining them raises how much total carbohydrate you can absorb and oxidize per hour.",
      "The liver retains a portion of what you eat before it reaches circulation, more of fructose than of glucose, though the exact share varies by individual and by study rather than following a fixed rule.",
      "Maltodextrin behaves like glucose despite being a complex carbohydrate. Digestion speed differs among starches, but no single type is inherently right or wrong for fueling: it depends on when you need the carbohydrate available and how well you tolerate it.",
    ],
  },
];
