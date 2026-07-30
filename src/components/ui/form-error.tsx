import type { ElementType, ReactNode } from "react";

type FormErrorProps = {
  children: ReactNode;
  as?: "p" | "span";
  className?: string;
};

// The role="alert" + red error-text pattern, previously hand-copied across
// 40+ forms with occasionally-drifted classes (font-medium present or
// missing, raw red-700/red-400 instead of the --accent-error token Badge/
// ContentCallout already use for the same meaning).
export function FormError({ children, as = "p", className }: FormErrorProps) {
  const Tag = as as ElementType;
  const classes = ["text-sm font-medium text-accent-error", className ?? ""].filter(Boolean).join(" ");
  return (
    <Tag role="alert" className={classes}>
      {children}
    </Tag>
  );
}
