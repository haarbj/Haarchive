import type { Metadata } from "next";
import Link from "next/link";

import { signIn } from "@/app/(app)/auth-actions";
import { AuthForm } from "@/components/auth-form";
import { GoogleSignInButton } from "@/components/oauth-buttons";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <section className="mx-auto w-full max-w-sm px-6 py-16 animate-fade-in">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
        Sign in
      </h1>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        Track goals, get a training plan, and pick up your saved
        calculations.
      </p>

      <div className="mt-8">
        <GoogleSignInButton />

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
          <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            or
          </span>
          <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        </div>

        <AuthForm
          action={signIn}
          submitLabel="Sign in"
          pendingLabel="Signing in…"
          passwordAutoComplete="current-password"
          footer={
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Need an account?{" "}
              <Link
                href="/signup"
                className="font-semibold text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
              >
                Sign up
              </Link>
            </p>
          }
        />
      </div>
    </section>
  );
}
