import type { Metadata } from "next";
import Link from "next/link";

import { signUp } from "@/app/(app)/auth-actions";
import { AuthForm } from "@/components/auth-form";
import { GoogleSignInButton } from "@/components/oauth-buttons";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignupPage() {
  return (
    <section className="mx-auto w-full max-w-sm px-6 py-16 animate-fade-in">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
        Sign up
      </h1>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        Free to create. Your calculator results stay yours to export or
        delete at any time.
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
          action={signUp}
          submitLabel="Sign up"
          pendingLabel="Signing up…"
          passwordAutoComplete="new-password"
          passwordMinLength={8}
          footer={
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
              >
                Sign in
              </Link>
            </p>
          }
        />
      </div>
    </section>
  );
}
