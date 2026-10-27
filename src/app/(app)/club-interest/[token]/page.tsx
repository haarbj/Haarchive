import type { Metadata } from "next";
import Link from "next/link";

import { getAppSession } from "@/lib/auth/session";
import {
  isEmailVerified,
  loadExistingSubmission,
  resolveClubIntakeCycle,
} from "./actions";
import { ClubIntakeForm } from "./club-intake-form";
import { ResendVerificationButton } from "./resend-verification-button";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { FormError } from "@/components/ui/form-error";

// Unlisted, YouTube-unlisted style: no nav entry, no sitemap, and
// noindex/nofollow here so a search engine never indexes this page even
// if the link leaks somewhere crawlable.
export const metadata: Metadata = {
  title: "Club Interest",
  robots: { index: false, follow: false },
};

export default async function ClubInterestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [cycle, session] = await Promise.all([resolveClubIntakeCycle(token), getAppSession()]);
  const nextParam = encodeURIComponent(`/club-interest/${token}`);

  // Deliberately generic -- never reveal whether a token almost matched,
  // was closed, or never existed. The link itself is the only membership
  // proof this form has (see the task's own "link is the membership
  // proof, not the email domain" rule).
  if (!cycle || cycle.isClosed || cycle.isExpired) {
    return (
      <Container variant="auth">
        <Heading variant="compact">Form not found</Heading>
        <FormError className="mt-3">This link isn&rsquo;t valid, or this intake cycle has closed.</FormError>
      </Container>
    );
  }

  if (!session) {
    return (
      <Container variant="auth">
        <Heading variant="compact">{cycle.label}</Heading>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          Create an account or sign in to fill out the interest form.
        </p>
        <div className="mt-8 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
          <p>
            <Link
              href={`/signup?next=${nextParam}`}
              className="font-semibold text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
            >
              Sign up
            </Link>{" "}
            with your email and a password (a personal email is fine), or{" "}
            <Link
              href={`/login?next=${nextParam}`}
              className="font-semibold text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
            >
              sign in
            </Link>{" "}
            if you already have an account, and you&rsquo;ll land back here.
          </p>
        </div>
      </Container>
    );
  }

  const verified = await isEmailVerified();
  if (!verified) {
    return (
      <Container variant="auth">
        <Heading variant="compact">Verify your email</Heading>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          Check your inbox for the confirmation link before filling out the form. A submission only enters the queue
          once your email is confirmed.
        </p>
        <div className="mt-6">
          <ResendVerificationButton />
        </div>
      </Container>
    );
  }

  const existing = await loadExistingSubmission(cycle.id, session.userId);
  if (existing) {
    const statusCopy: Record<typeof existing.status, string> = {
      pending: "Your submission is in the queue for review.",
      approved: "You've been approved. Check your notifications for next steps.",
      waitlisted: "You're on the waitlist for now.",
      redirected_not_ready: "Thanks for your interest. Keep coming to club runs and build toward 25 mi/week, you'll be set for the next cycle.",
    };
    return (
      <Container variant="auth">
        <Heading variant="compact">{cycle.label}</Heading>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{statusCopy[existing.status]}</p>
      </Container>
    );
  }

  return (
    <Container variant="narrow">
      <Heading variant="compact">{cycle.label}</Heading>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        {cycle.raceName}, {new Date(`${cycle.raceDate}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}.
        Interest is due{" "}
        {new Date(cycle.deadlineAt).toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/Chicago",
          timeZoneName: "short",
        })}
        .
      </p>
      <div className="mt-8">
        <ClubIntakeForm token={token} />
      </div>
    </Container>
  );
}
