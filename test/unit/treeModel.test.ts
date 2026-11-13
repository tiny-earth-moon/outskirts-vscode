import * as assert from "node:assert/strict";
import { Finding } from "../../src/findings";
import { groupFindings, hintLabel, leafDescription, leafLabel } from "../../src/treeModel";

function finding(file: string, line: number, code: string | undefined, name = "x"): Finding {
  return { file, line, column: 0, kind: "function", name, code, message: `${String(code)} ${name}` };
}

const findings = [
  finding("/w/Sources/B.swift", 9, "unused", "b2"),
  finding("/w/Sources/B.swift", 2, "redundantPublicAccessibility", "b1"),
  finding("/w/A.swift", 4, "unused", "a"),
  finding("/w/Sources/B.swift", 5, "unusedImport", "Foundation"),
];

describe("groupFindings", () => {
  it("groups by file, sorted by name, with results sorted by line", () => {
    const groups = groupFindings(findings, "file", "/w");
    assert.deepEqual(groups.map((group) => [group.label, group.description, group.findings.map((item) => item.line)]), [
      ["A.swift", undefined, [4]],
      ["B.swift", "Sources", [2, 5, 9]],
    ]);
  });

  it("groups by kind of finding with readable labels", () => {
    const groups = groupFindings(findings, "kind", "/w");
    assert.deepEqual(groups.map((group) => [group.label, group.findings.length]), [
      ["Redundant public accessibility", 1],
      ["Unused", 2],
      ["Unused import", 1],
    ]);
    assert.deepEqual(groups[1].findings.map((item) => item.name), ["a", "b2"]);
  });

  it("returns no group without results", () => {
    assert.deepEqual(groupFindings([], "kind"), []);
  });
});

describe("tree labels", () => {
  it("names the declaration and its line", () => {
    const item = finding("/w/A.swift", 4, "unused", "helper()");
    assert.equal(leafLabel(item), "function helper()");
    assert.equal(leafDescription(item, "file"), "Unused, line 5");
    assert.equal(leafDescription(item, "kind"), "A.swift, line 5");
  });

  it("derives a label for an unknown hint", () => {
    assert.equal(hintLabel("redundantConformance"), "Redundant conformance");
    assert.equal(hintLabel(undefined), "Other");
  });
});
