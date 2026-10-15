import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <Container variant="auth">
      <Heading variant="compact">Reset your password</Heading>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        Enter the email on your account and we&rsquo;ll send you a link to set a new password.
      </p>

      <div className="mt-8">
        <ForgotPasswordForm />
      </div>

      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-300">
        <Link
          href="/login"
          className="font-semibold text-zinc-900 underline decoration-black/30 underline-offset-2 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
        >
          Back to sign in
        </Link>
      </p>
    </Container>
  );
}
