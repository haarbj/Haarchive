// Continuous wind-exposure scoring for road/route courses -- wind
// shelter isn't really categorical, it's a continuum from a dense
// downtown street to a fully open coastline. This models it as a 0-100
// score (see terrain/overpass-exposure.ts for how that score gets
// estimated automatically from map data) and maps it both to a wind-
// physics exponent and to simple, human-friendly labels for display.
//
// Track keeps its own separate discrete WindProfile (wind-physics.ts) --
// a track's terrain is a known, fixed case (a standard oval, lane 1),
// not something that benefits from a continuous score.

export type ExposureLabel = "dense-urban" | "suburban" | "mixed" | "open-rural" | "fully-exposed";

export const EXPOSURE_LABEL_ORDER: ExposureLabel[] = [
  "dense-urban",
  "suburban",
  "mixed",
  "open-rural",
  "fully-exposed",
];

export const EXPOSURE_LABEL_TEXT: Record<ExposureLabel, string> = {
  "dense-urban": "Dense Urban",
  suburban: "Suburban",
  mixed: "Mixed",
  "open-rural": "Open Rural",
  "fully-exposed": "Fully Exposed",
};

export const EXPOSURE_LABEL_HINT: Record<ExposureLabel, string> = {
  "dense-urban": "Downtown streets or dense forest -- buildings and trees block most of the wind.",
  suburban: "Houses, trees, and open ground mixed together.",
  mixed: "A blend of some shelter and some open ground.",
  "open-rural": "Open roads, fields, or a park with little shelter.",
  "fully-exposed": "Coastal, prairie, or another fully open setting with nothing to block the wind.",
};

// The representative score used when a user manually picks a label
// rather than accepting an auto-detected numeric score.
export const EXPOSURE_LABEL_SCORE: Record<ExposureLabel, number> = {
  "dense-urban": 7.5,
  suburban: 25,
  mixed: 47.5,
  "open-rural": 70,
  "fully-exposed": 90,
};

const EXPOSURE_LABEL_BAND_MAX: { label: ExposureLabel; max: number }[] = [
  { label: "dense-urban", max: 15 },
  { label: "suburban", max: 35 },
  { label: "mixed", max: 60 },
  { label: "open-rural", max: 80 },
  { label: "fully-exposed", max: 100 },
];

/** Maps a continuous 0-100 exposure score down to one of five user-friendly labels. */
export function exposureLabelFor(score: number): ExposureLabel {
  const clamped = Math.min(100, Math.max(0, score));
  for (const band of EXPOSURE_LABEL_BAND_MAX) {
    if (clamped <= band.max) return band.label;
  }
  return "fully-exposed";
}

// Wind profile power-law exponent anchors -- higher alpha means more
// terrain sheltering between the 10m reference height and chest height
// (see wind-physics.ts's windAtChestHeightMSFromAlpha, which this feeds).
// Anchored at the same values the discrete road/track model already used
// at its 0/25/70 reference points (urban=0.4, suburban=0.3, rural=0.16),
// with "mixed" and "fully exposed" filling in the continuum this adds.
const ALPHA_ANCHORS: { score: number; alpha: number }[] = [
  { score: 0, alpha: 0.4 },
  { score: 25, alpha: 0.3 },
  { score: 47.5, alpha: 0.22 },
  { score: 70, alpha: 0.16 },
  { score: 100, alpha: 0.04 },
];

/** Linearly interpolates a wind-profile alpha exponent from a continuous 0-100 exposure score. */
export function windProfileAlphaFromExposure(exposureScore: number): number {
  const score = Math.min(100, Math.max(0, exposureScore));
  for (let i = 0; i < ALPHA_ANCHORS.length - 1; i++) {
    const a = ALPHA_ANCHORS[i];
    const b = ALPHA_ANCHORS[i + 1];
    if (score >= a.score && score <= b.score) {
      const t = (score - a.score) / (b.score - a.score);
      return a.alpha + (b.alpha - a.alpha) * t;
    }
  }
  return ALPHA_ANCHORS[ALPHA_ANCHORS.length - 1].alpha;
}
