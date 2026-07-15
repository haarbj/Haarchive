import Link from "next/link";

import { headingId } from "@/lib/heading-id";
import { Card } from "@/components/ui/card";
import { PullQuote } from "@/components/pull-quote";

const eyebrowClass = "text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500";
const h2Class = "mt-3 scroll-mt-24 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-white";
const sectionClass = "mt-16 border-t border-black/5 pt-14 dark:border-white/10";
const proseClass = "mt-6 max-w-[66ch] text-lg leading-8 text-zinc-600 dark:text-zinc-300";
const linkClass =
  "font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70";

const COACHES = [
  "Tom Schwartz",
  "Pete Pfitzinger",
  "Jack Daniels",
  "Arthur Lydiard",
  "Renato Canova",
  "Norwegian System",
  "Joe Vigil",
];

// Multiple starting philosophies converging on the same outcome -- the
// visual argument of "The Problem" section. A downward arrow stands in for
// the SVG on narrow screens rather than trying to keep N converging lines
// legible in a wrapped, variable-width pill row.
//
// The sm+ row is a CSS grid, not flex-wrap, specifically so each coach sits
// in an equal-width column -- the SVG lines below assume evenly-spaced x
// positions (i / count), which only lines up with where a pill actually
// renders if every column really is the same width. A flex-wrap row sizes
// each pill to its own text, so "Joe Vigil" and "Norwegian System" land at
// different x offsets than the evenly-spaced math expects; a grid's default
// stretch behavior pins every item's center to the assumed slot regardless
// of label length.
function ConvergenceDiagram() {
  return (
    <div className="my-10" aria-hidden="true">
      <div className="flex flex-wrap justify-center gap-2 sm:grid sm:grid-cols-7 sm:gap-1.5">
        {COACHES.map((coach) => (
          <span
            key={coach}
            className="rounded-pill border border-black/10 bg-white px-3 py-1.5 text-center text-xs font-medium text-zinc-700 sm:rounded-lg sm:px-1.5 sm:py-2 sm:text-[11px] sm:leading-tight dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200"
          >
            {coach}
          </span>
        ))}
      </div>

      <div className="flex justify-center py-3 text-xl text-zinc-300 sm:hidden dark:text-zinc-700">↓</div>

      <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="hidden h-16 w-full sm:block">
        {COACHES.map((coach, i) => (
          <line
            key={coach}
            x1={((i + 0.5) / COACHES.length) * 100}
            y1="0"
            x2="50"
            y2="24"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-zinc-300 dark:text-zinc-700"
          />
        ))}
      </svg>

      <div className="flex justify-center">
        <span className="rounded-pill bg-zinc-900 px-5 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900">
          Elite Runners
        </span>
      </div>
    </div>
  );
}

const PYRAMID_TIERS = ["Speed", "VO₂ Max", "Threshold"];

// Narrowing tiers on top of one full-width base -- deliberately plain CSS
// bars, not an illustration, so it reads as a diagram rather than decoration.
function AerobicPyramid() {
  return (
    <div className="my-10 flex flex-col items-center gap-1.5" aria-hidden="true">
      {PYRAMID_TIERS.map((tier, i) => (
        <div
          key={tier}
          style={{ width: `${45 + i * 20}%` }}
          className="rounded-md border border-black/10 bg-zinc-100 py-2.5 text-center text-sm font-medium text-zinc-700 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {tier}
        </div>
      ))}
      <div className="w-full border-t-2 border-zinc-900 pt-2 text-center text-sm font-semibold text-zinc-900 dark:border-white dark:text-white">
        Aerobic Base
      </div>
    </div>
  );
}

const INDIVIDUALIZATION_FACTORS = [
  "Training history",
  "Injury history",
  "Age",
  "Mileage",
  "Recovery",
  "Stress",
  "Goals",
];

const PROGRESSION = [
  { label: "Training Philosophy", href: undefined, blurb: "The beliefs about adaptation everything else follows from." },
  { label: "Exercise Physiology", href: "/exercise-physiology", blurb: "The mechanisms — VO₂ max, threshold, fatigue — that explain why those beliefs hold." },
  { label: "Coaching", href: "/coaching-and-training", blurb: "Turning physiology into structured systems and training decisions." },
  { label: "Workouts", href: "/workout-library", blurb: "The specific sessions those systems prescribe." },
  { label: "Performance", href: undefined, blurb: "The race-day result all of the above was built toward." },
] as const;

