import * as assert from "node:assert/strict";
import { parseVersion, printsResultsWhenAsked } from "../../src/version";

describe("parseVersion", () => {
  it("reads a bare version", () => {
    assert.equal(parseVersion("3.24.0\n"), "3.24.0");
  });

  it("reads a version after a name and keeps a pre-release suffix", () => {
    assert.equal(parseVersion("outskirts 3.25.0-beta.1\nmore"), "3.25.0-beta.1");
  });

  it("rejects an output without a version", () => {
    assert.equal(parseVersion(""), undefined);
    assert.equal(parseVersion("{\"results\": []}"), undefined);
  });
});

describe("printsResultsWhenAsked", () => {
  it("is false up to 3.24.0, which rejects --no-skip-stdout-results", () => {
    for (const version of ["3.24.0", "3.23.1", "3.9", "2.99.99", "nope"]) {
      assert.equal(printsResultsWhenAsked(version), false, version);
    }
  });

  it("is true after 3.24.0", () => {
    for (const version of ["3.24.1", "3.25.0-beta.1", "3.30", "4.0.0"]) {
      assert.equal(printsResultsWhenAsked(version), true, version);
    }
  });
});
