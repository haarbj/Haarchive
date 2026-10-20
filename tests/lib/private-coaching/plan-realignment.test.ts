import { describe, expect, it } from "vitest";

import {
  PROTECTED_SPACING_MIN_DAYS,
  fingerprintRealignmentInput,
  proposeRealignment,
  type DisruptionWindow,
  type RealignmentWorkout,
} from "@/lib/private-coaching/plan-realignment";

// Disruption: sick Mon-Wed. Return day (first day back) is Thursday
// 2026-10-22. Horizon: Thu 10/22 .. Wed 10/28.
const DISRUPTION: DisruptionWindow = { startDate: "2026-10-19", endDate: "2026-10-21" };

function workout(overrides: Partial<RealignmentWorkout> = {}): RealignmentWorkout {
  return {
    id: "w-1",
    scheduledDate: "2026-10-22",
    workoutType: "easy",
    dayLabel: "Easy",
    plannedDistanceM: 8000,
    plannedDistanceMaxM: null,
    plannedDurationS: null,
    plannedDurationMaxS: null,
    plannedRpe: 4,
    plannedRpeMax: null,
    isOptional: false,
    ...overrides,
  };
}

function keySession(overrides: Partial<RealignmentWorkout> = {}): RealignmentWorkout {
  return workout({ plannedRpe: 8, plannedRpeMax: null, dayLabel: "Threshold", workoutType: "tempo", ...overrides });
}

function longRun(overrides: Partial<RealignmentWorkout> = {}): RealignmentWorkout {
  return workout({ workoutType: "long", dayLabel: "Long Run", plannedRpe: 5, plannedDistanceM: 24000, ...overrides });
}

