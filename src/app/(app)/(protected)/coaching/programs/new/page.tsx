import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { ProgramForm } from "../program-form";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "New Program",
  robots: { index: false, follow: false },
};

export default async function NewProgramPage() {
  const session = await getAppSession();
  if (!session?.isPrivateCoach) redirect("/coaching");

  return (
    <Container variant="content">
      <BackLink href="/coaching/programs">Programs</BackLink>
      <Heading>New Program</Heading>
      <div className="mt-8">
        <ProgramForm />
      </div>
    </Container>
  );
}
