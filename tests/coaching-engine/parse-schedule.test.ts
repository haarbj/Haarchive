import { describe, expect, it } from "vitest";
import { parseScheduleText } from "@/lib/coaching-engine/parse-schedule";

describe("parseScheduleText", () => {
  it("parses numeric MM/DD lines against the given reference year", () => {
    const { races, warnings } = parseScheduleText("3/7 - Aztec Invitational\n3/14 - Devon Allen AMDG Invitational", 2026);
    expect(warnings).toHaveLength(0);
    expect(races).toEqual([
      { name: "Aztec Invitational", date: "2026-03-07" },
      { name: "Devon Allen AMDG Invitational", date: "2026-03-14" },
    ]);
  });

  it("parses named-month lines, with and without an explicit year", () => {
    const { races, warnings } = parseScheduleText("March 7 - Aztec Invitational\nApril 4, 2027 - State Meet", 2026);
    expect(warnings).toHaveLength(0);
    expect(races).toEqual([
      { name: "Aztec Invitational", date: "2026-03-07" },
      { name: "State Meet", date: "2027-04-04" },
    ]);
  });

  it("handles abbreviated month names", () => {
    const { races } = parseScheduleText("Mar 7 - Aztec Invitational", 2026);
    expect(races).toEqual([{ name: "Aztec Invitational", date: "2026-03-07" }]);
  });

  it("resolves a 2-digit year to the 2000s", () => {
    const { races } = parseScheduleText("3/7/26 - Aztec Invitational", 2026);
    expect(races).toEqual([{ name: "Aztec Invitational", date: "2026-03-07" }]);
  });

  it("strips leading day-of-week and separator noise from the race name", () => {
    const { races } = parseScheduleText("Sat, March 7 - Aztec Invitational, Tempe, AZ", 2026);
    expect(races[0].name).toBe("Aztec Invitational, Tempe, AZ");
  });

  it("skips blank lines without producing warnings for them", () => {
    const { races, warnings } = parseScheduleText("\n\nMarch 7 - Aztec Invitational\n\n", 2026);
    expect(races).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  it("produces a warning, not a crash, for a line with no recognizable date", () => {
    const { races, warnings } = parseScheduleText("Bring spikes and extra socks", 2026);
    expect(races).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Bring spikes and extra socks");
  });

  it("produces a warning for a date with no race name attached", () => {
    const { races, warnings } = parseScheduleText("3/7", 2026);
    expect(races).toHaveLength(0);
    expect(warnings).toHaveLength(1);
  });

  it("processes each line independently -- one bad line doesn't drop the good ones", () => {
    const { races, warnings } = parseScheduleText(
      "March 7 - Aztec Invitational\nNo date here\nMarch 14 - State Meet",
      2026,
    );
    expect(races).toHaveLength(2);
    expect(warnings).toHaveLength(1);
  });

  it("returns empty races and warnings for an empty string", () => {
    const { races, warnings } = parseScheduleText("", 2026);
    expect(races).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
