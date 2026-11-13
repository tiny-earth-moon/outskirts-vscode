import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { toFindings } from "../../src/findings";
import { parseResults } from "../../src/results";

const fixture = readFileSync(path.join(__dirname, "../../../test/fixtures/scan.json"), "utf8");

describe("toFindings", () => {
  it("maps the real scan output to 0-based positions in the scanned folder", () => {
    const findings = toFindings(parseResults(fixture), "/work/pkg");
    assert.deepEqual(findings, [
      {
        file: path.resolve("/work/pkg", "Sources/Demo/main.swift"),
        line: 2,
        column: 5,
        kind: "function",
        name: "unusedHelper()",
        code: "unused",
        message: "Unused function 'unusedHelper()'",
      },
    ]);
  });

  it("keeps absolute paths and strips hint arguments from the code", () => {
    const [finding] = toFindings(
      [{ kind: "var.instance", name: "cache", hints: ["redundantConformance(replace with: 'A')"], location: "/a:b/File.swift:10:3" }],
      "/work",
    );
    assert.equal(finding.file, "/a:b/File.swift");
    assert.equal(finding.line, 9);
    assert.equal(finding.code, "redundantConformance");
    assert.equal(finding.message, "redundantConformance(replace with: 'A'): property 'cache'");
  });

  it("rejects a location without line and column", () => {
    assert.throws(() => toFindings([{ kind: "class", name: "A", hints: ["unused"], location: "File.swift" }], "/w"));
  });
});
