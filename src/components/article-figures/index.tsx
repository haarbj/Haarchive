import type { ComponentType } from "react";

import type { ContentBlock } from "@/lib/sections";
import { BostonMarathonFuelingCard } from "@/components/article-figures/boston-marathon-fueling-card";
import { GastricEmptyingExplorer } from "@/components/article-figures/gastric-emptying-explorer";
import { CarbohydrateTransportDiagram } from "@/components/article-figures/carbohydrate-transport-diagram";

type FigureBlock = Extract<ContentBlock, { type: "figure" }>;
export type ArticleFigureId = FigureBlock["figureId"];

// Sibling registry to components/inline-calculators/index.tsx -- same
// exhaustiveness guarantee (Record<ArticleFigureId, ...> forces every
// figureId in the ContentBlock union to have a matching component), same
// "hand-authored only" role: extend the "figure" union in sections.ts,
// then add the matching component + entry here.
const articleFigures: Record<ArticleFigureId, ComponentType> = {
  "boston-marathon-fueling": BostonMarathonFuelingCard,
  "gastric-emptying-explorer": GastricEmptyingExplorer,
  "carbohydrate-transport-diagram": CarbohydrateTransportDiagram,
};

type ArticleFigureProps = {
  figureId: ArticleFigureId;
};

// Renders a larger, article-specific interactive figure inline within
// otherwise-static prose content (see components/content-blocks.tsx) --
// distinct from InlineCalculator (components/inline-calculators), which is
// for small worked-example calculators rather than a chart, diagram, or
// comparison card.
export function ArticleFigure({ figureId }: ArticleFigureProps) {
  const Component = articleFigures[figureId];
  return <Component />;
}
