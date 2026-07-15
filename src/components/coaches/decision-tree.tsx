import type { DecisionOutcome, DecisionQuestion, DecisionScenario } from "@/lib/coaches/types";

function StepChain({ steps }: { steps: string[] }) {
  return (
    <div className="mt-3 space-y-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-2">
          <span aria-hidden="true" className="mt-0.5 text-zinc-300 dark:text-zinc-600">
            →
          </span>
          <p className="text-sm text-zinc-700 dark:text-zinc-200">{step}</p>
        </div>
      ))}
    </div>
  );
}

// Recursive: an outcome's `followUp` is itself another question, matching
// how a real decision nests (see Tom Schwartz's "recovering well" -> "can
// absorb more" example, two questions deep). Two outcomes render side by
// side on a wide screen and stack on a narrow one; three or more always
// stack, since a 3+ column grid gets cramped fast.
function OutcomeBranch({ outcome }: { outcome: DecisionOutcome }) {
  return (
    <div className="border-l-2 border-zinc-200 pl-4 dark:border-zinc-700">
      <span className="inline-flex rounded-pill bg-zinc-900 px-2.5 py-0.5 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900">
        {outcome.condition}
      </span>
      <StepChain steps={outcome.steps} />
      {outcome.followUp ? (
        <div className="mt-4">
          <QuestionNode question={outcome.followUp} />
        </div>
      ) : null}
    </div>
  );
}

function QuestionNode({ question }: { question: DecisionQuestion }) {
  return (
    <div>
      <p className="inline-block rounded-xl border border-black/10 bg-black/[0.02] px-4 py-2 text-sm font-semibold text-zinc-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-white">
        {question.question}
      </p>
      <div
        className={`mt-4 grid gap-4 ${
          question.outcomes.length === 2 ? "sm:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {question.outcomes.map((outcome) => (
          <OutcomeBranch key={outcome.condition} outcome={outcome} />
        ))}
      </div>
    </div>
  );
}

// One real coaching decision at a time (see DecisionScenario's own
// comment): either genuine branching logic (a QuestionNode tree) or, for a
// scenario with no real fork, a plain sequential chain. Either way this
// replaces the old flat "decorative" step list with something that actually
// represents how the coach reasons through a specific situation.
export function DecisionTree({ scenarios }: { scenarios: DecisionScenario[] }) {
  return (
    <div className="mt-8 space-y-10">
      {scenarios.map((scenario) => (
        <div key={scenario.title}>
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {scenario.title}
          </p>
          <div className="mt-3">
            {scenario.question ? <QuestionNode question={scenario.question} /> : null}
            {scenario.steps ? <StepChain steps={scenario.steps} /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