describe("proposeRealignment", () => {
  it("computes the horizon as the 7 days starting the day after the disruption ends", () => {
    const proposal = proposeRealignment(DISRUPTION, []);
    expect(proposal.horizonStart).toBe("2026-10-22");
    expect(proposal.horizonEnd).toBe("2026-10-28");
  });

  it("an all-filler, no-conflict week comes back completely unchanged", () => {
    const horizon = [
      workout({ id: "w-1", scheduledDate: "2026-10-22" }),
      workout({ id: "w-2", scheduledDate: "2026-10-23" }),
    ];
    const proposal = proposeRealignment(DISRUPTION, horizon);
    expect(proposal.entries.every((e) => e.changeKind === "unchanged")).toBe(true);
    expect(proposal.hasProtectedDrop).toBe(false);
  });

  describe("rule 2+3: return-day protection and key-session spacing", () => {
    it("a key session on the return day is moved, never left there", () => {
      const horizon = [keySession({ id: "key-1", scheduledDate: "2026-10-22" })];
      const proposal = proposeRealignment(DISRUPTION, horizon);
      const entry = proposal.entries.find((e) => e.original.id === "key-1")!;
      expect(entry.changeKind).toBe("moved");
      expect(entry.proposedDate).not.toBe("2026-10-22");
      expect(entry.reason).toBe("Moved: key session can't follow the return day");
    });

    it("a long run on the return day is moved too -- the same protection as a key session", () => {
      const horizon = [longRun({ id: "long-1", scheduledDate: "2026-10-22" })];
      const proposal = proposeRealignment(DISRUPTION, horizon);
      const entry = proposal.entries.find((e) => e.original.id === "long-1")!;
      expect(entry.changeKind).toBe("moved");
      expect(entry.proposedDate).not.toBe("2026-10-22");
    });

    it("a filler session on the return day needs no change at all -- the return day is supposed to be easy", () => {
      const horizon = [workout({ id: "easy-1", scheduledDate: "2026-10-22" })];
      const proposal = proposeRealignment(DISRUPTION, horizon);
      expect(proposal.entries.find((e) => e.original.id === "easy-1")!.changeKind).toBe("unchanged");
    });

    it("the moved key session lands at least PROTECTED_SPACING_MIN_DAYS away from another protected session", () => {
      const horizon = [
        keySession({ id: "key-return", scheduledDate: "2026-10-22" }),
        longRun({ id: "long-fixed", scheduledDate: "2026-10-24" }),
      ];
      const proposal = proposeRealignment(DISRUPTION, horizon);
      const moved = proposal.entries.find((e) => e.original.id === "key-return")!;
      expect(moved.changeKind).toBe("moved");
      const gapDays = Math.abs(new Date(moved.proposedDate).getTime() - new Date("2026-10-24").getTime()) / 86_400_000;
      expect(gapDays).toBeGreaterThanOrEqual(PROTECTED_SPACING_MIN_DAYS);
    });

    it("never places a moved protected session on a day already holding another protected session", () => {
      // Every other day in the horizon already has a protected session,
      // forcing the engine to either find the one remaining gap or drop.
      const horizon = [
        keySession({ id: "return-key", scheduledDate: "2026-10-22" }),
        longRun({ id: "l1", scheduledDate: "2026-10-23" }),
        keySession({ id: "k2", scheduledDate: "2026-10-25" }),
        longRun({ id: "l3", scheduledDate: "2026-10-27" }),
      ];
      const proposal = proposeRealignment(DISRUPTION, horizon);
      const moved = proposal.entries.find((e) => e.original.id === "return-key")!;
      if (moved.changeKind === "moved") {
        expect(["2026-10-23", "2026-10-25", "2026-10-27"]).not.toContain(moved.proposedDate);
      } else {
        expect(moved.changeKind).toBe("dropped");
      }
    });
  });

  describe("rule 4: filler is bumped before any protected session is ever dropped", () => {
    it("a filler session already on the key session's new day is shortened (has distance to reduce)", () => {
      const horizon = [
        keySession({ id: "key-1", scheduledDate: "2026-10-22" }),
        workout({ id: "filler-1", scheduledDate: "2026-10-23", plannedDistanceM: 10000 }),
      ];
      const proposal = proposeRealignment(DISRUPTION, horizon);
      const moved = proposal.entries.find((e) => e.original.id === "key-1")!;
      expect(moved.proposedDate).toBe("2026-10-23");
      const bumped = proposal.entries.find((e) => e.original.id === "filler-1")!;
      expect(bumped.changeKind).toBe("shortened");
      expect(bumped.proposedDistanceM).toBe(5000);
      expect(bumped.reason).toMatch(/Shortened/);
    });

    it("a filler session with no distance to shorten is dropped instead", () => {
      const horizon = [
        keySession({ id: "key-1", scheduledDate: "2026-10-22" }),
        workout({ id: "filler-1", scheduledDate: "2026-10-23", plannedDistanceM: null }),
      ];
      const proposal = proposeRealignment(DISRUPTION, horizon);
      const bumped = proposal.entries.find((e) => e.original.id === "filler-1")!;
      expect(bumped.changeKind).toBe("dropped");
      expect(bumped.reason).toMatch(/Dropped/);
    });

    it("filler is sacrificed before the key session is ever considered for a drop, even when a filler is in the way everywhere", () => {
      // Every candidate day has a filler on it, but filler can always be
      // bumped -- so the key session should move successfully, never drop.
      const horizon = [
        keySession({ id: "key-1", scheduledDate: "2026-10-22" }),
        workout({ id: "f1", scheduledDate: "2026-10-23" }),
        workout({ id: "f2", scheduledDate: "2026-10-24" }),
      ];
      const proposal = proposeRealignment(DISRUPTION, horizon);
      const moved = proposal.entries.find((e) => e.original.id === "key-1")!;
      expect(moved.changeKind).toBe("moved");
      expect(moved.flagged).toBe(false);
    });
  });

  describe("rule 4 continued: a protected session is dropped only when genuinely no valid slot exists, and it's flagged", () => {
    it("drops and flags the return-day key session when every other day is occupied by a protected session (no spacing-safe gap)", () => {
      const horizon = [
        keySession({ id: "return-key", scheduledDate: "2026-10-22" }),
        longRun({ id: "l1", scheduledDate: "2026-10-23" }),
        keySession({ id: "k1", scheduledDate: "2026-10-24" }),
        longRun({ id: "l2", scheduledDate: "2026-10-25" }),
        keySession({ id: "k2", scheduledDate: "2026-10-26" }),
        longRun({ id: "l3", scheduledDate: "2026-10-27" }),
        keySession({ id: "k3", scheduledDate: "2026-10-28" }),
      ];
      const proposal = proposeRealignment(DISRUPTION, horizon);
      const dropped = proposal.entries.find((e) => e.original.id === "return-key")!;
      expect(dropped.changeKind).toBe("dropped");
      expect(dropped.flagged).toBe(true);
      expect(proposal.hasProtectedDrop).toBe(true);
    });

    it("a dropped protected session contributes nothing to proposedLoadM", () => {
      const horizon = [
        keySession({ id: "return-key", scheduledDate: "2026-10-22", plannedDistanceM: 9700 }),
        longRun({ id: "l1", scheduledDate: "2026-10-23" }),
        keySession({ id: "k1", scheduledDate: "2026-10-24" }),
        longRun({ id: "l2", scheduledDate: "2026-10-25" }),
        keySession({ id: "k2", scheduledDate: "2026-10-26" }),
        longRun({ id: "l3", scheduledDate: "2026-10-27" }),
        keySession({ id: "k3", scheduledDate: "2026-10-28" }),
      ];
      const proposal = proposeRealignment(DISRUPTION, horizon);
      const dropped = proposal.entries.find((e) => e.original.id === "return-key")!;
      expect(dropped.changeKind).toBe("dropped");
      expect(dropped.proposedDistanceM).toBeNull();
    });
  });

  describe("rule 1: combined load never exceeds the originally planned week's load", () => {
    it("proposedLoadM never exceeds originalLoadM across a mixed week", () => {
      const horizon = [
        keySession({ id: "key-1", scheduledDate: "2026-10-22", plannedDistanceM: 9700 }),
        workout({ id: "f1", scheduledDate: "2026-10-23", plannedDistanceM: 6000 }),
        longRun({ id: "long-1", scheduledDate: "2026-10-26", plannedDistanceM: 24000 }),
      ];
      const proposal = proposeRealignment(DISRUPTION, horizon);
      expect(proposal.proposedLoadM).toBeLessThanOrEqual(proposal.originalLoadM);
    });

    it("an unchanged week has proposedLoadM exactly equal to originalLoadM", () => {
      const horizon = [workout({ id: "w-1", scheduledDate: "2026-10-23", plannedDistanceM: 8000 })];
      const proposal = proposeRealignment(DISRUPTION, horizon);
      expect(proposal.proposedLoadM).toBe(proposal.originalLoadM);
    });
  });

  describe("rule 5: rest days are never all eliminated to cram a move in", () => {
    it("skips a candidate day that would leave zero rest days, picking the next valid day instead", () => {
      // Horizon: Thu return day (key, must move), Fri filler, Sat REST
      // (nothing scheduled), Sun filler, Mon-Wed empty too. The engine
      // must not treat Saturday as off-limits just because it's the only
      // rest day among several empty days -- but it must never use the
      // LAST remaining rest day when other empty days exist. Construct a
      // horizon where exactly one day is a rest day and confirm it still
      // gets used only when truly nothing else is left by making every
      // other day already occupied.
      const horizon = [
        keySession({ id: "return-key", scheduledDate: "2026-10-22" }),
        workout({ id: "f1", scheduledDate: "2026-10-23" }),
        workout({ id: "f2", scheduledDate: "2026-10-25" }),
        workout({ id: "f3", scheduledDate: "2026-10-26" }),
        workout({ id: "f4", scheduledDate: "2026-10-27" }),
        workout({ id: "f5", scheduledDate: "2026-10-28" }),
        // 2026-10-24 is the week's only rest day.
      ];
      const proposal = proposeRealignment(DISRUPTION, horizon);
      const moved = proposal.entries.find((e) => e.original.id === "return-key")!;
      // A valid non-rest day exists (every filler day can be bumped), so
      // the rest day must be preserved rather than consumed.
      expect(moved.proposedDate).not.toBe("2026-10-24");
    });

    it("uses the sole rest day only when every other candidate is genuinely invalid (occupied by another protected session)", () => {
      const horizon = [
        keySession({ id: "return-key", scheduledDate: "2026-10-22" }),
        longRun({ id: "l1", scheduledDate: "2026-10-23" }),
        keySession({ id: "k1", scheduledDate: "2026-10-25" }),
        longRun({ id: "l2", scheduledDate: "2026-10-26" }),
        keySession({ id: "k2", scheduledDate: "2026-10-27" }),
        longRun({ id: "l3", scheduledDate: "2026-10-28" }),
        // 2026-10-24 is the only day free of a protected session.
      ];
      const proposal = proposeRealignment(DISRUPTION, horizon);
      const moved = proposal.entries.find((e) => e.original.id === "return-key")!;
      // 2026-10-24 is both the only rest day AND the only spacing-safe
      // day -- using it leaves zero rest days, but it's the only valid
      // slot, so rule 5 can't save it from being used (or, if the
      // spacing check against the neighboring protected sessions still
      // rejects it, the session drops instead -- either outcome is
      // correct; what's wrong is silently fabricating a slot that
      // violates spacing).
      expect(["2026-10-24"]).toContain(moved.changeKind === "moved" ? moved.proposedDate : "2026-10-24");
    });
  });

  it("names the correct session-type flags on each entry", () => {
    const horizon = [
      keySession({ id: "key-1", scheduledDate: "2026-10-23" }),
      longRun({ id: "long-1", scheduledDate: "2026-10-25" }),
      workout({ id: "filler-1", scheduledDate: "2026-10-26" }),
    ];
    const proposal = proposeRealignment(DISRUPTION, horizon);
    expect(proposal.entries.find((e) => e.original.id === "key-1")!.isKeySession).toBe(true);
    expect(proposal.entries.find((e) => e.original.id === "long-1")!.isLongRun).toBe(true);
    expect(proposal.entries.find((e) => e.original.id === "filler-1")!.isKeySession).toBe(false);
    expect(proposal.entries.find((e) => e.original.id === "filler-1")!.isLongRun).toBe(false);
  });

  it("an optional, otherwise-demanding session is never treated as a key session -- isBigSession's own rule, reused exactly", () => {
    const horizon = [keySession({ id: "opt-1", scheduledDate: "2026-10-22", isOptional: true })];
    const proposal = proposeRealignment(DISRUPTION, horizon);
    const entry = proposal.entries.find((e) => e.original.id === "opt-1")!;
    expect(entry.isKeySession).toBe(false);
    // Not protected, so no forced move off the return day.
    expect(entry.changeKind).toBe("unchanged");
  });
});

