import * as assert from "node:assert/strict";
import * as path from "node:path";
import { acceptArguments, baselinePath, configValue, configuredBaseline, newSinceBaselineText, usesBaseline, withBaseline } from "../../src/baseline";

describe("baseline", () => {
  it("reads the baseline key of the configuration file", () => {
    assert.equal(configuredBaseline("# c\nbaseline: ci/baseline.json\nretain_public: true\n"), "ci/baseline.json");
    assert.equal(configuredBaseline("retain_public: true\n"), undefined);
    assert.equal(configuredBaseline(""), undefined);
    assert.equal(configuredBaseline("baseline: ''\n"), undefined);
    assert.equal(configuredBaseline("baseline: [a]\n"), undefined);
    assert.throws(() => configuredBaseline("a: [\n"));
  });

  it("resolves the configured path from the project root, else the default file", () => {
    const root = path.resolve("/p");
    assert.equal(baselinePath(root, "ci/b.json"), path.join(root, "ci", "b.json"));
    assert.equal(baselinePath(root, path.resolve("/elsewhere/b.json")), path.resolve("/elsewhere/b.json"));
    assert.equal(baselinePath(root, undefined), path.join(root, ".outskirts-baseline.json"));
  });

  it("writes a path inside the project relative to it in the configuration", () => {
    const root = path.resolve("/p");
    assert.equal(configValue(root, path.join(root, "ci", "b.json")), "ci/b.json");
    assert.equal(configValue(root, path.resolve("/q/b.json")), path.resolve("/q/b.json"));
  });

  it("builds the arguments that write the baseline", () => {
    assert.deepEqual(acceptArguments("/p/b.json"), ["--write-baseline", "/p/b.json"]);
  });

  it("tells whether a scan uses a baseline", () => {
    assert.equal(usesBaseline("b.json", []), true);
    assert.equal(usesBaseline(undefined, ["--baseline", "b.json"]), true);
    assert.equal(usesBaseline(undefined, ["--baseline=b.json"]), true);
    assert.equal(usesBaseline(undefined, ["--write-baseline", "b.json"]), false);
  });

  it("describes a project and the results with a baseline", () => {
    assert.equal(withBaseline("3 results", true), "3 results · baseline");
    assert.equal(withBaseline("3 results", false), "3 results");
    assert.equal(newSinceBaselineText(2, true), "2 new since baseline");
    assert.equal(newSinceBaselineText(2, false), undefined);
  });
});
