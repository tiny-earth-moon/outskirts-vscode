import * as assert from "node:assert/strict";
import { installHint, OptionsSnapshot, optionRows } from "../../src/optionsModel";

const snapshot: OptionsSnapshot = {
  skipBuild: false,
  severity: "warning",
  arguments: [],
  groupBy: "file",
  executable: "outskirts",
  version: { state: "found", version: "3.24.0" },
};

describe("optionRows", () => {
  it("lists the five options with their current values", () => {
    const rows = optionRows(snapshot);
    assert.deepEqual(rows.map((row) => row.label), ["Reuse existing index", "Severity", "Extra arguments", "Group results", "outskirts"]);
    assert.deepEqual(rows.map((row) => row.description), ["--skip-build", "warning", "none", "by file", "outskirts 3.24.0"]);
  });

  it("checks the index row only when skipBuild is set", () => {
    assert.equal(optionRows(snapshot)[0].checked, false);
    assert.equal(optionRows({ ...snapshot, skipBuild: true })[0].checked, true);
    assert.equal(optionRows(snapshot)[1].checked, undefined);
  });

  it("re-quotes the extra arguments and names the grouping", () => {
    const rows = optionRows({ ...snapshot, arguments: ["--schemes", "My App"], groupBy: "kind" });
    assert.equal(rows[2].description, "--schemes 'My App'");
    assert.equal(rows[3].description, "by kind");
  });

  it("says when the executable is missing and gives the install hint", () => {
    const row = optionRows({ ...snapshot, version: { state: "missing" } })[4];
    assert.equal(row.description, "outskirts · not found");
    assert.equal(row.tooltip, installHint);
  });
});
