import * as assert from "node:assert/strict";
import { scanSummary } from "../../src/summary";

describe("scanSummary", () => {
  it("says so when nothing is unused", () => {
    assert.equal(scanSummary(0), "outskirts: no unused code found.");
  });

  it("counts the results", () => {
    assert.equal(scanSummary(1), "outskirts: 1 result.");
    assert.equal(scanSummary(12), "outskirts: 12 results.");
  });
});
