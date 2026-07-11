import Link from "next/link";

// Most coach pages have no way back except the browser button -- a small,
// consistent back link at the top of each one gives an explicit, expected
// way out (Jakob's Law: matches the back-navigation pattern users already
// know from everywhere else) without relying on browser chrome.
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-2 inline-flex min-h-12 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
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
      {label}
    </Link>
  );
}
