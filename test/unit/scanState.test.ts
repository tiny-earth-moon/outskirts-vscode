import * as assert from "node:assert/strict";
import { ScanState } from "../../src/scanState";

describe("ScanState", () => {
  it("stays running between the projects of All projects and names the one being scanned", async () => {
    const events: boolean[] = [];
    const state = new ScanState((running) => events.push(running));
    const seen: [boolean, string | undefined][] = [];
    await state.sequence([{ key: "a" }, { key: "b" }], async () => {
      seen.push([state.running, state.scanning]);
      await Promise.resolve();
    }, () => false);
    assert.deepEqual(seen, [[true, "a"], [true, "b"]]);
    assert.deepEqual(events, [true, true, false]);
    assert.equal(state.running, false);
    assert.equal(state.scanning, undefined);
  });

  it("stops before the next project once stopped, and ends even when a scan throws", async () => {
    const events: boolean[] = [];
    const state = new ScanState((running) => events.push(running));
    let stop = false;
    const scanned: string[] = [];
    await state.sequence([{ key: "a" }, { key: "b" }], async (project) => {
      scanned.push(project.key);
      stop = true;
      await Promise.resolve();
    }, () => stop);
    assert.deepEqual(scanned, ["a"]);
    await assert.rejects(state.sequence([{ key: "c" }], () => Promise.reject(new Error("boom")), () => false));
    assert.deepEqual(events, [true, false, true, false]);
    assert.equal(state.running, false);
  });
});
