"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { signOut } from "@/app/(app)/auth-actions";
import { useAuthStatus } from "@/lib/use-auth-status";
import { useSessionRole } from "@/lib/use-session-role";

type AuthStatusProps = {
  className?: string;
  onNavigate?: () => void;
};

const defaultLinkClass =
  "rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200";
const menuItemClass =
  "block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10";

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
    return <AccountMenu triggerClassName={linkClass} onNavigate={onNavigate} />;
  }

  return (
    <Link href="/login" onClick={onNavigate} className={linkClass}>
      Sign in
    </Link>
  );
}

function AccountMenu({
  triggerClassName,
  onNavigate,
}: {
  triggerClassName: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const role = useSessionRole();

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function closeAndNavigate() {
    setOpen(false);
    onNavigate?.();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`inline-flex items-center gap-1.5 ${triggerClassName}`}
      >
        Account
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[var(--z-dropdown)] mt-2 w-44 rounded-xl border border-black/10 bg-white p-1.5 shadow-lg dark:border-white/10 dark:bg-zinc-900">
          {role === "coach" ? (
            <Link href="/coach" onClick={closeAndNavigate} className={menuItemClass}>
              Coach
            </Link>
          ) : (
            <>
              <Link href="/dashboard" onClick={closeAndNavigate} className={menuItemClass}>
                Dashboard
              </Link>
              <Link href="/plan" onClick={closeAndNavigate} className={menuItemClass}>
                Training Plan
              </Link>
            </>
          )}
          <Link href="/settings" onClick={closeAndNavigate} className={menuItemClass}>
            Settings
          </Link>
          {/* No onClick here: setting state to close the menu on the same
              click that submits this form removes the button from the DOM
              before the browser's default submit action fires, silently
              cancelling it. The redirect inside signOut takes care of
              closing this menu once the auth status flips. */}
          <form action={signOut}>
            <button type="submit" className={menuItemClass}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
