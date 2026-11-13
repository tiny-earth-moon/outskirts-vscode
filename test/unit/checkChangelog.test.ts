import * as assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { changelogProblem } from "../../scripts/checkChangelog";

const changelog = "# Changelog\n\n## Unreleased\n\n- Next.\n\n## 0.2.0 (2026-12-01)\n\n- Second.\n\n## 0.1.0 (2026-11-13)\n\nFirst release.\n";

describe("changelogProblem", () => {
  it("accepts a version with a dated, non-empty section", () => {
    assert.equal(changelogProblem("0.2.0", changelog), undefined);
    assert.equal(changelogProblem("0.1.0", changelog), undefined);
    assert.equal(changelogProblem("0.1.0", changelog.replaceAll("\n", "\r\n")), undefined);
  });

  it("refuses a version without a section, with an undated or invalid date, or an empty section", () => {
    assert.match(changelogProblem("0.3.0", changelog) ?? "", /no "## 0\.3\.0 \(YYYY-MM-DD\)" section/);
    assert.match(changelogProblem("0.1.0", "## 0.1.0\n\n- Undated.\n") ?? "", /no "## 0\.1\.0/);
    assert.match(changelogProblem("0.1.0", "## 0.1.0 (2026-02-30)\n\n- Typo.\n") ?? "", /invalid date/);
    assert.match(changelogProblem("0.1.0", "## 0.1.0 (2026-11-13)\n\n## 0.0.9 (2026-11-01)\n\n- Old.\n") ?? "", /empty/);
    assert.match(changelogProblem("0.1.0", "## 0x1x0 (2026-11-13)\n\n- Not the version.\n") ?? "", /no "## 0\.1\.0/);
  });
});

describe("checkChangelog script", () => {
  let directory: string;
  const script = path.join(__dirname, "../../scripts/checkChangelog.js");

  before(() => {
    directory = mkdtempSync(path.join(os.tmpdir(), "outskirts-changelog-"));
    writeFileSync(path.join(directory, "CHANGELOG.md"), changelog);
  });

  after(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  function run(version: string): number | null {
    writeFileSync(path.join(directory, "package.json"), JSON.stringify({ version }));
    return spawnSync(process.execPath, [script, directory], { encoding: "utf8" }).status;
  }

  it("exits with 0 for a version of the changelog and 1 otherwise", () => {
    assert.equal(run("0.2.0"), 0);
    assert.equal(run("0.3.0"), 1);
  });
});
