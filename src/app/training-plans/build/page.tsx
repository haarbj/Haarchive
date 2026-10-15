import type { Metadata } from "next";

import { canonicalUrl } from "@/lib/canonical";
import { PlanBuilder } from "@/components/training-plans/plan-builder";
import { BackLink } from "@/components/ui/back-link";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";

// A literal sibling of [plan]/page.tsx's dynamic segment -- Next.js
// resolves this exact-match static route ahead of [plan] for the literal
// path "/training-plans/build", same precedence rule CLAUDE.md §6 already
// documents for the archive/library collision, so there's no risk of this
// being swallowed by generateStaticParams' plan slugs.
export const metadata: Metadata = {
  title: "Marathon Training Plan Generator — Build Your Custom Plan",
  description:
    "Enter your goal race, date, current weekly mileage, and days per week to generate a real, custom day-by-day training plan -- free, no account needed.",
  ...canonicalUrl("/training-plans/build"),
  openGraph: {
    title: "Marathon Training Plan Generator",
    description: "A custom day-by-day training plan from your own numbers, built in your browser -- no account needed.",
    images: ["/opengraph-image.png"],
  },
  twitter: {
    title: "Marathon Training Plan Generator",
    description: "A custom day-by-day training plan from your own numbers, built in your browser -- no account needed.",
    images: ["/opengraph-image.png"],
  },
};

export default function BuildPlanPage() {
  return (
    <Container variant="content">
      <BackLink href="/training-plans">Back to Training Plans</BackLink>
      <Heading>Build Your Custom Training Plan</Heading>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Enter your goal race, date, current weekly mileage, and how many days a week you run. This builds a real,
        periodized day-by-day plan from those numbers -- the same engine that generates a plan for a signed-in
        athlete, free and with no account needed to see it.
      </p>

      <div className="mt-10">
        <PlanBuilder />
      </div>
    </Container>
  );
}
