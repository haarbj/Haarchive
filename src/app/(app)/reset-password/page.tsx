import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

// Only reachable with the short-lived recovery session /auth/callback's
// code exchange establishes after clicking the emailed reset link -- an
// expired/already-used/forged link means no session here at all, sent back
// to request a fresh one rather than shown a form that can only fail.
export default async function ResetPasswordPage() {
  const session = await getAppSession();
  if (!session) redirect("/forgot-password");

  return (
    <Container variant="auth">
      <Heading variant="compact">Set a new password</Heading>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">Choose a new password for your account.</p>

      <div className="mt-8">
        <ResetPasswordForm />
      </div>
    </Container>
  );
}
