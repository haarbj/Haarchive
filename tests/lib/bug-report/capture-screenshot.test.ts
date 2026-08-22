// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("modern-screenshot", () => ({
  domToCanvas: vi.fn(),
}));

import { domToCanvas } from "modern-screenshot";
import { capturePageScreenshot } from "@/lib/bug-report/capture-screenshot";

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

// The bug-report feature's own explicit requirement: capture failing must
// never block or break the report flow, only degrade to "no screenshot."
// These cover every way capturePageScreenshot() can fail short of a real
// browser's actual canvas/paint behavior, which happy-dom doesn't
// implement -- the successful-capture path is covered by live Playwright
// verification instead (see the feature's final report).
describe("capturePageScreenshot -- failure fallback", () => {
  it("returns unavailable when #page-content isn't present in the DOM at all", async () => {
    // No #page-content mounted.
    const result = await capturePageScreenshot();
    expect(result).toEqual({ status: "unavailable" });
    expect(domToCanvas).not.toHaveBeenCalled();
  });

  it("returns unavailable when the underlying capture library throws", async () => {
    const div = document.createElement("div");
    div.id = "page-content";
    document.body.appendChild(div);
    vi.mocked(domToCanvas).mockRejectedValue(new Error("some rendering failure"));

    const result = await capturePageScreenshot();
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns unavailable if capture never resolves before the timeout", async () => {
    vi.useFakeTimers();
    const div = document.createElement("div");
    div.id = "page-content";
    document.body.appendChild(div);
    vi.mocked(domToCanvas).mockReturnValue(new Promise(() => {})); // never resolves

    const pending = capturePageScreenshot();
    await vi.advanceTimersByTimeAsync(8000);
    const result = await pending;

    expect(result).toEqual({ status: "unavailable" });
    vi.useRealTimers();
  });

  it("returns unavailable (not a thrown error) when canvas 2d context creation fails", async () => {
    const div = document.createElement("div");
    div.id = "page-content";
    document.body.appendChild(div);
    // happy-dom's canvas has no real 2D rendering support, so getContext
    // returns null here regardless -- this exercises the same "no ctx"
    // guard a real browser could theoretically also hit.
    vi.mocked(domToCanvas).mockResolvedValue(document.createElement("canvas") as unknown as HTMLCanvasElement);

    await expect(capturePageScreenshot()).resolves.toEqual({ status: "unavailable" });
  });
});
