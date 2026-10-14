import type { Metadata } from "next";
import Link from "next/link";

import { getAppSession } from "@/lib/auth/session";
import { emailsMatch } from "@/lib/private-coaching/invites";
import { resolvePrivateCoachInvite } from "./actions";
import { AcceptButton } from "./accept-button";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { FormError } from "@/components/ui/form-error";

export const metadata: Metadata = {
  title: "Coaching Invite",
  robots: { index: false, follow: false },
};

export default async function CoachingInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, session] = await Promise.all([resolvePrivateCoachInvite(token), getAppSession()]);
  const nextParam = encodeURIComponent(`/coaching-invite/${token}`);

  if (!invite) {
    return (
      <Container variant="auth">
        <Heading variant="compact">Invite not found</Heading>
        <FormError className="mt-3">This invite link isn&rsquo;t valid, or has already been accepted.</FormError>
      </Container>
    );
  }

  if (invite.expired) {
    return (
      <Container variant="auth">
        <Heading variant="compact">Invite expired</Heading>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          This invite from {invite.coachDisplayName} has expired. Ask them to send a new one.
        </p>
      </Container>
    );
  }

  return (
    <Container variant="auth">
      <Heading variant="compact">You&rsquo;ve been invited to coaching</Heading>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        {invite.coachDisplayName} has invited you to be privately coached on The Haarchive.
      </p>

      <div className="mt-8">
        {!session ? (
          <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
            <p>
              <Link
                href={`/signup?next=${nextParam}`}
                className="font-semibold text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
              >
                Sign up
              </Link>{" "}
              using exactly <span className="font-semibold text-zinc-900 dark:text-white">{invite.athleteEmail}</span> to accept
              automatically, or{" "}
              <Link
                href={`/login?next=${nextParam}`}
                className="font-semibold text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
              >
                sign in
              </Link>{" "}
              and you&rsquo;ll land back here to accept.
            </p>
          </div>
        ) : session.email && emailsMatch(session.email, invite.athleteEmail) ? (
          <AcceptButton token={token} />
        ) : (
          <FormError>
            This invite was sent to {invite.athleteEmail}, but you&rsquo;re signed in as {session.email}. Sign out and
            sign in with the invited email to accept.
          </FormError>
        )}
      </div>
    </Container>
  );
}
