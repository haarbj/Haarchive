// Learning History (Phase 5's "My Library" timeline): turns raw
// learning_events rows into a compact, human-readable, day-grouped feed --
// "Studied Exercise Physiology," never "content_engaged." Pure and
// independently testable, matching the codebase's own established
// convention (mastery/algorithm.ts, training-plans/template.ts) of keeping
// translation logic out of the component that renders it.

export type RawHistoryEvent = {
  eventType: string;
  topicSlug: string;
  createdAt: string | Date;
};

export type HistoryEntry = {
  topicSlug: string;
  summary: string;
};

export type HistoryDay = {
  dateKey: string; // "2026-08-15", UTC -- stable, sortable, test-friendly
  label: string; // "Today" | "Yesterday" | "Aug 10, 2026"
  entries: HistoryEntry[];
};

type EventCategory = "reading" | "notes" | "concepts" | "knowledge_check" | "tool";

// content_viewed/content_engaged/topic_revisited all collapse into one
// "reading" bucket per (day, topic) -- three separate DB event types
// representing the same underlying activity from a reader's point of
// view, exactly the "don't expose raw event names, merge repeated
// low-value events" instruction. concept_engaged and knowledge_check_
// answered get their own buckets since they're genuinely distinct,
// higher-signal actions worth naming specifically (matches the four-line
// "Today" example in the spec: reading, notes, a knowledge check, and a
// tool are four different lines, not folded into one).
const EVENT_CATEGORY: Record<string, EventCategory | undefined> = {
  content_viewed: "reading",
  content_engaged: "reading",
  topic_revisited: "reading",
  note_taken: "notes",
  concept_engaged: "concepts",
  knowledge_check_answered: "knowledge_check",
  tool_used: "tool",
};

function toDateKey(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

function dayLabel(dateKey: string, today: Date): string {
  const todayKey = toDateKey(today);
  const yesterdayKey = toDateKey(new Date(today.getTime() - 24 * 60 * 60 * 1000));
  if (dateKey === todayKey) return "Today";
  if (dateKey === yesterdayKey) return "Yesterday";
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function summarize(category: EventCategory, count: number, topicTitle: string): string {
  switch (category) {
    case "reading":
      return `Studied ${topicTitle}`;
    case "notes":
      return `Took ${count} note${count === 1 ? "" : "s"} in ${topicTitle}`;
    case "concepts":
      return `Explored ${count} concept${count === 1 ? "" : "s"} in ${topicTitle}`;
    case "knowledge_check":
      return `Completed ${count === 1 ? "a" : count} knowledge check${count === 1 ? "" : "s"} in ${topicTitle}`;
    case "tool":
      return `Used ${topicTitle}`;
  }
}

// `now` is injectable (defaults to real time) purely so "Today"/"Yesterday"
// are testable without mocking the system clock.
export function buildHistoryTimeline(
  events: RawHistoryEvent[],
  topicTitleBySlug: Map<string, string>,
  now: Date = new Date(),
): HistoryDay[] {
  // dateKey -> topicSlug -> category -> count
  const buckets = new Map<string, Map<string, Map<EventCategory, number>>>();

  for (const event of events) {
    const category = EVENT_CATEGORY[event.eventType];
    if (!category) continue; // an unrecognized/future event type -- skip, don't guess at copy for it
    if (!topicTitleBySlug.has(event.topicSlug)) continue; // no resolvable title -- nothing honest to show

    const dateKey = toDateKey(event.createdAt);
    if (!buckets.has(dateKey)) buckets.set(dateKey, new Map());
    const byTopic = buckets.get(dateKey)!;
    if (!byTopic.has(event.topicSlug)) byTopic.set(event.topicSlug, new Map());
    const byCategory = byTopic.get(event.topicSlug)!;
    byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
  }

  const days: HistoryDay[] = [];
  const sortedDateKeys = [...buckets.keys()].sort((a, b) => (a < b ? 1 : -1)); // newest first

  // A fixed, deterministic display order within a day -- reading first (the
  // most common, lowest-signal action), then progressively more active
  // signals -- rather than whatever order a Map happened to iterate keys in.
  const CATEGORY_ORDER: EventCategory[] = ["reading", "concepts", "notes", "knowledge_check", "tool"];

  for (const dateKey of sortedDateKeys) {
    const byTopic = buckets.get(dateKey)!;
    const entries: HistoryEntry[] = [];
    for (const [topicSlug, byCategory] of byTopic) {
      const topicTitle = topicTitleBySlug.get(topicSlug)!;
      for (const category of CATEGORY_ORDER) {
        const count = byCategory.get(category);
        if (!count) continue;
        entries.push({ topicSlug, summary: summarize(category, count, topicTitle) });
      }
    }
    days.push({ dateKey, label: dayLabel(dateKey, now), entries });
  }

  return days;
}
