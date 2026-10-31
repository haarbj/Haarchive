import type { ComponentType } from "react";

import type { ContentBlock } from "@/lib/sections";
import { BostonMarathonFuelingCard } from "@/components/article-figures/boston-marathon-fueling-card";
import { GastricEmptyingExplorer } from "@/components/article-figures/gastric-emptying-explorer";
import { CarbohydrateTransportDiagram } from "@/components/article-figures/carbohydrate-transport-diagram";
import { IntensityDomainsDiagram } from "@/components/article-figures/intensity-domains-diagram";
import { OxygenDeliveryPipelineDiagram } from "@/components/article-figures/oxygen-delivery-pipeline-diagram";
import { LactateShuttleDiagram } from "@/components/article-figures/lactate-shuttle-diagram";
import { SizePrincipleExplorer } from "@/components/article-figures/size-principle-explorer";
import { OxygenDebtDiagram } from "@/components/article-figures/oxygen-debt-diagram";
import { BreathingRhythmExplorer } from "@/components/article-figures/breathing-rhythm-explorer";
import { CrossoverPointDiagram } from "@/components/article-figures/crossover-point-diagram";
import { PacingTemplateDiagram } from "@/components/article-figures/pacing-template-diagram";
import { SupercompensationExplorer } from "@/components/article-figures/supercompensation-explorer";
import { CapillaryDensificationDiagram } from "@/components/article-figures/capillary-densification-diagram";
import { DeflectionPointDiagram } from "@/components/article-figures/deflection-point-diagram";
import { DoubleThresholdSplitDiagram } from "@/components/article-figures/double-threshold-split-diagram";
import { PolarizedPolesDiagram } from "@/components/article-figures/polarized-poles-diagram";
import { IntervalBoutsDiagram } from "@/components/article-figures/interval-bouts-diagram";
import { RadcliffeLongitudinalDiagram } from "@/components/article-figures/radcliffe-longitudinal-diagram";
import { HeartRateLagDiagram } from "@/components/article-figures/heart-rate-lag-diagram";
import { CardiacDriftDiagram } from "@/components/article-figures/cardiac-drift-diagram";
import { DfaAlpha1Diagram } from "@/components/article-figures/dfa-alpha1-diagram";
import { RacePaceCurveDiagram } from "@/components/article-figures/race-pace-curve-diagram";
import { RaceTimeDistributionDiagram } from "@/components/article-figures/race-time-distribution-diagram";
import { ThreePredictionModelsDiagram } from "@/components/article-figures/three-prediction-models-diagram";
import { PredictionErrorWideningDiagram } from "@/components/article-figures/prediction-error-widening-diagram";
import { FuelingWindowDiagram } from "@/components/article-figures/fueling-window-diagram";
import { CarbCeilingDiagram } from "@/components/article-figures/carb-ceiling-diagram";
import { GutTrainingProgressionDiagram } from "@/components/article-figures/gut-training-progression-diagram";
import { DivergingRecoveryClocksDiagram } from "@/components/article-figures/diverging-recovery-clocks-diagram";
import { SorenessVsToneDiagram } from "@/components/article-figures/soreness-vs-tone-diagram";
import { SleepInjuryRiskDiagram } from "@/components/article-figures/sleep-injury-risk-diagram";
import { OvertrainingClusterDiagram } from "@/components/article-figures/overtraining-cluster-diagram";
import { CycleFrameworkVsEvidenceDiagram } from "@/components/article-figures/cycle-framework-vs-evidence-diagram";
import { RefuelingWindowComparisonDiagram } from "@/components/article-figures/refueling-window-comparison-diagram";
import { HeartRateMythVsTalkTestDiagram } from "@/components/article-figures/heart-rate-myth-vs-talk-test-diagram";
import { VenaCavaCompressionDiagram } from "@/components/article-figures/vena-cava-compression-diagram";
import { CentralVsPeripheralVo2MaxDiagram } from "@/components/article-figures/central-vs-peripheral-vo2max-diagram";
import { RecoverySpacingByDecadeDiagram } from "@/components/article-figures/recovery-spacing-by-decade-diagram";
import { CentenarianDecathlonDiagram } from "@/components/article-figures/centenarian-decathlon-diagram";

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
  "intensity-domains-diagram": IntensityDomainsDiagram,
  "oxygen-delivery-pipeline": OxygenDeliveryPipelineDiagram,
  "lactate-shuttle": LactateShuttleDiagram,
  "size-principle-explorer": SizePrincipleExplorer,
  "oxygen-debt": OxygenDebtDiagram,
  "breathing-rhythm-explorer": BreathingRhythmExplorer,
  "crossover-point": CrossoverPointDiagram,
  "pacing-template": PacingTemplateDiagram,
  "supercompensation-explorer": SupercompensationExplorer,
  "capillary-densification": CapillaryDensificationDiagram,
  "deflection-point": DeflectionPointDiagram,
  "double-threshold-split": DoubleThresholdSplitDiagram,
  "polarized-poles": PolarizedPolesDiagram,
  "interval-bouts": IntervalBoutsDiagram,
  "radcliffe-longitudinal": RadcliffeLongitudinalDiagram,
  "heart-rate-lag": HeartRateLagDiagram,
  "cardiac-drift": CardiacDriftDiagram,
  "dfa-alpha1-crossing": DfaAlpha1Diagram,
  "race-pace-curve": RacePaceCurveDiagram,
  "race-time-distribution": RaceTimeDistributionDiagram,
  "three-prediction-models": ThreePredictionModelsDiagram,
  "prediction-error-widening": PredictionErrorWideningDiagram,
  "fueling-window": FuelingWindowDiagram,
  "carb-ceiling": CarbCeilingDiagram,
  "gut-training-progression": GutTrainingProgressionDiagram,
  "diverging-recovery-clocks": DivergingRecoveryClocksDiagram,
  "soreness-vs-tone": SorenessVsToneDiagram,
  "sleep-injury-risk": SleepInjuryRiskDiagram,
  "overtraining-cluster": OvertrainingClusterDiagram,
  "cycle-framework-vs-evidence": CycleFrameworkVsEvidenceDiagram,
  "refueling-window-comparison": RefuelingWindowComparisonDiagram,
  "heart-rate-myth-vs-talk-test": HeartRateMythVsTalkTestDiagram,
  "vena-cava-compression": VenaCavaCompressionDiagram,
  "central-vs-peripheral-vo2max": CentralVsPeripheralVo2MaxDiagram,
  "recovery-spacing-by-decade": RecoverySpacingByDecadeDiagram,
  "centenarian-decathlon": CentenarianDecathlonDiagram,
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
