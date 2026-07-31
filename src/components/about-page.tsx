import Link from "next/link";

import { categories } from "@/lib/sections";
import { FeatureAnnouncementLoader as FeatureAnnouncement } from "@/components/feature-announcement-loader";
import { FeaturedEssay } from "@/components/featured-essay";
import { PullQuote } from "@/components/pull-quote";
import { Container } from "@/components/ui/container";
import { Diagram } from "@/components/ui/diagram";
import { Figure } from "@/components/ui/figure";
import { Heading } from "@/components/ui/heading";
import { ImageSlot } from "@/components/ui/image-slot";

const timeline: {
  label: string;
  note: string;
  linkHref?: string;
  linkText?: string;
  // A progression of small photos across the timeline, not one portrait --
  // per-stop guidance for whoever sources them, plus a short label for the
  // compact placeholder (see ImageSlot's compactLabel). Omitted on
  // "Stepping off the plan" on purpose: that stop is about reading, not a
  // place or moment with its own photo.
  photoAlt?: string;
  photoLabel?: string;
  photoCompactLabel?: string;
  // Root-relative path once a real file exists under public/homepage/ --
  // omitted keeps that stop on the ImageSlot placeholder.
  photoSrc?: string;
}[] = [
  {
    label: "Brophy College Prep, Arizona",
    note: "Four years of racing under Mike Scannell: the coach who took Grant Fisher from a sub-4 mile to Olympic medals in the 5,000m and 10,000m. I started as one of the slower runners on the team freshman year; the turning point was the summer after, spent training through Flagstaff's altitude, and I came back sophomore year a different runner. By senior year that had grown into roughly 70 miles a week of altitude training each summer, a state championship junior year (Brophy's first in 17 years), and a First-Team state medal senior year. What actually stuck, though, was the physiology and psychology I picked up from Scannell and camps like Project Gold and Anasazi, before I had the language for either.",
    photoAlt: "Brody Haar wearing a state championship medal at an AIA meet in Brophy colors",
    photoLabel: "High school era -- racing or training in Brophy colors, Flagstaff altitude camp if available.",
    photoCompactLabel: "Brophy",
    photoSrc: "/homepage/timeline-brophy.jpg",
  },
  {
    label: "Run22",
    note: "During COVID lockdowns junior year, with nowhere left to train together in person, I built an online community for runners in my graduating class on Strava. Run22 grew to nearly 400 members across 26 states, trading training questions and encouragement. It was the first time I noticed I liked the coaching and community side of the sport as much as the racing itself.",
    photoAlt: "The Run22 logo",
    photoLabel: "A screenshot of the Run22 Strava group, or a solo-training photo from the COVID lockdown era.",
    photoCompactLabel: "Run22",
    // The one logo in this progression rather than a photo -- Run22 is
    // Brody's own community, not a third-party mark, so it's a deliberate
    // exception to the "photo, not logo" rule the other stops follow.
    photoSrc: "/homepage/timeline-run22.jpg",
  },
  {
    label: "Vanderbilt, SEC cross country",
    note: "Studying applied math, computer science, German, and engineering management while training at a Division I level. It didn't go how I expected: a rigid, anaerobic-heavy program left me plateaued and anxious instead of improving, and by sophomore year I walked away from the team entirely.",
    linkHref: "/the-onus-to-quit",
    linkText: "Read the full story in Articles",
    photoAlt: "Brody Haar racing at the NCAA Cross Country South Region Championships in Vanderbilt colors",
    photoLabel: "Racing in Vanderbilt colors -- a cross country meet, ideally one that shows the SEC-level field.",
    photoCompactLabel: "Vanderbilt",
    photoSrc: "/homepage/timeline-vanderbilt.jpg",
  },
  {
    label: "Stepping off the plan",
    note: "Walking away from the team meant reading instead of just following a plan (Matt Fitzgerald's 80/20 Running, Phil Maffetone's MAF Method) and testing what I found, which is where the aerobic-first approach the rest of this site is built on actually started.",
  },
  {
    label: "Marathon training, on my own terms",
    note: "My first marathon, in Nashville, is where bodyweight strength work earned a permanent spot in how I build a buildup. I'd skipped enough of it in the lead-up that an injury three weeks out left me broken down by the second half of the race, which had nothing to do with how I paced it. Endurance without strength is a plan with a hole in it, and that's shaped how I train and coach ever since.",
    photoAlt: "Brody Haar crossing the finish line at the Nashville Rock 'n' Roll Marathon in Brophy colors",
    photoLabel: "Race day or a long-run training moment from the Nashville marathon buildup.",
    photoCompactLabel: "Marathon",
    photoSrc: "/homepage/timeline-marathon.jpg",
  },
  {
    label: "Coaching, and this archive",
    note: "I started by coaching a handful of Run22 members directly, and now coach the Vanderbilt Run Club through full and half marathon training. Alongside that, years of reading Lydiard, Daniels, Canova, and physiology papers side by side, trying to find where they agreed, and writing all of it down so I wouldn't have to re-derive it every time.",
    // Alt text describes the actual photo, not the aspirational "coaching"
    // framing -- it doesn't depict coaching (used anyway, per an explicit
    // call), so the alt text shouldn't claim it does.
    photoAlt: "Brody Haar seated on stone steps with a duffel bag",
    photoLabel: "Actively coaching -- a workout on the track, a race on the sideline, not a posed shot.",
    photoCompactLabel: "Coaching",
    photoSrc: "/homepage/timeline-coaching.jpg",
  },
];

