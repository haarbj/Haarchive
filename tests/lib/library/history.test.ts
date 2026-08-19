import { describe, expect, it } from "vitest";

import { buildHistoryTimeline, type RawHistoryEvent } from "@/lib/library/history";

const NOW = new Date("2026-08-15T18:00:00.000Z");
const topicTitles = new Map([
  ["exercise-physiology", "Exercise Physiology"],
  ["the-aerobic-base", "The Aerobic Base"],
  ["marathon-pacing-calculator", "Marathon Pacing Calculator"],
]);

function event(eventType: string, topicSlug: string, isoTime: string): RawHistoryEvent {
  return { eventType, topicSlug, createdAt: isoTime };
}

describe("buildHistoryTimeline", () => {
  it("groups content_viewed/content_engaged/topic_revisited into one 'Studied' entry per topic per day", () => {
    const events: RawHistoryEvent[] = [
      event("content_viewed", "exercise-physiology", "2026-08-15T10:00:00Z"),
      event("content_engaged", "exercise-physiology", "2026-08-15T10:05:00Z"),
      event("topic_revisited", "exercise-physiology", "2026-08-15T14:00:00Z"),
    ];
    const days = buildHistoryTimeline(events, topicTitles, NOW);
    expect(days).toHaveLength(1);
    expect(days[0].entries).toEqual([{ topicSlug: "exercise-physiology", summary: "Studied Exercise Physiology" }]);
  });

  it("counts note_taken events and pluralizes correctly", () => {
    const oneNote = buildHistoryTimeline(
      [event("note_taken", "the-aerobic-base", "2026-08-15T10:00:00Z")],
      topicTitles,
      NOW,
    );
    expect(oneNote[0].entries[0].summary).toBe("Took 1 note in The Aerobic Base");

    const twoNotes = buildHistoryTimeline(
      [
        event("note_taken", "the-aerobic-base", "2026-08-15T10:00:00Z"),
        event("note_taken", "the-aerobic-base", "2026-08-15T11:00:00Z"),
      ],
      topicTitles,
      NOW,
    );
    expect(twoNotes[0].entries[0].summary).toBe("Took 2 notes in The Aerobic Base");
  });

  it("produces the exact four-line 'Today' example from the spec", () => {
    const events: RawHistoryEvent[] = [
      event("content_viewed", "exercise-physiology", "2026-08-15T09:00:00Z"),
      event("note_taken", "the-aerobic-base", "2026-08-15T10:00:00Z"),
      event("note_taken", "the-aerobic-base", "2026-08-15T10:10:00Z"),
      event("knowledge_check_answered", "the-aerobic-base", "2026-08-15T10:20:00Z"),
      event("tool_used", "marathon-pacing-calculator", "2026-08-15T11:00:00Z"),
    ];
    const days = buildHistoryTimeline(events, topicTitles, NOW);
    expect(days[0].label).toBe("Today");
    expect(days[0].entries.map((e) => e.summary)).toEqual([
      "Studied Exercise Physiology",
      "Took 2 notes in The Aerobic Base",
      "Completed a knowledge check in The Aerobic Base",
      "Used Marathon Pacing Calculator",
    ]);
  });

  it("labels yesterday and older days correctly", () => {
    const days = buildHistoryTimeline(
      [
        event("content_viewed", "exercise-physiology", "2026-08-14T10:00:00Z"),
        event("content_viewed", "the-aerobic-base", "2026-08-01T10:00:00Z"),
      ],
      topicTitles,
      NOW,
    );
    expect(days.find((d) => d.dateKey === "2026-08-14")?.label).toBe("Yesterday");
    const olderDay = days.find((d) => d.dateKey === "2026-08-01");
    expect(olderDay?.label).not.toBe("Today");
    expect(olderDay?.label).not.toBe("Yesterday");
  });

  it("orders days newest first", () => {
    const days = buildHistoryTimeline(
      [
        event("content_viewed", "exercise-physiology", "2026-08-10T10:00:00Z"),
        event("content_viewed", "the-aerobic-base", "2026-08-15T10:00:00Z"),
        event("content_viewed", "exercise-physiology", "2026-08-12T10:00:00Z"),
      ],
      topicTitles,
      NOW,
    );
    expect(days.map((d) => d.dateKey)).toEqual(["2026-08-15", "2026-08-12", "2026-08-10"]);
  });

  it("skips events for a topic slug with no resolvable title, rather than showing a raw slug", () => {
    const days = buildHistoryTimeline(
      [event("content_viewed", "deleted-topic", "2026-08-15T10:00:00Z")],
      topicTitles,
      NOW,
    );
    expect(days).toHaveLength(0);
  });

  it("skips an unrecognized/future event type safely, never guessing at copy for it", () => {
    const days = buildHistoryTimeline(
      [
        event("content_viewed", "exercise-physiology", "2026-08-15T10:00:00Z"),
        event("some_future_event_type", "exercise-physiology", "2026-08-15T10:05:00Z"),
      ],
      topicTitles,
      NOW,
    );
    expect(days[0].entries).toHaveLength(1);
  });

  it("never exposes a raw event_type string anywhere in the output", () => {
    const days = buildHistoryTimeline(
      [
        event("content_viewed", "exercise-physiology", "2026-08-15T10:00:00Z"),
        event("knowledge_check_answered", "the-aerobic-base", "2026-08-15T10:00:00Z"),
        event("tool_used", "marathon-pacing-calculator", "2026-08-15T10:00:00Z"),
      ],
      topicTitles,
      NOW,
    );
    const allSummaries = days.flatMap((d) => d.entries.map((e) => e.summary)).join(" ");
    for (const rawType of ["content_viewed", "content_engaged", "knowledge_check_answered", "tool_used", "topic_revisited", "concept_engaged", "note_taken"]) {
      expect(allSummaries).not.toContain(rawType);
    }
  });

  it("is deterministic for the same input", () => {
    const events: RawHistoryEvent[] = [
      event("content_viewed", "exercise-physiology", "2026-08-15T10:00:00Z"),
      event("note_taken", "the-aerobic-base", "2026-08-15T11:00:00Z"),
    ];
    const first = buildHistoryTimeline(events, topicTitles, NOW);
    const second = buildHistoryTimeline([...events], new Map(topicTitles), NOW);
    expect(second).toEqual(first);
  });
});
