import * as assert from "node:assert/strict";
import { nodeScope, projectsWithResults } from "../../src/agentScope";
import { Finding } from "../../src/findings";
import { folderNode } from "../../src/folderModel";
import { FolderResults } from "../../src/resultsStore";
import { groupFindings } from "../../src/treeModel";

function finding(file: string, line: number): Finding {
  return { file, line, column: 0, kind: "function", name: `f${String(line)}()`, code: "unused", message: "Unused" };
}

const appFindings = [finding("/app/A.swift", 1), finding("/app/B.swift", 2), finding("/app/B.swift", 5)];
const results = new Map<string, FolderResults>([
  ["file:///app", { findings: appFindings, severity: "warning", scannedAt: 0, stale: new Set<string>() }],
  ["file:///library", { findings: [], severity: "warning", scannedAt: 0, stale: new Set<string>() }],
]);

describe("nodeScope", () => {
  it("takes every result of a project node", () => {
    const node = folderNode({ key: "file:///app", name: "App", root: "/app" }, results.get("file:///app"), false, 0);
    assert.deepEqual(nodeScope(node, results), { project: "file:///app", findings: appFindings });
    const empty = folderNode({ key: "file:///library", name: "Library", root: "/library" }, results.get("file:///library"), false, 0);
    assert.deepEqual(nodeScope(empty, results), { project: "file:///library", findings: [] });
  });

  it("takes the results of a file group", () => {
    const [, group] = groupFindings(appFindings, "file", "/app", "file:///app");
    assert.deepEqual(nodeScope(group, results), { project: "file:///app", findings: [appFindings[1], appFindings[2]] });
  });

  it("takes a single result and finds its project", () => {
    assert.deepEqual(nodeScope(appFindings[2], results), { project: "file:///app", findings: [appFindings[2]] });
    assert.equal(nodeScope(finding("/app/B.swift", 5), results), undefined);
  });
});

describe("projectsWithResults", () => {
  it("keeps the projects that have results, in their order", () => {
    assert.deepEqual(projectsWithResults(["file:///library", "file:///app", "file:///other"], results), ["file:///app"]);
  });
});
