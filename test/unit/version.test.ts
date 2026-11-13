import * as assert from "node:assert/strict";
import { parseVersion } from "../../src/version";

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
