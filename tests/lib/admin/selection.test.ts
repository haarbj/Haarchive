import { describe, expect, it } from "vitest";

import { clearSelection, countUnsubscribed, isAllSelected, selectAll, subscribedIds, toggleSelection } from "@/lib/admin/selection";

describe("toggleSelection", () => {
  it("adds an id not already selected", () => {
    const result = toggleSelection(new Set(), "a");
    expect(result.has("a")).toBe(true);
  });

  it("removes an id already selected", () => {
    const result = toggleSelection(new Set(["a", "b"]), "a");
    expect(result.has("a")).toBe(false);
    expect(result.has("b")).toBe(true);
  });

  it("does not mutate the input set", () => {
    const original = new Set(["a"]);
    toggleSelection(original, "b");
    expect(original.has("b")).toBe(false);
  });
});

describe("selectAll", () => {
  it("selects exactly the given ids", () => {
    const result = selectAll(["a", "b", "c"]);
    expect([...result].sort()).toEqual(["a", "b", "c"]);
  });

  it("never includes an id outside the given (filtered) list", () => {
    const result = selectAll(["a", "b"]);
    expect(result.has("z")).toBe(false);
  });

  it("returns an empty set for an empty filtered list", () => {
    expect(selectAll([]).size).toBe(0);
  });
});

describe("clearSelection", () => {
  it("returns an empty set", () => {
    expect(clearSelection().size).toBe(0);
  });
});

describe("isAllSelected", () => {
  it("is true when every filtered id is selected", () => {
    expect(isAllSelected(new Set(["a", "b"]), ["a", "b"])).toBe(true);
  });

  it("is false when only some filtered ids are selected", () => {
    expect(isAllSelected(new Set(["a"]), ["a", "b"])).toBe(false);
  });

  it("is false for an empty filtered list, even with an empty selection", () => {
    expect(isAllSelected(new Set(), [])).toBe(false);
  });

  it("ignores selected ids that fall outside the current filtered list", () => {
    // Selection left over from a previous, different search/filter --
    // shouldn't count toward "all" for the current one.
    expect(isAllSelected(new Set(["z"]), ["a", "b"])).toBe(false);
  });

  it("is true even if the selection also includes ids outside the filtered list, as long as all filtered ids are covered", () => {
    expect(isAllSelected(new Set(["a", "b", "z"]), ["a", "b"])).toBe(true);
  });
});

describe("countUnsubscribed", () => {
  it("counts only users with a non-null emailUnsubscribedAt", () => {
    const users = [
      { id: "a", emailUnsubscribedAt: null },
      { id: "b", emailUnsubscribedAt: "2026-08-01T00:00:00.000Z" },
      { id: "c", emailUnsubscribedAt: "2026-08-02T00:00:00.000Z" },
    ];
    expect(countUnsubscribed(users)).toBe(2);
  });

  it("is zero when nobody is unsubscribed", () => {
    expect(countUnsubscribed([{ id: "a", emailUnsubscribedAt: null }])).toBe(0);
  });

  it("is zero for an empty list", () => {
    expect(countUnsubscribed([])).toBe(0);
  });
});

describe("subscribedIds", () => {
  it("returns only the ids of users with a null emailUnsubscribedAt", () => {
    const users = [
      { id: "a", emailUnsubscribedAt: null },
      { id: "b", emailUnsubscribedAt: "2026-08-01T00:00:00.000Z" },
      { id: "c", emailUnsubscribedAt: null },
    ];
    expect(subscribedIds(users)).toEqual(["a", "c"]);
  });

  it("returns an empty array when everyone is unsubscribed", () => {
    expect(subscribedIds([{ id: "a", emailUnsubscribedAt: "2026-08-01T00:00:00.000Z" }])).toEqual([]);
  });

  it("returns an empty array for an empty list", () => {
    expect(subscribedIds([])).toEqual([]);
  });
});
