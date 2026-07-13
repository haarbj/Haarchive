import type { Metadata } from "next";
import Link from "next/link";

import { signUp } from "@/app/(app)/auth-actions";
import { resolveInvite } from "./invite-actions";
import { AuthForm } from "@/components/auth-form";
import { GoogleSignInButton } from "@/components/oauth-buttons";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Sign up",
};

type SignupPageProps = {
  searchParams: Promise<{ invite?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { invite: inviteToken } = await searchParams;
  const invite = inviteToken ? await resolveInvite(inviteToken) : null;

  return (
    <Container variant="auth">
      <Heading variant="compact">
        {invite ? "Set up your coach account" : "Sign up"}
      </Heading>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        {invite
          ? "You've been invited to coach on The Haarchive. Finish setting up your account below."
          : "Free to create. Your calculator results stay yours to export or delete at any time."}
      </p>
      {inviteToken && !invite && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700 dark:text-red-400">
          That invite link isn&rsquo;t valid or has already been used.
        </p>
      )}

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
          defaultEmail={invite?.email}
          emailReadOnly={!!invite}
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
    </Container>
  );
}
