import * as assert from "node:assert/strict";
import { Finding } from "../../src/findings";
import { folderDescription, folderNode, nextDescriptionChange, nextTimeChange, relativeTime, viewState } from "../../src/folderModel";
import { FolderResults } from "../../src/resultsStore";

const finding: Finding = { file: "/a/A.swift", line: 0, column: 0, kind: "function", name: "a()", message: "Unused" };
const now = 10_000_000;
const app = { key: "file:///app", name: "App", root: "/app" };
const library = { key: "file:///library", name: "Library", root: "/library" };

function results(count: number, ago: number): FolderResults {
  return { findings: Array<Finding>(count).fill(finding), severity: "warning", scannedAt: now - ago, stale: new Set<string>() };
}

describe("time of the last scan in the side bar", () => {
  it("is refreshed when its text changes: each minute, then each hour, then each day", () => {
    assert.equal(nextTimeChange(30_000), 30_000);
    assert.equal(relativeTime(30_000 + nextTimeChange(30_000)), "1 min ago");
    assert.equal(nextTimeChange(59 * 60_000 + 10_000), 50_000);
    assert.equal(nextTimeChange(90 * 60_000), 30 * 60_000);
    assert.equal(nextTimeChange(30 * 3_600_000), 18 * 3_600_000);
  });

  it("is refreshed for the next project to change, and not at all without results", () => {
    const entry = (findings: number, scannedAt: number) => ({
      findings: Array.from({ length: findings }, () => ({ file: "/a", line: 0, column: 0, kind: "class", name: "A", message: "m" })),
      severity: "warning",
      scannedAt,
      stale: new Set<string>(),
    });
    assert.equal(nextDescriptionChange(new Map([["a", entry(1, 0)], ["b", entry(1, 50_000)]]), 70_000), 40_000);
    assert.equal(nextDescriptionChange(new Map([["a", entry(0, 0)]]), 70_000), undefined);
    assert.equal(nextDescriptionChange(new Map(), 70_000), undefined);
  });
});

describe("relativeTime", () => {
  it("rounds down to minutes, hours or days", () => {
    assert.equal(relativeTime(30_000), "just now");
    assert.equal(relativeTime(5 * 60_000 + 59_000), "5 min ago");
    assert.equal(relativeTime(3 * 3_600_000), "3 h ago");
    assert.equal(relativeTime(2 * 86_400_000), "2 d ago");
  });
});

describe("folderDescription", () => {
  it("describes each state of a folder", () => {
    assert.equal(folderDescription(results(12, 5 * 60_000), false, now), "12 results · 5 min ago");
    assert.equal(folderDescription(undefined, false, now), "not scanned");
    assert.equal(folderDescription(results(0, 0), false, now), "no unused code");
    assert.equal(folderDescription(results(12, 0), true, now), "scanning…");
  });

  it("counts the files to rescan without changing the count", () => {
    const entry = { ...results(12, 5 * 60_000), stale: new Set(["/a/A.swift"]) };
    assert.equal(folderDescription(entry, false, now), "12 results · 1 to rescan · 5 min ago");
    assert.equal(folderNode(app, entry, false, now).stale, true);
    assert.equal(folderNode(app, results(1, 0), false, now).stale, false);
  });

  it("expands only the folders with results", () => {
    assert.equal(folderNode(app, results(1, 0), false, now).expanded, true);
    assert.equal(folderNode(app, results(0, 0), false, now).expanded, false);
    assert.equal(folderNode(app, undefined, false, now).expanded, false);
  });
});

describe("viewState", () => {
  it("is unavailable without a scannable folder and none before a scan", () => {
    assert.equal(viewState([], new Map()), "unavailable");
    assert.equal(viewState([app, library], new Map()), "none");
  });

  it("follows the only folder, or shows folder nodes when there are several", () => {
    assert.equal(viewState([app], new Map([[app.key, results(0, 0)]])), "empty");
    assert.equal(viewState([app, library], new Map([[app.key, results(0, 0)]])), "results");
  });
});
