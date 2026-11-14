import * as assert from "node:assert/strict";
import { Finding } from "../../src/findings";
import { treeChildren, TreeContext } from "../../src/folderTree";
import { filterDescription, filterFindings, isActive, kindCounts, noFilter, parseFilter } from "../../src/resultsFilter";
import { FolderResults } from "../../src/resultsStore";
import { ResultGroup } from "../../src/treeModel";

function finding(file: string, kind: string, code: string | undefined, name: string): Finding {
  return { file, line: 0, column: 0, kind, name, code, message: name };
}

const findings = [
  finding("/w/A.swift", "function", "unused", "run"),
  finding("/w/A.swift", "property", "unused", "count"),
  finding("/w/B.swift", "function", "unused", "stop"),
  finding("/w/B.swift", "protocol", "redundantProtocol", "Runner"),
  finding("/w/C.swift", "imported module", "unusedParameterX", "Foundation"),
];

describe("results filter", () => {
  it("counts the kinds present, unused split by declaration kind, unknown hints raw", () => {
    assert.deepEqual(kindCounts(findings).map((kind) => [kind.key, kind.label, kind.count]), [
      ["unused:function", "Unused function", 2],
      ["redundantProtocol", "Redundant protocol", 1],
      ["unused:property", "Unused property", 1],
      ["unusedParameterX", "unusedParameterX", 1],
    ]);
  });

  it("filters by kind and by name or path, case-insensitively", () => {
    assert.deepEqual(filterFindings(findings, { kinds: ["unused:function"], text: "" }).map((item) => item.name), ["run", "stop"]);
    assert.deepEqual(filterFindings(findings, { kinds: [], text: "b.SWIFT" }).map((item) => item.name), ["stop", "Runner"]);
    assert.deepEqual(filterFindings(findings, { kinds: ["unused:function", "redundantProtocol"], text: "run" }).map((item) => item.name), ["run", "Runner"]);
  });

  it("describes an active filter only", () => {
    assert.equal(filterDescription(findings, noFilter), undefined);
    assert.equal(isActive({ kinds: [], text: "  " }), false);
    assert.equal(filterDescription(findings, { kinds: ["unused:property"], text: "" }), "Filtered: 1 of 5");
  });

  it("reads a stored filter defensively", () => {
    assert.deepEqual(parseFilter(undefined), noFilter);
    assert.deepEqual(parseFilter({ kinds: ["a", 3], text: 4 }), { kinds: ["a"], text: "" });
  });
});

describe("filtered tree", () => {
  const entry: FolderResults = { findings, severity: "warning", scannedAt: 0, stale: new Set() };
  const context = (filter = noFilter, groupBy: "file" | "kind" = "file"): TreeContext => ({
    folders: [{ key: "file:///w", name: "w", root: "/w" }],
    results: new Map([["file:///w", entry]]),
    groupBy,
    scanning: undefined,
    now: 0,
    filter,
  });

  it("filters both groupings", () => {
    const byFile = treeChildren(context({ kinds: [], text: "stop" })) as ResultGroup[];
    assert.deepEqual(byFile.map((group) => [group.label, group.findings.length]), [["B.swift", 1]]);
    const byKind = treeChildren(context({ kinds: ["unused:function"], text: "" }, "kind")) as ResultGroup[];
    assert.deepEqual(byKind.map((group) => [group.label, group.findings.length]), [["Unused", 2]]);
  });

  it("shows a message when nothing matches", () => {
    assert.deepEqual(treeChildren(context({ kinds: [], text: "nothing" })), [{ notice: "No results match the filter — Clear Filter" }]);
  });
});
