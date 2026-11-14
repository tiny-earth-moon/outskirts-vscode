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

  it("keeps stale files across a rescan of the same index only when asked", () => {
    const store = new ResultsStore();
    store.set("a", [finding], "warning", 1);
    store.markStale("a", finding.file);
    store.startScan("a", 2);
    store.set("a", [finding], "warning", 3, true);
    assert.deepEqual(store.get("a")?.stale, new Set([finding.file]));
    store.startScan("a", 4);
    store.set("a", [finding], "warning", 5);
    assert.deepEqual(store.get("a")?.stale, new Set<string>());
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

  it("drops the results of a scan that ends after its project was removed", () => {
    const store = new ResultsStore();
    let changes = 0;
    store.onDidChange(() => changes++);
    store.retain(["a", "b"]);
    store.retain(["b"]);
    assert.equal(store.set("a", [finding], "warning", 1), false);
    assert.equal(store.get("a"), undefined);
    assert.equal(store.total, 0);
    assert.equal(changes, 0);
    assert.equal(store.set("b", [finding], "warning", 1), true);
    store.retain(["a", "b"]);
    assert.equal(store.set("a", [finding], "warning", 2), true);
    assert.equal(store.total, 2);
  });

  it("changes the severity of the results already shown, without a new scan", () => {
    const store = new ResultsStore();
    let changes = 0;
    store.onDidChange(() => changes++);
    store.set("a", [finding], "warning", 1);
    store.markStale("a", finding.file);
    assert.equal(store.setSeverity("a", "error"), true);
    assert.equal(store.setSeverity("a", "error"), false);
    assert.equal(store.setSeverity("b", "error"), false);
    assert.deepEqual(store.get("a"), { findings: [finding], severity: "error", scannedAt: 1, stale: new Set([finding.file]) });
    assert.equal(changes, 3);
  });

  it("marks stale the results of the files changed while their scan ran", () => {
    const store = new ResultsStore();
    const other: Finding = { ...finding, file: "/a/B.swift" };
    store.noteChange(finding.file);
    store.startScan("a");
    store.startScan("b");
    assert.deepEqual(store.scanned, ["a", "b"]);
    store.noteChange(finding.file);
    store.noteChange("/a/.build/debug/A.o");
    store.set("a", [finding, other], "warning", 1);
    assert.deepEqual([...(store.get("a")?.stale ?? [])], [finding.file]);
    store.endScan("b");
    assert.deepEqual(store.scanned, []);
    store.startScan("a");
    store.set("a", [finding], "warning", 2);
    assert.equal(store.get("a")?.stale.size, 0);
  });

  it("ignores a change reported late but written before the scan started", () => {
    const store = new ResultsStore();
    store.startScan("a", 100);
    store.noteChange(finding.file, 99);
    store.set("a", [finding], "warning", 150);
    assert.equal(store.get("a")?.stale.size, 0);
    assert.equal(store.markStale("a", finding.file, 99), false);
    assert.equal(store.get("a")?.stale.size, 0);
    assert.equal(store.markStale("a", finding.file, 100), true);

    store.startScan("a", 200);
    store.noteChange(finding.file, 200);
    store.set("a", [finding], "warning", 250);
    assert.deepEqual([...(store.get("a")?.stale ?? [])], [finding.file]);

    store.set("b", [finding], "warning", 300);
    assert.equal(store.markStale("b", finding.file, 0), true);
  });

  it("forgets the changes of a scan that ends without results", () => {
    const store = new ResultsStore();
    store.startScan("a");
    store.noteChange(finding.file);
    store.endScan("a");
    store.set("a", [finding], "warning", 1);
    assert.equal(store.get("a")?.stale.size, 0);
  });

  it("derives the state of a folder", () => {
    assert.equal(resultsState(undefined), "none");
    assert.equal(resultsState({ findings: [], severity: "warning", scannedAt: 0, stale: new Set<string>() }), "empty");
    assert.equal(resultsState({ findings: [finding], severity: "warning", scannedAt: 0, stale: new Set<string>() }), "results");
  });
});
