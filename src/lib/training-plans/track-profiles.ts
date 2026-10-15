import type { TrackKey } from "./types";

// Real, editorial "who this plan is for" content from John Davis's
// Marathon Excellence for Everyone (each track's own chapter intro --
// confirmed against the Tornado chapter's real "Initial mileage / Peak
// mileage / Typical goal times / Recommended for" format). Hand-authored,
// not computed: unlike TRAINING_PLANS' own referencePeakWeeklyMiles/
// referenceAvgWeeklyMiles (derived from the actual day-by-day workout
// data), peakOptions/goalTimeRange/recommendedFor are the book's own
// stated guidance and can't be derived from the plan JSON itself.
export type TrackProfile = {
  // The plan's own named peak-mileage options, exactly as the book states
  // them (e.g. "40 or 50 mi/wk") -- not the same as a plan's own computed
  // referencePeakWeeklyMiles, which reflects only the as-authored JSON,
  // not every peak the book itself offers as a target.
  peakOptions: string;
  goalTimeRange: string;
  recommendedFor: string[];
};

export const TRACK_PROFILES: Record<TrackKey, TrackProfile> = {
  breeze: {
    peakOptions: "40 or 50 mi/wk",
    goalTimeRange: "3:15–4:30",
    recommendedFor: [
      "First-time marathoners",
      "Injury-prone runners",
      "“Weekend warriors” with busy lives",
      "Runners with less than two years of experience",
    ],
  },
  wind: {
    peakOptions: "55 or 65 mi/wk",
    goalTimeRange: "2:40–3:45",
    recommendedFor: [
      "First attempt at qualifying for a major-city race (e.g., Boston or London)",
      "Marathoners with two or more years of experience",
      "Post-collegiate middle-distance runners",
    ],
  },
  gale: {
    peakOptions: "70 or 80 mi/wk",
    goalTimeRange: "2:25–3:15",
    recommendedFor: [
      "Running a significant PR",
      "Subsequent attempts at Boston, etc.",
      "Continuing to progress training for marathoners with three or more years of experience",
      "Post-collegiate long-distance runners",
    ],
  },
  tornado: {
    peakOptions: "85 or 95 mi/wk",
    goalTimeRange: "2:20–3:00",
    recommendedFor: [
      "Running a significant PR",
      "Targeting a podium finish or prize money at local and regional races",
      "Continuing to progress training for marathoners with four or more years of experience",
    ],
  },
  hurricane: {
    peakOptions: "100, 110, or 120 mi/wk",
    goalTimeRange: "2:15–2:50",
    recommendedFor: [
      "Running a significant PR",
      "Targeting podium and prize money finishes at regional, national, and international races",
      "Aiming for Olympic Trials qualifying times",
      "Continuing to progress training",
    ],
  },
};
