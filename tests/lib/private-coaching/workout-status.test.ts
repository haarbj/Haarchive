import { describe, expect, it } from "vitest";

import { computeWorkoutStatus, getWorkoutDisplayLabel } from "@/lib/private-coaching/workout-status";

describe("computeWorkoutStatus", () => {
  it("is 'draft' for an unpublished workout, even with a date in the past", () => {
    expect(
      computeWorkoutStatus({ publishedAt: null, scheduledDate: "2026-01-01", hasCompletion: false, today: "2026-08-26" }),
    ).toBe("draft");
  });

  it("is 'scheduled' for a published, upcoming, uncompleted workout", () => {
    expect(
      computeWorkoutStatus({ publishedAt: "2026-08-01T00:00:00Z", scheduledDate: "2026-08-30", hasCompletion: false, today: "2026-08-26" }),
    ).toBe("scheduled");
  });

  it("is 'missed' for a published, past-due, uncompleted workout", () => {
    expect(
      computeWorkoutStatus({ publishedAt: "2026-08-01T00:00:00Z", scheduledDate: "2026-08-20", hasCompletion: false, today: "2026-08-26" }),
    ).toBe("missed");
  });

  it("is 'completed' whenever a completion exists, regardless of date", () => {
    expect(
      computeWorkoutStatus({ publishedAt: "2026-08-01T00:00:00Z", scheduledDate: "2026-08-20", hasCompletion: true, today: "2026-08-26" }),
    ).toBe("completed");
    expect(
      computeWorkoutStatus({ publishedAt: "2026-08-01T00:00:00Z", scheduledDate: "2026-08-30", hasCompletion: true, today: "2026-08-26" }),
    ).toBe("completed");
  });
});

describe("getWorkoutDisplayLabel", () => {
  it("prefers day_label when set", () => {
    expect(getWorkoutDisplayLabel("MLR", "6 Mile Aerobic Run")).toBe("MLR");
  });

  it("falls back to the legacy title when day_label is unset", () => {
    expect(getWorkoutDisplayLabel(null, "6 Mile Aerobic Run")).toBe("6 Mile Aerobic Run");
  });

  it("falls back to a generic label when both are unset", () => {
    expect(getWorkoutDisplayLabel(null, null)).toBe("Workout");
  });
});
