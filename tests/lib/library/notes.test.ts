import { describe, expect, it } from "vitest";

import {
  filterNotesByCategory,
  groupNotesByTopic,
  searchNotes,
  sortNotes,
  type LibraryNote,
} from "@/lib/library/notes";

function note(overrides: Partial<LibraryNote>): LibraryNote {
  return {
    id: overrides.id ?? "n1",
    userId: "u1",
    contentSlug: overrides.contentSlug ?? "exercise-physiology",
    body: overrides.body ?? "",
    selectedText: overrides.selectedText ?? null,
    anchor: overrides.anchor ?? null,
    createdAt: overrides.createdAt ?? "2026-08-01T00:00:00Z",
    updatedAt: overrides.updatedAt ?? "2026-08-01T00:00:00Z",
    topicTitle: overrides.topicTitle ?? "Exercise Physiology",
    categorySlug: "categorySlug" in overrides ? overrides.categorySlug! : "the-science",
    categoryTitle: "categoryTitle" in overrides ? overrides.categoryTitle! : "The Science",
  };
}

describe("searchNotes", () => {
  it("matches on note body", () => {
    const notes = [note({ id: "a", body: "VO2 max is really two adaptations" }), note({ id: "b", body: "unrelated" })];
    expect(searchNotes(notes, "two adaptations").map((n) => n.id)).toEqual(["a"]);
  });

  it("matches on the quoted passage", () => {
    const notes = [
      note({ id: "a", selectedText: "the size principle", body: "" }),
      note({ id: "b", selectedText: "something else", body: "" }),
    ];
    expect(searchNotes(notes, "size principle").map((n) => n.id)).toEqual(["a"]);
  });

  it("matches on the resolved article/topic title", () => {
    const notes = [note({ id: "a", topicTitle: "The Aerobic Base" }), note({ id: "b", topicTitle: "Nutrition & Fueling" })];
    expect(searchNotes(notes, "aerobic base").map((n) => n.id)).toEqual(["a"]);
  });

  it("is case-insensitive", () => {
    const notes = [note({ id: "a", body: "VO2 Max" })];
    expect(searchNotes(notes, "vo2 max")).toHaveLength(1);
  });

  it("returns everything for an empty/whitespace-only query", () => {
    const notes = [note({ id: "a" }), note({ id: "b" })];
    expect(searchNotes(notes, "   ")).toHaveLength(2);
  });

  it("returns nothing when no note matches", () => {
    const notes = [note({ id: "a", body: "VO2 max" })];
    expect(searchNotes(notes, "nonexistent phrase")).toEqual([]);
  });
});

describe("filterNotesByCategory", () => {
  it("filters to only the given category", () => {
    const notes = [
      note({ id: "a", categorySlug: "the-science" }),
      note({ id: "b", categorySlug: "recovery-and-fueling" }),
    ];
    expect(filterNotesByCategory(notes, "the-science").map((n) => n.id)).toEqual(["a"]);
  });

  it("returns everything when categorySlug is null (no filter)", () => {
    const notes = [note({ id: "a" }), note({ id: "b", categorySlug: "recovery-and-fueling" })];
    expect(filterNotesByCategory(notes, null)).toHaveLength(2);
  });

  it("excludes a note with a null category (e.g. a contributor article) when a real category is selected", () => {
    const notes = [note({ id: "a", categorySlug: null })];
    expect(filterNotesByCategory(notes, "the-science")).toEqual([]);
  });
});

describe("sortNotes", () => {
  it("sorts newest first by default", () => {
    const notes = [
      note({ id: "old", updatedAt: "2026-08-01T00:00:00Z" }),
      note({ id: "new", updatedAt: "2026-08-10T00:00:00Z" }),
    ];
    expect(sortNotes(notes, "newest").map((n) => n.id)).toEqual(["new", "old"]);
  });

  it("sorts oldest first when asked", () => {
    const notes = [
      note({ id: "old", updatedAt: "2026-08-01T00:00:00Z" }),
      note({ id: "new", updatedAt: "2026-08-10T00:00:00Z" }),
    ];
    expect(sortNotes(notes, "oldest").map((n) => n.id)).toEqual(["old", "new"]);
  });

  it("does not mutate the input array", () => {
    const notes = [note({ id: "old", updatedAt: "2026-08-01T00:00:00Z" }), note({ id: "new", updatedAt: "2026-08-10T00:00:00Z" })];
    const original = [...notes];
    sortNotes(notes, "oldest");
    expect(notes).toEqual(original);
  });
});

describe("groupNotesByTopic", () => {
  it("groups notes under their topic title, preserving input order within each group", () => {
    const notes = [
      note({ id: "a", topicTitle: "Exercise Physiology" }),
      note({ id: "b", topicTitle: "The Aerobic Base" }),
      note({ id: "c", topicTitle: "Exercise Physiology" }),
    ];
    const groups = groupNotesByTopic(notes);
    expect([...groups.keys()]).toEqual(["Exercise Physiology", "The Aerobic Base"]);
    expect(groups.get("Exercise Physiology")!.map((n) => n.id)).toEqual(["a", "c"]);
  });
});
