import type { ReactNode } from "react";
import Link from "next/link";

type ListRowProps = {
  href: string;
  children: ReactNode;
  className?: string;
  muted?: boolean;
};

// The compact px-4 py-3 link-row pattern repeated across coach/*, admin/*,
// and dashboard/page.tsx -- Card's denser, non-elevated sibling for list
// items rather than standalone panels.
export function ListRow({ href, children, className, muted = false }: ListRowProps) {
  const classes = [
    "flex flex-wrap items-center justify-between gap-3 rounded-control border border-black/10 bg-white px-4 py-3 text-sm transition hover:border-black/20 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/20",
    muted ? "opacity-50" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
