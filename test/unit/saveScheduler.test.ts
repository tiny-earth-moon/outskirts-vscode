import * as assert from "node:assert/strict";
import { SaveScheduler, SaveSchedulerHost, ScanOnSaveMode, Timers, saveDelay, saveMode } from "../../src/saveScheduler";

class FakeClock implements Timers {
  now = 0;
  private next = 0;
  private readonly pending = new Map<number, { at: number; callback: () => void }>();
  set(callback: () => void, ms: number): unknown {
    this.next += 1;
    this.pending.set(this.next, { at: this.now + ms, callback });
    return this.next;
  }
  clear(handle: unknown): void {
    this.pending.delete(handle as number);
  }
  advance(ms: number): void {
    this.now += ms;
    for (const [handle, timer] of [...this.pending].sort((a, b) => a[1].at - b[1].at)) {
      if (timer.at <= this.now) {
        this.pending.delete(handle);
        timer.callback();
      }
    }
  }
}

function setup(overrides: Partial<{ mode: ScanOnSaveMode; delay: number; scanned: string[] }> = {}) {
  const clock = new FakeClock();
  const started: string[][] = [];
  const state = { busy: false, mode: overrides.mode ?? "project", scanned: new Set(overrides.scanned ?? ["/a", "/b"]) };
  const host: SaveSchedulerHost = {
    mode: () => state.mode,
    delay: () => overrides.delay ?? 1500,
    projectOf: (file) => (file.startsWith("/a/") ? "/a" : file.startsWith("/b/") ? "/b" : undefined),
    eligible: (project) => state.scanned.has(project),
    busy: () => state.busy,
    start: (projects) => {
      started.push([...projects]);
    },
  };
  return { clock, started, state, scheduler: new SaveScheduler(host, clock) };
}

describe("SaveScheduler", () => {
  it("debounces saves and scans once after the last one", () => {
    const { clock, started, scheduler } = setup();
    scheduler.saved("/a/One.swift");
    clock.advance(1000);
    scheduler.saved("/a/One.swift");
    clock.advance(1000);
    assert.deepEqual(started, []);
    clock.advance(500);
    assert.deepEqual(started, [["/a"]]);
  });

  it("coalesces saves across files of the same project", () => {
    const { clock, started, scheduler } = setup();
    scheduler.saved("/a/One.swift");
    scheduler.saved("/a/Two.swift");
    clock.advance(1500);
    assert.deepEqual(started, [["/a"]]);
  });

  it("queues one rerun while a scan runs, then starts it when idle", () => {
    const { clock, started, state, scheduler } = setup();
    state.busy = true;
    scheduler.saved("/a/One.swift");
    clock.advance(1500);
    scheduler.saved("/a/Two.swift");
    clock.advance(1500);
    scheduler.saved("/b/Three.swift");
    clock.advance(1500);
    scheduler.idle();
    assert.deepEqual(started, []);
    state.busy = false;
    scheduler.idle();
    scheduler.idle();
    assert.deepEqual(started, [["/a", "/b"]]);
  });

  it("does nothing when off", () => {
    const { clock, started, scheduler } = setup({ mode: "off" });
    scheduler.saved("/a/One.swift");
    clock.advance(5000);
    assert.deepEqual(started, []);
  });

  it("ignores unknown and never scanned projects", () => {
    const { clock, started, scheduler } = setup({ scanned: ["/a"] });
    scheduler.saved("/c/One.swift");
    scheduler.saved("/b/One.swift");
    clock.advance(5000);
    assert.deepEqual(started, []);
  });

  it("drops a queued rerun when the mode is turned off meanwhile", () => {
    const { clock, started, state, scheduler } = setup();
    state.busy = true;
    scheduler.saved("/a/One.swift");
    clock.advance(1500);
    state.mode = "off";
    state.busy = false;
    scheduler.idle();
    assert.deepEqual(started, []);
  });

  it("cancels pending timers on dispose", () => {
    const { clock, started, scheduler } = setup();
    scheduler.saved("/a/One.swift");
    scheduler.dispose();
    clock.advance(5000);
    assert.deepEqual(started, []);
  });

  it("reads the settings with a floor on the delay", () => {
    assert.equal(saveMode("project"), "project");
    assert.equal(saveMode("bogus"), "off");
    assert.equal(saveDelay(100), 500);
    assert.equal(saveDelay(2000), 2000);
    assert.equal(saveDelay(undefined), 1500);
  });
});
