import * as assert from "node:assert/strict";
import { Finding } from "../../src/findings";
import { ResultsStore, resultsState } from "../../src/resultsStore";

const finding: Finding = { file: "/a/A.swift", line: 0, column: 0, kind: "function", name: "a()", message: "Unused" };

describe("ResultsStore", () => {
  it("keeps the results of each folder apart", () => {
    const store = new ResultsStore();
    store.set("a", [finding], "warning", 1);
    store.set("b", [], "error", 2);
    store.set("b", [finding, finding], "error", 3);
    assert.deepEqual(store.get("a"), { findings: [finding], severity: "warning", scannedAt: 1, stale: new Set<string>() });
    assert.equal(store.get("b")?.findings.length, 2);
    assert.equal(store.total, 3);
  });

  it("clears one folder or all of them", () => {
    const store = new ResultsStore();
    store.set("a", [finding], "warning", 1);
    store.set("b", [finding], "warning", 1);
    store.clear("a");
    assert.equal(store.get("a"), undefined);
    assert.equal(store.get("b")?.findings.length, 1);
    store.clearAll();
    assert.equal(store.all().size, 0);
  });

  it("drops the folders removed from the workspace", () => {
    const store = new ResultsStore();
    let changes = 0;
    store.onDidChange(() => changes++);
    store.set("a", [finding], "warning", 1);
    store.set("b", [finding], "warning", 1);
    store.retain(["b", "c"]);
    assert.deepEqual([...store.all().keys()], ["b"]);
    store.retain(["b"]);
    assert.equal(changes, 3);
  });

  it("derives the state of a folder", () => {
    assert.equal(resultsState(undefined), "none");
    assert.equal(resultsState({ findings: [], severity: "warning", scannedAt: 0, stale: new Set<string>() }), "empty");
    assert.equal(resultsState({ findings: [finding], severity: "warning", scannedAt: 0, stale: new Set<string>() }), "results");
  });
});
