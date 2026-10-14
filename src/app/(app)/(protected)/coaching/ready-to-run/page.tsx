import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { BackLink } from "@/components/ui/back-link";
import { ReadyToRunCheck } from "./ready-to-run-check";

// Part I item 22a: the athlete's own "ready to run?" self-check.
//
// Gated on isCoachedAthlete, the same way /coaching/training is: a
// self-serve athlete with no coach lands back on /coaching rather than on
// a health questionnaire nobody is reading the answers to. The whole point
// of this existing inside the coaching product is that there is a coach on
// the other end of "tell your coach".
//
// Nothing is stored. The check answers for the moment it is taken, and
// keeping a log of symptom answers would turn a coaching tool into a
// health record -- a different thing, with different obligations, that
// this platform has not taken on.
export const metadata = { title: "Ready to run?" };

export default async function ReadyToRunPage() {
  const session = await getAppSession();
  if (!session?.isCoachedAthlete) redirect("/coaching");

  return (
    <Container variant="narrow">
      <BackLink href="/coaching">My Coaching</BackLink>
      <Heading>Ready to run?</Heading>
      <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        A quick self-check for a day you are not feeling right. Answer honestly rather than optimistically: the only
        person it can mislead is you.
      </p>
      <ReadyToRunCheck />
    </Container>
  );
}
