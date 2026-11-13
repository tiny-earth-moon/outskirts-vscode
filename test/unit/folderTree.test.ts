import * as assert from "node:assert/strict";
import { Finding } from "../../src/findings";
import { FolderNode } from "../../src/folderModel";
import { TreeContext, treeChildren } from "../../src/folderTree";
import { FolderResults } from "../../src/resultsStore";
import { ResultGroup } from "../../src/treeModel";

const app = { key: "file:///app", name: "App", root: "/app" };
const library = { key: "file:///library", name: "Library", root: "/library" };

function results(file: string): FolderResults {
  const finding: Finding = { file, line: 0, column: 0, kind: "function", name: "a()", code: "unused", message: "Unused" };
  return { findings: [finding], severity: "warning", scannedAt: 0, stale: new Set<string>() };
}

function context(folders: TreeContext["folders"], entries: [string, FolderResults][]): TreeContext {
  return { folders, results: new Map(entries), groupBy: "file", scanning: undefined, now: 60_000 };
}

describe("treeChildren", () => {
  it("shows the groups directly with one folder", () => {
    const tree = context([app], [[app.key, results("/app/Sources/A.swift")]]);
    const groups = treeChildren(tree) as ResultGroup[];
    assert.deepEqual(groups.map((group) => [group.label, group.description]), [["A.swift", "Sources"]]);
  });

  it("shows one node per folder when there are several", () => {
    const tree = context([app, library], [[library.key, results("/library/B.swift")]]);
    const nodes = treeChildren(tree) as FolderNode[];
    assert.deepEqual(nodes.map((node) => [node.name, node.description]), [
      ["App", "not scanned"],
      ["Library", "1 result · 1 min ago"],
    ]);
    assert.deepEqual(treeChildren(tree, nodes[0]), []);
    const [group] = treeChildren(tree, nodes[1]) as ResultGroup[];
    assert.equal(group.label, "B.swift");
    assert.equal(group.folder, library.key);
  });

  it("is empty before any scan", () => {
    assert.deepEqual(treeChildren(context([app, library], [])), []);
  });
});
