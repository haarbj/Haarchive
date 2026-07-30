import type { ComponentType } from "react";

import type { ContentBlock } from "@/lib/sections";
import { EasyHrCeilingInline } from "@/components/inline-calculators/easy-hr-ceiling-inline";
import { HydrationBaselineInline } from "@/components/inline-calculators/hydration-baseline-inline";
import { TempoPaceInline } from "@/components/inline-calculators/tempo-pace-inline";
import { TrainingHeartRateInline } from "@/components/inline-calculators/training-heart-rate-inline";

type CalculatorBlock = Extract<ContentBlock, { type: "calculator" }>;
export type InlineCalculatorId = CalculatorBlock["calculatorId"];

// Every calculatorId in the ContentBlock union needs an entry here --
// TypeScript enforces that directly (Record<InlineCalculatorId, ...> is
// exhaustive), so adding a new embedded calculator to a Foundations page is
// "extend the union in sections.ts, add the matching component here."
const inlineCalculators: Record<InlineCalculatorId, ComponentType> = {
  "training-heart-rate": TrainingHeartRateInline,
  "easy-hr-ceiling": EasyHrCeilingInline,
  "tempo-pace": TempoPaceInline,
  "hydration-baseline": HydrationBaselineInline,
};

type InlineCalculatorProps = {
  calculatorId: InlineCalculatorId;
};

// Renders a small, interactive worked-example calculator inline within
// otherwise-static prose content (see components/content-blocks.tsx) --
// distinct from sectionTools in app/[slug]/page.tsx, which replaces a whole
// section's content with one full-page tool rather than embedding at a
// specific point within it.
export function InlineCalculator({ calculatorId }: InlineCalculatorProps) {
  const Component = inlineCalculators[calculatorId];
  return <Component />;
}
