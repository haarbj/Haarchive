import type { Metadata } from "next";

import { BackLink } from "@/components/back-link";
import { CreateSeasonFlow } from "./create-season-flow";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

export const metadata: Metadata = {
  title: "Generate a Season",
};

export default function NewSeasonPage() {
  return (
    <Container variant="narrow">
      <BackLink href="/coach" label="Coach" />
      <Heading className="mt-4">
        Generate a season
      </Heading>
      <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Set it up, preview exactly what will be created, then create it.
      </p>

      <div className="mt-10">
        <CreateSeasonFlow />
      </div>
    </Container>
  );
}