function ProgressionDiagram() {
  return (
    <div className="my-10 flex flex-col items-center">
      {PROGRESSION.map((step, i) => (
        <div key={step.label} className="flex w-full max-w-sm flex-col items-center">
          <div className="w-full rounded-xl border border-black/10 bg-white px-5 py-3 text-center dark:border-white/10 dark:bg-zinc-900">
            {step.href ? (
              <Link href={step.href} className={`${linkClass} text-sm`}>
                {step.label}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">{step.label}</span>
            )}
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{step.blurb}</p>
          </div>
          {i < PROGRESSION.length - 1 ? (
            <div aria-hidden="true" className="py-2 text-lg text-zinc-300 dark:text-zinc-700">
              ↓
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

const CORE_PRINCIPLES = [
  "Evidence over tradition",
  "Physiology before prescriptions",
  "Adaptation over mileage",
  "Long-term development",
  "Curiosity over certainty",
  "Individualization over one-size-fits-all",
];

const NOT_LIST = [
  "A generic marathon plan generator.",
  "Influencer advice.",
  "“10 tips to run faster.”",
  "Dogmatic.",
  "Trying to convince you one coach is right.",
];

// The Training Philosophy section's ToolComponent (see sectionTools in
// [slug]/page.tsx) -- this page is meant to read as a flagship essay, not
// reference documentation, so it replaces the generic ContentBlock/
// ArticleLayout renderer entirely (no TOC, no chapter nav), the same way
// ContactPage and the calculators do.
export function TrainingPhilosophyPage() {
  return (
    <>
      <section className={sectionClass}>
        <p className={eyebrowClass}>The Problem</p>
        <h2 id={headingId("Many Systems, One Destination")} className={h2Class}>
          Many Systems, One Destination
        </h2>
        <p className={proseClass}>
          Tom Schwartz (Tinman) leans on lactate-tested threshold work sequenced around an individual
          runner&rsquo;s own physiology. Pete Pfitzinger built marathoners on medium-long runs saturated
          with marathon-pace running. Jack Daniels built precise pace zones from lab-measured VO₂ max.
          Arthur Lydiard built milers on a deep aerobic base. Renato Canova built marathoners on
          threshold-heavy blocks few other systems would dare prescribe. The Norwegian system doubles up
          controlled threshold sessions, tracked by blood lactate, twice a day. Joe Vigil built
          Olympians on altitude, biomechanics, and the belief that the mental game is trainable like
          anything else.
        </p>
        <p className={proseClass}>
          All five have produced Olympic medalists and world records. None of them agree on what a Tuesday
          should look like.
        </p>

        <ConvergenceDiagram />

        <p className={proseClass}>
          The obvious question is which one is correct. That&rsquo;s the wrong question — every system above
          works because it correctly identifies some real constraint on how the body adapts, and every
          system disagrees with the others about which constraint matters most, when, and for whom. The
          question worth answering isn&rsquo;t which coach is right. It&rsquo;s <em>why</em> each one
          prescribes what they prescribe — the belief about the body underneath the workout. That belief is
          what actually determines whether a method fits you, not its medal count.
        </p>
      </section>

      <section className={sectionClass}>
        <p className={eyebrowClass}>Core Philosophy</p>
        <h2 id={headingId("The Beliefs Underneath Every Workout")} className={h2Class}>
          The Beliefs Underneath Every Workout
        </h2>

        <div className="mt-10 space-y-12">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              Train adaptations, not workouts
            </h3>
            <p className={proseClass}>
              A workout is valuable because of the adaptation it creates, not because it&rsquo;s famous. A
              session is a delivery mechanism for a specific physiological signal — more capillaries, a
              higher lactate threshold, better running economy. Copy the delivery mechanism without
              understanding the signal, and you get a session that looks right and does nothing.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              Understand before you copy
            </h3>
            <p className={proseClass}>
              Most runners memorize workouts. Better runners understand why they work. A famous session
              copied from a professional&rsquo;s training log, without understanding what it&rsquo;s meant
              to adapt or where it sits in that runner&rsquo;s cycle, is trivia — not training.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              Aerobic fitness is the foundation
            </h3>
            <p className={proseClass}>
              Every system used higher up — anaerobic power, VO₂ max, lactate threshold — is built on top of
              aerobic capacity: capillary density, mitochondrial volume, the aerobic enzymes available to
              the working muscle. Skip the base, and every layer above it has less to stand on.
            </p>
            <AerobicPyramid />
          </div>

          <div>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              Individualization matters
            </h3>
            <p className={proseClass}>
              Two runners chasing the same goal race can need almost opposite training, because training
              doesn&rsquo;t respond to the goal alone — it responds to the runner:
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {INDIVIDUALIZATION_FACTORS.map((factor) => (
                <span
                  key={factor}
                  className="rounded-pill border border-black/10 bg-white px-3 py-1 text-sm font-medium text-zinc-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  {factor}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              Consistency beats perfection
            </h3>
            <p className={proseClass}>
              Years matter more than individual workouts. The aerobic engine described above takes years to
              fully mature — no single week, hit or missed, moves that timeline much. A runner training
              consistently at 90% of their theoretical best plan will out-develop one training brilliantly
              for six weeks and burning out for six.
            </p>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <p className={eyebrowClass}>How This Shapes the Site</p>
        <h2 id={headingId("From Belief to Race Day")} className={h2Class}>
          From Belief to Race Day
        </h2>
        <p className={proseClass}>
          Every other section of the Haarchive is downstream of the beliefs on this page — each one takes
          the previous section&rsquo;s answer and builds the next question on top of it.
        </p>
        <ProgressionDiagram />
      </section>

      <section className={sectionClass}>
        <div className="rounded-2xl bg-zinc-900 px-6 py-10 text-white sm:px-10 dark:bg-zinc-800">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">What This Site Is Not</h2>
          <ul className="mt-6 space-y-3 text-lg leading-8 text-zinc-300">
            {NOT_LIST.map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden="true" className="text-zinc-500">
                  ×
                </span>
                <span>Not {item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-xl leading-8 font-medium text-white">
            Instead: an attempt to understand distance running from first principles.
          </p>
        </div>
      </section>

      <section className={sectionClass}>
        <p className={eyebrowClass}>Core Principles</p>
        <h2 id={headingId("Six Ideas, Distilled")} className={h2Class}>
          Six Ideas, Distilled
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {CORE_PRINCIPLES.map((principle) => (
            <Card key={principle} padding="md" className="text-center">
              <p className="font-semibold text-zinc-900 dark:text-white">{principle}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className={sectionClass}>
        <PullQuote text="The goal of this site isn't to convince you one philosophy is correct. It's to help you understand why different philosophies work, when they work, and how to think critically about training." />
      </section>
    </>
  );
}
