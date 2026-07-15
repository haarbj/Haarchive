import type { ReactNode } from "react";
import Link from "next/link";

type BackLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

// The "← Back to X" link every content/admin/contribute page renders above
// its heading -- previously three near-identical copies of this class
// string ([slug]/page.tsx, admin/questions/page.tsx, admin/questions/[id]/
// page.tsx), each slightly different. One component now, reused everywhere
// a detail/sub-page needs a way back to its parent.
export function BackLink({ href, children, className }: BackLinkProps) {
  const classes = [
    "mb-6 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link href={href} className={classes}>
      <span aria-hidden="true">←</span> {children}
    </Link>
  );
}