describe("determinism", () => {
  it("the same disruption window and horizon always produce the exact same proposal", () => {
    const horizon = [
      keySession({ id: "key-1", scheduledDate: "2026-10-22" }),
      workout({ id: "f1", scheduledDate: "2026-10-23", plannedDistanceM: 10000 }),
      longRun({ id: "long-1", scheduledDate: "2026-10-26" }),
    ];
    const first = proposeRealignment(DISRUPTION, horizon);
    const second = proposeRealignment(DISRUPTION, [...horizon]); // a fresh array, same contents
    expect(second).toEqual(first);
  });

  it("re-ordering the input array doesn't change the result", () => {
    const horizon = [
      keySession({ id: "key-1", scheduledDate: "2026-10-22" }),
      workout({ id: "f1", scheduledDate: "2026-10-23", plannedDistanceM: 10000 }),
      longRun({ id: "long-1", scheduledDate: "2026-10-26" }),
    ];
    const first = proposeRealignment(DISRUPTION, horizon);
    const reversed = proposeRealignment(DISRUPTION, [...horizon].reverse());
    expect(reversed.entries.map((e) => e.original.id).sort()).toEqual(first.entries.map((e) => e.original.id).sort());
    for (const entry of first.entries) {
      const match = reversed.entries.find((e) => e.original.id === entry.original.id)!;
      expect(match.changeKind).toBe(entry.changeKind);
      expect(match.proposedDate).toBe(entry.proposedDate);
    }
  });
});

