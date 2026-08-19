import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AutosaveController, type AutosaveResult } from "@/lib/autosave-controller";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("AutosaveController", () => {
  it("does not call onSave before the debounce delay elapses", () => {
    const onSave = vi.fn(async (): Promise<AutosaveResult> => ({ ok: true }));
    const controller = new AutosaveController<string>("", { onSave, delayMs: 500 });

    controller.notifyValueChanged("hello");
    expect(onSave).not.toHaveBeenCalled();

    vi.advanceTimersByTime(499);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onSave once, with the latest value, after the debounce settles", async () => {
    const onSave = vi.fn(async (): Promise<AutosaveResult> => ({ ok: true }));
    const controller = new AutosaveController<string>("", { onSave, delayMs: 500 });

    controller.notifyValueChanged("h");
    controller.notifyValueChanged("he");
    controller.notifyValueChanged("hel");
    controller.notifyValueChanged("hell");
    controller.notifyValueChanged("hello");

    await vi.advanceTimersByTimeAsync(500);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("hello");
  });

  it("never sends a request for every keystroke -- rapid typing resets the debounce window", async () => {
    const onSave = vi.fn(async (): Promise<AutosaveResult> => ({ ok: true }));
    const controller = new AutosaveController<string>("", { onSave, delayMs: 500 });

    for (let i = 0; i < 20; i++) {
      controller.notifyValueChanged("a".repeat(i + 1));
      await vi.advanceTimersByTimeAsync(100); // well under the 500ms delay each time
    }
    expect(onSave).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("does not schedule a save for empty content", async () => {
    const onSave = vi.fn(async (): Promise<AutosaveResult> => ({ ok: true }));
    const controller = new AutosaveController<string>("", { onSave, delayMs: 500, isEmpty: (v) => v.trim().length === 0 });

    controller.notifyValueChanged("   ");
    await vi.advanceTimersByTimeAsync(1000);

    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not re-save when the debounce fires but nothing changed since the last save", async () => {
    const onSave = vi.fn(async (): Promise<AutosaveResult> => ({ ok: true }));
    const controller = new AutosaveController<string>("same", { onSave, delayMs: 500 });

    controller.notifyValueChanged("same");
    await vi.advanceTimersByTimeAsync(1000);

    expect(onSave).not.toHaveBeenCalled();
  });

  it("serializes overlapping saves: a change during an in-flight save triggers exactly one follow-up carrying the latest value", async () => {
    const calls: string[] = [];
    const first = deferred<AutosaveResult>();
    const onSave = vi.fn(async (value: string): Promise<AutosaveResult> => {
      calls.push(value);
      if (calls.length === 1) return first.promise;
      return { ok: true };
    });
    const controller = new AutosaveController<string>("", { onSave, delayMs: 500 });

    controller.notifyValueChanged("first value");
    await vi.advanceTimersByTimeAsync(500);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().status).toBe("saving");

    // Value changes again while the first save is still in flight.
    controller.notifyValueChanged("second value");
    await vi.advanceTimersByTimeAsync(500);
    // Still only one request actually in flight -- the second is queued,
    // not fired as a concurrent, out-of-order request.
    expect(onSave).toHaveBeenCalledTimes(1);

    first.resolve({ ok: true });
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));

    expect(calls).toEqual(["first value", "second value"]);
  });

  it("moves saving -> saved -> idle on success, with 'saved' clearing itself after the pulse window", async () => {
    const onSave = vi.fn(async (): Promise<AutosaveResult> => ({ ok: true }));
    const controller = new AutosaveController<string>("", { onSave, delayMs: 500, savedPulseMs: 1000 });

    controller.notifyValueChanged("a note");
    await vi.advanceTimersByTimeAsync(500);
    expect(controller.getSnapshot().status).toBe("saved");

    await vi.advanceTimersByTimeAsync(999);
    expect(controller.getSnapshot().status).toBe("saved");

    await vi.advanceTimersByTimeAsync(1);
    expect(controller.getSnapshot().status).toBe("idle");
  });

  it("surfaces a failed save as an error status with the message, and lets retry() re-attempt it", async () => {
    const onSave = vi
      .fn<(value: string) => Promise<AutosaveResult>>()
      .mockResolvedValueOnce({ ok: false, error: "network unreachable" })
      .mockResolvedValueOnce({ ok: true });
    const controller = new AutosaveController<string>("", { onSave, delayMs: 500 });

    controller.notifyValueChanged("a note");
    await vi.advanceTimersByTimeAsync(500);

    expect(controller.getSnapshot()).toEqual({ status: "error", error: "network unreachable" });

    controller.retry();
    await vi.waitFor(() => expect(controller.getSnapshot().status).toBe("saved"));
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("notifies subscribers on every status transition and stops after unsubscribe", async () => {
    const onSave = vi.fn(async (): Promise<AutosaveResult> => ({ ok: true }));
    const controller = new AutosaveController<string>("", { onSave, delayMs: 500 });
    const seen: string[] = [];
    const unsubscribe = controller.subscribe(() => seen.push(controller.getSnapshot().status));

    controller.notifyValueChanged("a note");
    await vi.advanceTimersByTimeAsync(500);
    expect(seen).toEqual(["saving", "saved"]);

    unsubscribe();
    controller.notifyValueChanged("another note");
    await vi.advanceTimersByTimeAsync(500);
    expect(seen).toEqual(["saving", "saved"]); // unchanged -- no longer subscribed
  });
});
