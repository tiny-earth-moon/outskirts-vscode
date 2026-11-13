import * as assert from "node:assert/strict";
import { installHint, OptionsSnapshot, optionRows, optionsDescription } from "../../src/optionsModel";

const snapshot: OptionsSnapshot = {
  skipBuild: false,
  severity: "warning",
  arguments: [],
  groupBy: "file",
  executable: "outskirts",
  version: { state: "found", version: "3.24.0" },
  agent: { kind: "none" },
};

describe("optionRows", () => {
  it("lists the six options with their current values", () => {
    const rows = optionRows(snapshot);
    assert.deepEqual(rows.map((row) => row.label), ["Reuse existing index", "Severity", "Extra arguments", "Group results", "Executable", "Agent"]);
    assert.deepEqual(rows.map((row) => row.description), ["--skip-build", "warning", "none", "by file", "outskirts 3.24.0", "not set"]);
  });

  it("names the selected agent and says when it is not installed", () => {
    const agent = { id: "claude", name: "Claude Code", executable: "claude", args: ["${prompt}"] };
    assert.equal(optionRows({ ...snapshot, agent: { kind: "ready", agent, executable: "/bin/claude" } })[5].description, "Claude Code");
    const missing = optionRows({ ...snapshot, agent: { kind: "missing", agent } })[5];
    assert.equal(missing.description, "Claude Code (not installed)");
    assert.equal(missing.tooltip, "claude was not found on the PATH. Click to choose another agent.");
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

describe("optionsDescription", () => {
  const app = { name: "App", folderName: "App", nested: false };
  const nested = { name: "Library", folderName: "Repos", nested: true };

  it("names the project only when there are several", () => {
    assert.equal(optionsDescription(app, false), undefined);
    assert.equal(optionsDescription(app, true), "App");
    assert.equal(optionsDescription(undefined, true), undefined);
  });

  it("says that a nested project shares the options of its workspace folder", () => {
    assert.equal(optionsDescription(nested, false), "Library · shared by Repos");
    assert.equal(optionsDescription(nested, true), "Library · shared by Repos");
  });
});
