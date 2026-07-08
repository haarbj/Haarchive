import { describe, expect, it } from "vitest";
import { distanceBucket } from "@/lib/coaching-engine/distance-buckets";

describe("distanceBucket", () => {
  it("buckets mile and 5K as short", () => {
    expect(distanceBucket(1609)).toBe("short");
    expect(distanceBucket(5000)).toBe("short");
  });

  it("buckets 8K and 10K as middle", () => {
    expect(distanceBucket(8000)).toBe("middle");
    expect(distanceBucket(10000)).toBe("middle");
  });

  it("buckets half and full marathon as long", () => {
    expect(distanceBucket(21097)).toBe("long");
    expect(distanceBucket(42195)).toBe("long");
  });

  it("is consistent at the exact boundary values", () => {
    expect(distanceBucket(7000)).toBe("short");
    expect(distanceBucket(7001)).toBe("middle");
    expect(distanceBucket(15000)).toBe("middle");
    expect(distanceBucket(15001)).toBe("long");
  });
});
