export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export type AutosaveResult = { ok: true } | { ok: false; error: string };

export type AutosaveSnapshot = { status: AutosaveStatus; error?: string };

export type AutosaveControllerOptions<T> = {
  onSave: (value: T) => Promise<AutosaveResult>;
  // Skips scheduling a save entirely -- e.g. an empty note draft shouldn't
  // hit the network (or create a row) just because a composer is open.
  isEmpty?: (value: T) => boolean;
  delayMs?: number;
  // How long the snapshot stays "saved" before reverting to "idle" on its
  // own -- what keeps a successful save a brief pulse rather than a
  // permanent label.
  savedPulseMs?: number;
};

const IDLE_SNAPSHOT: AutosaveSnapshot = { status: "idle" };

// The debounced-autosave state machine, deliberately framework-agnostic:
// plain class, no React import, testable directly with fake timers rather
// than needing a React rendering harness (this repo has neither
// @testing-library/react nor any existing precedent for testing a hook, and
// adding that dependency for one file wasn't worth it -- see
// src/lib/use-autosave.ts for the thin React wrapper around this).
//
// Race/ordering safety works by serializing writes rather than reordering
// responses after the fact: only one save ever runs at a time; if the value
// changes again while a save is in flight, that's noted and a follow-up
// save fires the moment the in-flight one resolves, carrying whatever the
// *latest* value is by then. That guarantees the persisted value always
// converges to the last thing that was actually set, and never lets an
// older, slower request's response overwrite a newer save's result,
// without needing any server-side sequencing.
export class AutosaveController<T> {
  private listeners = new Set<() => void>();
  private snapshot: AutosaveSnapshot = IDLE_SNAPSHOT;
  private latestValue: T;
  private lastSavedValue: T;
  private inFlight = false;
  private queued = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pulseTimer: ReturnType<typeof setTimeout> | null = null;
  private options: AutosaveControllerOptions<T>;

  constructor(initialValue: T, options: AutosaveControllerOptions<T>) {
    this.latestValue = initialValue;
    this.lastSavedValue = initialValue;
    this.options = options;
  }

  // Called every render by the hook wrapper so a fresh inline
  // onSave/isEmpty each render (the common case) is always what actually
  // runs, without requiring the caller to memoize anything themselves.
  updateOptions(options: AutosaveControllerOptions<T>) {
    this.options = options;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): AutosaveSnapshot => this.snapshot;

  notifyValueChanged(value: T): void {
    this.latestValue = value;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.options.isEmpty?.(value)) return;
    if (value === this.lastSavedValue) return;

    const delayMs = this.options.delayMs ?? 600;
    this.debounceTimer = setTimeout(() => {
      void this.runSave();
    }, delayMs);
  }

  retry(): void {
    void this.runSave();
  }

  destroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.pulseTimer) clearTimeout(this.pulseTimer);
    this.listeners.clear();
  }

  private setSnapshot(next: AutosaveSnapshot) {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }

  private async runSave() {
    if (this.inFlight) {
      this.queued = true;
      return;
    }
    this.inFlight = true;

    // A loop, not self-recursion: if the value changes again while this
    // save is in flight, `queued` gets set and this loops once more with
    // whatever's newest by then, inside one guarded "in flight" window
    // rather than a second, overlapping request.
    let keepGoing = true;
    while (keepGoing) {
      this.queued = false;
      if (this.pulseTimer) clearTimeout(this.pulseTimer);
      this.setSnapshot({ status: "saving" });

      const valueToSave = this.latestValue;
      const result = await this.options.onSave(valueToSave);

      if (result.ok) {
        this.lastSavedValue = valueToSave;
        this.setSnapshot({ status: "saved" });
        const savedPulseMs = this.options.savedPulseMs ?? 1800;
        this.pulseTimer = setTimeout(() => this.setSnapshot(IDLE_SNAPSHOT), savedPulseMs);
      } else {
        this.setSnapshot({ status: "error", error: result.error });
      }

      keepGoing = this.queued;
    }

    this.inFlight = false;
  }
}
