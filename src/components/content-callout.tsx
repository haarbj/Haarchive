import type { CalloutVariant } from "@/lib/sections";

type ContentCalloutProps = {
  variant: CalloutVariant;
  title?: string;
  text?: string;
  items?: string[];
  collapsed?: boolean;
};

// Same --color-accent-* tokens Badge/StatusBadge use (globals.css) -- a
// color choice made once there now governs both a status pill and a
// callout box, instead of two separately hand-maintained sky/amber/
// violet/emerald maps.
const VARIANT_STYLES: Record<CalloutVariant, { label: string; classes: string }> = {
  tip: {
    label: "Coaching Tip",
    classes: "border-accent-tip/50 bg-accent-tip/5",
  },
  mistake: {
    label: "Common Mistake",
    classes: "border-accent-warning/50 bg-accent-warning/5",
  },
  research: {
    label: "Research Insight",
    classes: "border-accent-research/50 bg-accent-research/5",
  },
  takeaway: {
    label: "Practical Takeaway",
    classes: "border-accent-success/50 bg-accent-success/5",
  },
  advanced: {
    label: "Advanced Topic",
    classes: "border-zinc-400/50 bg-zinc-500/5 dark:border-zinc-500/50 dark:bg-zinc-400/5",
  },
};

export function ContentCallout({ variant, title, text, items, collapsed }: ContentCalloutProps) {
  const style = VARIANT_STYLES[variant];
  const heading = title ?? style.label;
  const body = (
    <>
      {text ? <p className="text-base leading-7 text-zinc-700 dark:text-zinc-300">{text}</p> : null}
      {items && items.length > 0 ? (
        <ul className={`space-y-2 text-base leading-7 text-zinc-700 dark:text-zinc-300 ${text ? "mt-2" : ""}`}>
          {items.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      ) : null}
    </>
  );

  if (variant === "advanced") {
    return (
      <details open={collapsed === false} className={`rounded-xl border-l-4 px-5 py-4 ${style.classes}`}>
        <summary className="cursor-pointer text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          {heading}
        </summary>
        <div className="mt-3">{body}</div>
      </details>
    );
  }

  return (
    <div className={`rounded-xl border-l-4 px-5 py-4 ${style.classes}`}>
      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {heading}
      </p>
      <div className="mt-2">{body}</div>
    </div>
  );
}
