import Link from "next/link";

import { categories } from "@/lib/sections";
import { PullQuote } from "@/components/pull-quote";

const timeline: { label: string; note: string }[] = [
  {
    label: "Brophy College Prep, Arizona",
    note: "Four years of high school racing that taught me discipline before it taught me anything about physiology.",
  },
  {
    label: "Vanderbilt, SEC cross country",
    note: "Studying applied math, computer science, German, and engineering management while training at a Division I level — and learning, the hard way, that more anaerobic work isn't the same as better training.",
  },
  {
    label: "Stepping off the plan",
    note: "Partway through college, I walked away from a training structure built around hard mileage days and short recovery, and went looking for a system that made more physiological sense.",
  },
  {
    label: "Flagstaff, altitude",
    note: "Training at 7,000 feet forced me to think seriously about oxygen delivery — not as an abstraction, but as the thing actually limiting how hard I could run.",
  },
  {
    label: "Marathon training, on my own terms",
    note: "Building a buildup around aerobic volume instead of interval volume, and watching it hold up better than anything the rigid plan had produced.",
  },
  {
    label: "Coaching, and this archive",
    note: "Years of reading Lydiard, Daniels, Canova, and physiology papers side by side, trying to find where they agreed — and writing it down so I wouldn't have to re-derive it every time.",
  },
];

const influences: { name: string; note: string }[] = [
  {
    name: "Arthur Lydiard",
    note: "Base before anything else — speed is common, endurance is rare.",
  },
  {
    name: "Jack Daniels",
    note: "Precision: pace zones anchored to measured physiology, not feel alone.",
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
    note: "A physiologist's skepticism applied to coaching folklore — testing assumptions instead of repeating them.",
  },
  {
    name: "Norwegian threshold training",
    note: "Double-threshold days and obsessive lactate monitoring — proof that even \"easy\" training rewards measurement.",
  },
];

export function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-16 animate-fade-in">
      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">
        Distance Running Knowledge Hub
      </p>
      <h1 className="mt-3 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
        Understanding endurance, one question at a time.
      </h1>
      <p className="mt-6 max-w-[66ch] text-xl leading-9 text-zinc-600 dark:text-zinc-300">
        The Haarchive is a working notebook — physiology, coaching history,
        psychology, and firsthand experience, organized into a long-term
        archive instead of a feed. It isn&rsquo;t a portfolio of results.
        It&rsquo;s an ongoing attempt to explain why training works, not
        just what to do.
      </p>

      <Link
        href="/articles"
        className="group mt-10 flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-zinc-900"
      >
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">
            Featured essay
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            Why Running Is Valuable for Everyone
          </h3>
          <p className="mt-2 max-w-xl text-zinc-600 dark:text-zinc-300">
            Running scales perfectly across ambition — the same physiology
            that produces an Olympic champion is what makes an easy run
            worth doing at all. A good place to start if you&rsquo;re new
            here.
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-zinc-700 transition group-hover:text-zinc-950 dark:text-zinc-200 dark:group-hover:text-white">
          Read the essay →
        </span>
      </Link>

      <a
        href="#what-youll-find-here"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-700 transition hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white"
      >
        See what&rsquo;s here <span aria-hidden="true">↓</span>
      </a>

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
            physiology degree. Almost nothing sits between them — a place
            that explains why the banana works, in language built for someone
            who wants to train intelligently, not publish.
          </p>
          <p>
            That gap is what this site is trying to close. Every section
            here is built the same way: start with the mechanism — why
            oxygen delivery, muscle fiber type, or hormonal response works
            the way it does — and only then get to the workout it produces.
            The goal isn&rsquo;t to hand you a plan. It&rsquo;s to get you to
            the point where you could write your own, because you understand
            the system well enough to reason about it instead of just
            following it.
          </p>
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
          This isn&rsquo;t a highlight reel of results. It&rsquo;s the record
          of a slow shift in what I was actually curious about.
        </p>

        <ol className="mt-10 space-y-8 border-l border-black/10 pl-6 dark:border-white/10">
          {timeline.map((stop) => (
            <li key={stop.label} className="relative">
              <span className="absolute top-1.5 -left-[29px] h-2.5 w-2.5 rounded-full bg-zinc-900 dark:bg-white" />
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                {stop.label}
              </h3>
              <p className="mt-1 max-w-[62ch] text-zinc-600 dark:text-zinc-300">
                {stop.note}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-10 max-w-[66ch] text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          None of that is really a running résumé. It&rsquo;s the record of a
          realization that crept up slowly: I was more interested in why a
          workout worked than in how fast I could run it. This site is what
          happened after I stopped being able to un-notice that.
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
          I don&rsquo;t coach from a single playbook, and I&rsquo;m
          suspicious of anyone who does. The coaches and researchers below
          all built real, medal-winning methods, and they don&rsquo;t agree
          with each other — on how much of training should be aerobic base
          versus race-specific work, or how precisely intensity should be
          measured. Studying where they diverge teaches you more than
          adopting any one of them wholesale.
        </p>

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
          None of them is right about everything. That&rsquo;s the point —
          the interesting question was never &ldquo;which coach is
          correct,&rdquo; it&rsquo;s &ldquo;what adaptation is this session
          actually trying to create,&rdquo; and every system above answers
          that a little differently. The full comparison lives in the{" "}
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
            understanding why it&rsquo;s there — what adaptation it&rsquo;s
            chasing, how to judge whether the body is actually absorbing it,
            when pushing through fatigue is productive and when it&rsquo;s
            just damage. A coach who only hands out the first half produces
            athletes who can follow a plan. A coach who teaches the second
            half produces athletes who can build their own.
          </p>
        </div>

        <div className="mt-8 max-w-[66ch]">
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
          A growing knowledge base, not a blog
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
          New sections get added the same way this one did — I learn
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
          This isn&rsquo;t a finished answer
        </h2>
        <div className="mt-6 max-w-[66ch] space-y-6 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          <p>
            I don&rsquo;t expect to ever call this site done. Ten years from
            now I&rsquo;d like it to hold a few hundred connected pages on
            training, physiology, psychology, and coaching history —
            refined the same way any long-running research project gets
            refined, by being wrong sometimes and updating the record. If
            you&rsquo;re reading this early, you&rsquo;re reading a smaller
            version of what this is trying to become.
          </p>
          <p className="font-medium text-zinc-900 italic dark:text-white">
            The archive grows the same way the aerobic system does — slowly,
            and only with consistent, unglamorous work.
          </p>
        </div>
      </section>
    </div>
  );
}