describe("fingerprintRealignmentInput", () => {
  it("is identical for the same athlete, disruption, and horizon", () => {
    const horizon = [workout({ id: "w-1", scheduledDate: "2026-10-22" })];
    const a = fingerprintRealignmentInput("athlete-1", DISRUPTION, horizon);
    const b = fingerprintRealignmentInput("athlete-1", DISRUPTION, [...horizon]);
    expect(a).toBe(b);
  });

  it("changes when the disruption window changes", () => {
    const horizon = [workout({ id: "w-1", scheduledDate: "2026-10-22" })];
    const a = fingerprintRealignmentInput("athlete-1", DISRUPTION, horizon);
    const b = fingerprintRealignmentInput("athlete-1", { startDate: "2026-10-18", endDate: "2026-10-20" }, horizon);
    expect(a).not.toBe(b);
  });

  it("changes when a workout's own values change", () => {
    const a = fingerprintRealignmentInput("athlete-1", DISRUPTION, [workout({ id: "w-1", plannedDistanceM: 8000 })]);
    const b = fingerprintRealignmentInput("athlete-1", DISRUPTION, [workout({ id: "w-1", plannedDistanceM: 9000 })]);
    expect(a).not.toBe(b);
  });

  it("is order-independent over the horizon workouts", () => {
    const horizon = [workout({ id: "w-1" }), workout({ id: "w-2", scheduledDate: "2026-10-23" })];
    const a = fingerprintRealignmentInput("athlete-1", DISRUPTION, horizon);
    const b = fingerprintRealignmentInput("athlete-1", DISRUPTION, [...horizon].reverse());
    expect(a).toBe(b);
  });
});
