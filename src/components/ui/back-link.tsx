import type { ReactNode } from "react";
import Link from "next/link";

type BackLinkProps = {
  href: string;
  children: ReactNode;
};

// The "back to X" link every content/admin/contribute/coach page renders
// above its heading. Previously two separate components existed here and in
// components/back-link.tsx (the Coach section's own copy) with different
// icons, tap-target sizes, and spacing -- consolidated onto this one,
// keeping the larger (48px) tap target and baking in the mb-6 spacing so no
// caller needs to compensate with its own margin.
export function BackLink({ href, children }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="-ml-2 mb-6 inline-flex min-h-12 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
    >
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M12.5 15L7.5 10L12.5 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </Link>
  );
}
