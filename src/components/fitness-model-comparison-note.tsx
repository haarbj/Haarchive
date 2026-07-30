import Link from "next/link";

const LINK_CLASS =
  "font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black dark:decoration-white/30 dark:hover:decoration-white";

type Tool = "pace" | "cv-threshold" | "tinman";

const TOOL_LINK: Record<Tool, { href: string; label: string }> = {
  pace: { href: "/pace-calculator", label: "Pace & Heart Rate Calculator" },
  "cv-threshold": { href: "/cv-threshold-calculator", label: "Threshold, CV & VO2 Max Pace Calculator" },
  tinman: { href: "/tinman-calculator", label: "Tinman Running Calculator" },
};

const METHOD_NOTE: Record<Tool, string> = {
  pace: "Riegel's race-time formula -- a simple, widely-used power-law relationship between distance and time",
  "cv-threshold":
    "a statistical model fit across a large dataset of race distances, times, and ages, with uncertainty ranges instead of one number",
  tinman: "an independently reverse-engineered fatigue-curve model from Tom Schwartz's public calculator",
};

const TOOL_ORDER: Tool[] = ["pace", "cv-threshold", "tinman"];

// All three of these tools answer the same question -- "predict my training
// paces from one recent race" -- with genuinely different methods (see
// METHOD_NOTE), so they can legitimately disagree on the same input. That
// was true before this note existed too; the only thing missing was telling
// the user, who'd otherwise have no way to know a divergence is expected
// rather than one of the three being wrong. Same component on all three
// pages so the explanation and the two links are always in sync.
export function FitnessModelComparisonNote({ current }: { current: Tool }) {
  const [firstOther, secondOther] = TOOL_ORDER.filter((tool) => tool !== current);

  return (
    <p className="text-xs text-zinc-600 dark:text-zinc-300">
      This site has two other tools that also predict training paces from a recent race result, using different
      methods:{" "}
      <Link href={TOOL_LINK[firstOther].href} className={LINK_CLASS}>
        {TOOL_LINK[firstOther].label}
      </Link>{" "}
      uses {METHOD_NOTE[firstOther]}, and{" "}
      <Link href={TOOL_LINK[secondOther].href} className={LINK_CLASS}>
        {TOOL_LINK[secondOther].label}
      </Link>{" "}
      uses {METHOD_NOTE[secondOther]}. Different methods can genuinely disagree on a related but not identical
      question -- that&rsquo;s not a bug in either one.
    </p>
  );
}