const influences: { name: string; note: string }[] = [
  {
    name: "Stephen Seiler's Polarized Training",
    note: "The one I lean on most: roughly 80% of training time easy, 20% genuinely hard, almost nothing in between. I learned it from Matt Fitzgerald's book 80/20 Running.",
  },
  {
    name: "Arthur Lydiard",
    note: "Base before anything else: speed is common, endurance is rare.",
  },
  {
    name: "Jack Daniels",
    note: "Precision: pace zones anchored to measured physiology rather than feel.",
  },
  {
    name: "Renato Canova",
    note: "Marathon-specific blocks that blur the line between aerobic and threshold work.",
  },
  {
    name: "Joe Vigil",
    note: "Altitude, biomechanics, and the belief that the mental game is trainable like anything else.",
  },
  {
    name: "Steve Magness",
    note: "A physiologist's skepticism applied to coaching folklore: testing assumptions instead of repeating them.",
  },
  {
    name: "Norwegian threshold training",
    note: "Double-threshold days and obsessive lactate monitoring: proof that even \"easy\" training rewards measurement.",
  },
];

export function AboutPage() {
  return (
    <>
      {/* Full-width, so it renders outside Container (which caps width) --
          the one thing on this page not scoped to the reading column. */}
      <FeatureAnnouncement
        badge="New Tool"
        title="Environmental Performance Calculator"
        cta="Launch"
        href="/environmental-calculator"
      />

      <Container variant="content">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">
          Distance Running Knowledge Hub
        </p>
        <Heading className="mt-3">
          For runners who want to understand the sport at the deepest level.
        </Heading>
        <p className="mt-6 max-w-[66ch] text-xl leading-9 text-zinc-600 dark:text-zinc-300">
          The Haarchive is a long-term resource dedicated to the physiology,
          psychology, philosophy, and practice of distance running, helping
          athletes learn not only how to train, but how to think about
          training.
        </p>

        <FeaturedEssay
          href="/why-running-is-valuable-for-everyone"
          title="Why Running Is Valuable for Everyone"
          description="Running scales perfectly across ambition: the same physiology that produces an Olympic champion is what makes an easy run worth doing at all. A good place to start if you’re new here."
          ctaLabel="Read the essay →"
          // The article's own cover_image_url (queried directly from the
          // articles table) -- hardcoded rather than fetched at render time
          // since this component is otherwise entirely hand-authored,
          // static content (the timeline/influences arrays below are the
          // same). Update this if that article's cover image ever changes.
          imageUrl="https://ngfdyupjoeobdwxevmuo.supabase.co/storage/v1/object/public/article-images/44bd11c7-a5c5-4df9-bd82-a1c07b537d6f/e73b9be4-731c-4a7a-8ba9-34dfd52034f3.jpg"
        />

        <a
          href="#what-youll-find-here"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-700 transition hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white"
        >
          See what&rsquo;s here <span aria-hidden="true">↓</span>
        </a>

        {/* Tools & Accounts */}
      <section className="mt-16 border-t border-black/5 pt-14 dark:border-white/10">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">
          Tools &amp; accounts
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
          Free calculators. An optional account, if you want more.
        </h2>
        <div className="mt-6 max-w-[66ch] space-y-6 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          <p>
            Every calculator on this site, the{" "}
            <Link
              href="/pace-calculator"
              className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
            >
              Pace &amp; Heart Rate Calculator
            </Link>
            , the{" "}
            <Link
              href="/heat-tracker"
              className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
            >
              Heat Tracker
            </Link>{" "}
            works fully without an account. Nothing you enter is sent
            anywhere; it stays in your browser.
          </p>
          <p>
            Creating a free account, with an email and password or by
            signing in with Google, unlocks a dashboard: track a goal race,
            log recent results, and keep calculator results saved across
            visits instead of losing them when you close the tab. You can
            also connect a Strava account to link your training data.
          </p>
          <p>
            When you sign in with Google, we only ever request your name,
            email address, and profile photo: enough to create your
            account, nothing more. See exactly what&rsquo;s collected and
            why in the{" "}
            <Link
              href="/privacy-policy"
              className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        {/* A real result (18:30 5K -> Mile/10K equivalents, the actual
            written guidance), not placeholder zeros -- captured directly
            from the live results card, cropped to just that card.
            aspect="wide" (21:9), not "video" (16:9) -- the source screenshot
            is itself ~2:1, wider than 16:9, so a 16:9 box was cropping the
            left/right edges and cutting into the card's own text ("ENTERED
            PERFORMANCE" sits close to the card's left padding). 21:9 crops
            top/bottom instead, where there's padding to spare.
            No colored frame -- tried one (padding + tinted border) to signal
            "this is an image," but the results card already has its own
            ring styling baked into the captured pixels, and the two borders
            nested together read as a rendering glitch, not a deliberate
            frame. A caption does the same "this is a picture" job through
            text instead, without a second border competing with the first. */}
        <div className="mt-8 max-w-[66ch]">
          <Figure caption="A real result from the Pace & Heart Rate Calculator.">
            <ImageSlot
              kind="screenshot"
              aspect="wide"
              label="A real, cropped screenshot of a calculator's results panel -- the Pace & Heart Rate Calculator is the obvious pick, since it's the one named in the copy above. Framed plainly: no browser chrome, no device mockup."
              alt="Pace & Heart Rate Calculator results panel showing an entered performance of 18:30 for a cross country 5K, with estimated equivalent mile and 10K times"
              src="/homepage/calculator-screenshot.png"
            />
          </Figure>
        </div>
      </section>

      {/* Why This Exists */}
      <section className="mt-16 border-t border-black/5 pt-14 dark:border-white/10">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">
          Why this exists
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
          The gap between a reel and a research paper
        </h2>
        <div className="mt-6 max-w-[66ch] space-y-6 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          <p>
            Search &ldquo;how to run a marathon&rdquo; and you get two kinds
            of answers. One is a thirty-second video telling you to eat
            bananas and believe in yourself. The other is a peer-reviewed
            paper on substrate utilization that assumes you already have a
            physiology degree. Almost nothing sits between them: a place
            that explains why the banana works, in language built for someone
            who wants to train intelligently.
          </p>
          <p>
            That gap is what this site is trying to close. Every section
            here is built the same way: start with the mechanism (why
            oxygen delivery, muscle fiber type, or hormonal response works
            the way it does) and only then get to the workout it produces.
            The goal is to get you to the point where you could write your
            own plan, because you understand the system well enough to
            reason about it instead of just following it.
          </p>
        </div>

        {/* Diagram, not ImageSlot -- this is the priority visual type per
            the visual system doc: hand-authored inline SVG (one accent
            color, thin line art), not a raster file, so it costs nothing
            to ship and inherits dark mode through the site's own
            --accent-research/--muted/--heading custom properties rather
            than baked-in colors. Redrawn with named phase bands (Before /
            Training / Recovery / Supercompensation / Detraining) after the
            first version's plain workout/adaptation labels tested as too
            sparse against reference diagrams -- the bands are what make
            this legible as a *sequence*, not just a wiggle. Single accent
            color still holds (no red/yellow/green "too much / too little /
            just right" like some published versions of this chart use --
            that's a second idea, not this one). */}
        {/* mt-4, not the mt-8 every other slot on this page uses -- the
            diagram's own container already adds p-6, and the SVG's own
            phase-label row leaves another ~45px of headroom before the
            curve itself starts, so mt-8 on top of both stacked into a
            visibly large gap under the last paragraph. */}
        <div className="mt-4 max-w-[66ch]">
          <Figure caption="Illustrative, not measured data. A workout is a deliberate, temporary dip -- the adaptation only shows up during the rest that follows, and fades if nothing follows it.">
            <Diagram
              aspect="video"
              alt="A line diagram of the supercompensation curve: performance dips during training, recovers past its starting level during rest (supercompensation), then fades during detraining if not followed by another training stimulus"
            >
              <svg viewBox="0 0 640 360" className="h-full w-full" role="presentation">
                {/* Phase bands -- shaded only where something is actively
                    happening (Training, Supercompensation); Before/Recovery/
                    Detraining stay unshaded so the two active phases read as
                    the point of the chart. */}
                <rect x="140" y="55" width="120" height="275" fill="var(--accent-research)" opacity="0.07" />
                <rect x="380" y="55" width="80" height="275" fill="var(--accent-research)" opacity="0.07" />

                {/* Phase divider lines */}
                {[140, 260, 380, 460].map((x) => (
                  <line key={x} x1={x} y1="55" x2={x} y2="330" stroke="var(--muted)" strokeWidth="1" opacity="0.2" />
                ))}

                {/* Phase labels */}
                <text x="100" y="45" fontSize="13" fontWeight="600" textAnchor="middle" fill="var(--muted)" fontFamily="inherit">
                  Before
                </text>
                <text x="200" y="45" fontSize="13" fontWeight="600" textAnchor="middle" fill="var(--heading)" fontFamily="inherit">
                  Training
                </text>
                <text x="320" y="45" fontSize="13" fontWeight="600" textAnchor="middle" fill="var(--muted)" fontFamily="inherit">
                  Recovery
                </text>
                <text x="420" y="45" fontSize="13" fontWeight="600" textAnchor="middle" fill="var(--heading)" fontFamily="inherit">
                  Supercompensation
                </text>
                <text x="530" y="45" fontSize="13" fontWeight="600" textAnchor="middle" fill="var(--muted)" fontFamily="inherit">
                  Detraining
                </text>

                {/* Baseline -- starting performance level */}
                <line
                  x1="60"
                  y1="220"
                  x2="600"
                  y2="220"
                  stroke="var(--muted)"
                  strokeWidth="1.25"
                  strokeDasharray="4 5"
                  opacity="0.6"
                />
                <text x="60" y="238" fontSize="13" fill="var(--muted)" fontFamily="inherit">
                  starting level
                </text>

                {/* The curve: flat, then a dip through Training, a recovery
                    back past baseline, a peak at Supercompensation, and a
                    decline through Detraining -- showing the adaptation
                    fades if nothing follows it, not just that it happened
                    once. */}
                <path
                  d="M 60 220 C 100 220, 140 250, 170 275 C 195 292, 205 292, 230 280 C 260 260, 290 235, 320 220 C 350 200, 390 165, 420 150 C 440 140, 450 135, 460 135 C 490 137, 520 150, 550 168 C 570 180, 585 190, 600 195"
                  fill="none"
                  stroke="var(--accent-research)"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                />

                {/* Markers at the two named moments the labels above call
                    out: the low point of the dip, and the peak. */}
                <circle cx="210" cy="288" r="4" fill="var(--accent-research)" />
                <circle cx="460" cy="135" r="4" fill="var(--accent-research)" />

                {/* Axes */}
                <text x="600" y="352" fontSize="13" textAnchor="end" fill="var(--muted)" fontFamily="inherit">
                  time →
                </text>
                <text
                  x="30"
                  y="195"
                  fontSize="13"
                  textAnchor="middle"
                  fill="var(--muted)"
                  fontFamily="inherit"
                  transform="rotate(-90, 30, 195)"
                >
                  performance
                </text>
              </svg>
            </Diagram>
          </Figure>
        </div>
      </section>

      {/* My Story */}
      <section className="mt-14 border-t border-black/5 pt-14 dark:border-white/10">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">
          My story
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
          From racing to reverse-engineering why racing works
        </h2>
        <p className="mt-6 max-w-[66ch] text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          This is the record of a slow shift in what I was actually curious
          about.
        </p>

        {/* A small photo per stop, not one portrait -- the progression
            itself (Brophy -> Run22 -> Vanderbilt -> Marathon -> Coaching)
            is the point, the same way the timeline's own text already
            moves stop to stop. compact ImageSlots since five of these in a
            row need to be quick visual notes, not five repeated
            paragraphs of guidance -- the full guidance for each still
            lives in the timeline array above and in
            public/homepage/README.md. */}
        <ol className="mt-10 space-y-8 border-l border-black/10 pl-6 dark:border-white/10">
          {timeline.map((stop) => (
            <li key={stop.label} className="relative">
              <span className="absolute top-1.5 -left-[29px] h-2.5 w-2.5 rounded-full bg-zinc-900 dark:bg-white" />
              <div className={stop.photoAlt ? "flex items-start gap-4" : undefined}>
                {stop.photoAlt && stop.photoLabel ? (
                  <div className="w-14 shrink-0 sm:w-16">
                    <ImageSlot
                      compact
                      compactLabel={stop.photoCompactLabel}
                      kind="photo"
                      aspect="square"
                      alt={stop.photoAlt}
                      label={stop.photoLabel}
                      src={stop.photoSrc}
                      // Overrides ImageSlot's default `sizes` (tuned for a
                      // half/full-viewport image) -- this renders at a
                      // fixed ~64px regardless of viewport, so the default
                      // would make next/image fetch a far larger source
                      // than ever gets displayed.
                      sizes="64px"
                    />
                  </div>
                ) : null}
                <div>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                    {stop.label}
                  </h3>
                  <p className="mt-1 max-w-[62ch] text-zinc-600 dark:text-zinc-300">
                    {stop.note}
                    {stop.linkHref ? (
                      <>
                        {" "}
                        <Link
                          href={stop.linkHref}
                          className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
                        >
                          {stop.linkText}
                        </Link>
                        .
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-10 max-w-[66ch] text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          This is the record of a realization that crept up slowly: I was
          more interested in why a workout worked than in how fast I could
          run it.
        </p>
      </section>

      {/* How I Learn */}
      <section className="mt-14 border-t border-black/5 pt-14 dark:border-white/10">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">
          How I learn
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
          Comparing systems instead of picking one
        </h2>
        <p className="mt-6 max-w-[66ch] text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          I compare coaching systems instead of committing to one, and
          I&rsquo;m suspicious of anyone who does. The coaches and
          researchers below all built real, medal-winning methods, yet they
          disagree with each other: on how much of training should be
          aerobic base versus race-specific work, or how precisely intensity
          should be measured. Studying where they diverge teaches you more
          than adopting any one of them wholesale. If you pushed me to pick
          the one closest to what I actually believe, though, it&rsquo;s the
          80/20 principle (Stephen Seiler&rsquo;s research on polarized
          training, which I first ran into through Matt Fitzgerald&rsquo;s
          book of the same name), not because the others are wrong, but
          because that ratio is the version of &ldquo;mostly easy,
          occasionally hard&rdquo; that&rsquo;s held up best for me in
          practice.
        </p>

        {/* aspect="video" -- re-cropped to landscape (3005x1952, ~16:9-ish)
            since the original upload; full column width now that it's wide
            rather than a narrow width-constrained portrait box. Plain
            center crop (no objectPosition override) -- an 80%-biased crop
            overcorrected and cut off the top books instead. Center isn't
            perfect (a real crop of the source file would be, if this
            still bothers on review) but it's the safer default. */}
        <div className="mt-8 max-w-[66ch]">
          <Figure>
            <ImageSlot
              kind="archival"
              aspect="video"
              label="A real photo of the actual coaching/running books stacked -- Fitzgerald, Hutchinson, Daniels, Stulberg & Magness, and whatever else is genuinely on the shelf. The literal source material for this section, not a staged 'bookshelf' stock photo."
              alt="A stack of running and coaching books: How Bad Do You Want It?, The Competitive Edge, Endure, Peak Performance, Daniels' Running Formula, Running Rewired, and Training Young Distance Runners"
              src="/homepage/how-i-learn-books.jpg"
            />
          </Figure>
        </div>

        <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {influences.map((influence) => (
            <div key={influence.name}>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                {influence.name}
              </h3>
              <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                {influence.note}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 max-w-[66ch] text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          The interesting question is always &ldquo;what adaptation is this
          session actually trying to create,&rdquo; and every system above
          answers that a little differently. The full comparison lives in
          the{" "}
          <Link
            href="/coaching-library"
            className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
          >
            Coaching Library
          </Link>
          .
        </p>
      </section>

      {/* Coaching Philosophy */}
      <section className="mt-14 border-t border-black/5 pt-14 dark:border-white/10">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">
          Coaching philosophy
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
          Good coaching creates independent athletes
        </h2>
        <div className="mt-6 max-w-[66ch] space-y-6 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          <p>
            A workout is only half the transaction. The other half is
            understanding why it&rsquo;s there: what adaptation it&rsquo;s
            chasing, how to judge whether the body is actually absorbing it,
            when pushing through fatigue is productive and when it&rsquo;s
            just damage. A coach who only hands out the first half produces
            athletes who can follow a plan. A coach who teaches the second
            half produces athletes who can build their own.
          </p>
        </div>

        {/* Archival material, not a portrait of Lydiard -- a notebook page,
            handwritten workout, or physiology sketch emphasizes the idea
            over the person, and reads as a research archive rather than a
            coaching-brand bio photo. Sized like a real supporting image
            (not avatar-scale), since a document needs to be legible enough
            to read as a document, not just recognized as a face would be.
            Better than the original plan (source a period-appropriate
            Lydiard artifact, with the rights questions that implies):
            Brody's own training log from Mike Scannell, his real coach,
            named earlier in "My Story." Same "emphasize the idea" goal,
            zero rights question, more honestly tied to his own story than
            a historical Lydiard document would have been.
            w-48/w-56 (the original size) turned out too small to actually
            read the handwriting -- the whole point of using a real,
            legible page over a posed photo. max-w-md is still well short
            of the full text column, but big enough that the day-by-day
            entries are actually readable, not just recognizable as "a
            document." */}
        <div className="mt-8 max-w-[66ch]">
          <div className="w-full max-w-md">
            <Figure>
              <ImageSlot
                kind="archival"
                aspect="portrait"
                label="Brody's own training log from coach Mike Scannell -- a real page, handwritten annotations legible if possible. Emphasizes the coaching relationship and the idea of structured reflection, not a posed photo."
                alt="A week of daily entries from Brody Haar's handwritten training log -- date, workout, location, distance, and comments for each day"
                src="/homepage/coaching-training-log.jpg"
              />
            </Figure>
          </div>
        </div>

        <div className="mt-6 max-w-[66ch]">
          <PullQuote
            text={
              'None of the American way: the guy with "Coach" on his back, a clipboard and a stopwatch in his hands, shoving kids through repetitions until they are falling down with fatigue... They had all had the competitive edge drilled out of them.'
            }
            attribution="Arthur Lydiard"
          />
        </div>

        <p className="mt-8 max-w-[66ch] text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          That&rsquo;s the failure mode I trained under before I understood
          there was an alternative, and it&rsquo;s the reason &ldquo;why&rdquo;
          comes before &ldquo;what&rdquo; everywhere on this site. For the
          specific principles that come out of this, see{" "}
          <Link
            href="/training-philosophy"
            className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
          >
            Training Philosophy
          </Link>
          .
        </p>
      </section>

      {/* What You'll Find Here */}
      <section
        id="what-youll-find-here"
        className="mt-14 scroll-mt-24 border-t border-black/5 pt-14 dark:border-white/10"
      >
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">
          What you&rsquo;ll find here
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
          A growing knowledge base
        </h2>
        <p className="mt-6 max-w-[66ch] text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          The site is organized into six standing categories, each one a
          question I keep adding answers to rather than a folder of one-off
          posts:
        </p>

        <div className="mt-8 divide-y divide-black/5 dark:divide-white/10">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/${category.slug}`}
              className="group -mx-2 flex items-start justify-between gap-6 rounded-lg px-2 py-5 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
            >
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
                  {category.title}
                </h3>
                <p className="mt-1 max-w-xl text-zinc-600 dark:text-zinc-300">
                  {category.mission}
                </p>
              </div>
              <span
                aria-hidden="true"
                className="mt-1 shrink-0 text-sm font-semibold text-zinc-500 transition group-hover:text-zinc-950 dark:text-zinc-400 dark:group-hover:text-white"
              >
                →
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-8 max-w-[66ch] text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          New sections get added the same way this one did: I learn
          something, verify it&rsquo;s solid, and write it down in the place
          a reader would actually go looking for it.
        </p>
      </section>

      {/* Looking Ahead */}
      <section className="mt-14 border-t border-black/5 pt-14 pb-4 dark:border-white/10">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">
          Looking ahead
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
          Still being written
        </h2>
        <div className="mt-6 max-w-[66ch] space-y-6 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          <p>
            Ten years from now I&rsquo;d like this site to hold a few hundred
            connected pages on training, physiology, psychology, and
            coaching history, refined the same way any long-running
            research project gets refined, by being wrong sometimes and
            updating the record. If you&rsquo;re reading this early,
            you&rsquo;re reading a smaller version of what this is trying to
            become.
          </p>
          <p className="font-medium text-zinc-900 italic dark:text-white">
            The archive grows the same way the aerobic system does: slowly,
            and only with consistent, unglamorous work.
          </p>
        </div>
      </section>
      </Container>
    </>
  );
}
