import type { Metadata } from "next";

import { ContributorApplicationForm } from "./contributor-application-form";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Apply to Contribute",
  description: "Apply to write articles, answer reader questions, or review submissions for the Haarchive.",
};

// Deliberately a sibling of (protected)/contribute, not nested under it --
// /contribute itself requires the content_contributor permission already
// (see contribute/layout.tsx), so the application that leads to getting
// that permission has to live outside that gate, reachable by anyone,
// signed in or not (see actions.ts's hybrid identity).
export default function ContributeApplyPage() {
  return (
    <Container variant="narrow">
      <BackLink href="/contact">Back to Contact</BackLink>
      <Heading>Apply to Contribute</Heading>
      <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        The Haarchive&rsquo;s contributor pipeline — writing articles, answering reader questions, and
        reviewing submissions — is open to anyone who applies, but every contributor is approved by hand
        first. A few questions to help with that below; I read every application myself.
      </p>

      <div className="mt-10">
        <ContributorApplicationForm />
      </div>
    </Container>
  );
}
