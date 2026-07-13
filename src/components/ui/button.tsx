import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

export type ButtonVariant = "solid" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  solid:
    "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200",
  outline:
    "border border-black/10 bg-white text-zinc-900 hover:border-black/20 dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:hover:border-white/20",
  ghost:
    "text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white",
  danger: "bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
};

const BASE = "inline-flex items-center justify-center gap-1.5 rounded-pill font-semibold transition disabled:opacity-60";

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & { href?: undefined };

type ButtonAsLink = CommonProps & {
  href: string;
  target?: string;
  onClick?: () => void;
};

// One primitive covering the ~32 hand-written pill buttons the audit
// found -- a solid/outline/ghost variant crossed with the three padding
// tiers already in use. Renders a <Link> when `href` is given, a <button>
// otherwise, so call sites don't have to pick the element themselves.
export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "solid", size = "md", children, className } = props;
  const classes = [BASE, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className ?? ""]
    .filter(Boolean)
    .join(" ");

  if ("href" in props && props.href !== undefined) {
    const { href, target, onClick } = props;
    return (
      <Link href={href} target={target} onClick={onClick} className={classes}>
        {children}
      </Link>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to exclude them from the DOM spread below
  const { variant: _variant, size: _size, children: _children, className: _className, ...rest } = props;
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
