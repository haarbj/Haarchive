"use client";

import Link from "next/link";

import { useAuthStatus } from "@/lib/use-auth-status";

type AuthStatusProps = {
  className?: string;
  onNavigate?: () => void;
};

const defaultLinkClass =
  "rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200";

export function AuthStatus({ className, onNavigate }: AuthStatusProps) {
  const status = useAuthStatus();
  const linkClass = className ?? defaultLinkClass;

  // Reserve the link's footprint during the client-side session check so
  // the header doesn't visibly flash from "Sign in" to "Dashboard" once
  // the check resolves.
  if (status === "loading") {
    return <span className="inline-block h-8 w-20" aria-hidden="true" />;
  }

  if (status === "authenticated") {
    return (
      <Link href="/dashboard" onClick={onNavigate} className={linkClass}>
        Dashboard
      </Link>
    );
  }

  return (
    <Link href="/login" onClick={onNavigate} className={linkClass}>
      Sign in
    </Link>
  );
}
