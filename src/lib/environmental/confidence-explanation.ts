// Explains WHY a result's confidence range is as wide (or narrow) as it
// is, from data the calculator already has about where its inputs came
// from -- an imported GPS route vs. manual entry, retrieved historical
// weather vs. hand-typed conditions, measured elevation vs. estimated
// terrain exposure. Not a new confidence calculation: ConfidenceRangeBar
// already derives the actual low/high seconds from each engine's own
// confidence band; this only narrates which inputs were measured versus
// estimated, so a wide range doesn't read as an unexplained black box.

export type ConfidenceReason = {
  label: string;
  /** Measured/imported data that narrows uncertainty vs. an estimate that still carries some. */
  strengthensConfidence: boolean;
};

export type ConfidenceLevel = "high" | "medium" | "low";

export function buildConfidenceReasons(params: {
  courseType: "road" | "track" | "route";
  hasGpsRoute: boolean;
  weatherSource: "auto" | "manual";
  terrainSource: "auto-detected" | "manual";
}): ConfidenceReason[] {
  const { courseType, hasGpsRoute, weatherSource, terrainSource } = params;
  const reasons: ConfidenceReason[] = [];

  if (courseType === "track") {
    reasons.push({ label: "Track geometry is exact (standard 400m oval)", strengthensConfidence: true });
  } else if (courseType === "route" && hasGpsRoute) {
    reasons.push({ label: "GPS route imported", strengthensConfidence: true });
    reasons.push({ label: "Elevation measured from the file's own samples", strengthensConfidence: true });
  } else {
    reasons.push({ label: "Course entered manually, not measured", strengthensConfidence: false });
  }

  reasons.push({
    label: weatherSource === "auto" ? "Historical weather retrieved" : "Weather entered manually",
    strengthensConfidence: weatherSource === "auto",
  });

  reasons.push({
    label: terrainSource === "auto-detected" ? "Terrain exposure estimated from map data" : "Terrain exposure entered manually",
    // Even an automatic terrain estimate is still an estimate, not a
    // measurement -- it doesn't get the same confidence boost a GPS route
    // or retrieved weather reading does.
    strengthensConfidence: false,
  });

  return reasons;
}

export function overallConfidenceLevel(reasons: ConfidenceReason[]): ConfidenceLevel {
  if (reasons.length === 0) return "medium";
  const strongShare = reasons.filter((reason) => reason.strengthensConfidence).length / reasons.length;
  if (strongShare >= 0.75) return "high";
  if (strongShare >= 0.4) return "medium";
  return "low";
}
