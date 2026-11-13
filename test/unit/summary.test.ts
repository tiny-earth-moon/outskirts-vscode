import * as assert from "node:assert/strict";
import { scanSummary, sequenceSummary, statusTooltip } from "../../src/summary";

describe("scanSummary", () => {
  it("says so when nothing is unused", () => {
    assert.equal(scanSummary(0), "outskirts: no unused code found.");
  });

  it("counts the results", () => {
    assert.equal(scanSummary(1), "outskirts: 1 result.");
    assert.equal(scanSummary(12), "outskirts: 12 results.");
  });

  it("names the folder when asked", () => {
    assert.equal(scanSummary(12, "App"), "outskirts: 12 results in App.");
    assert.equal(scanSummary(0, "App"), "outskirts: no unused code found in App.");
  });
});

describe("sequenceSummary", () => {
  it("sums the results of every folder", () => {
    assert.equal(sequenceSummary([3, 9]), "outskirts: 12 results in 2 folders.");
    assert.equal(sequenceSummary([0, 0]), "outskirts: no unused code found in 2 folders.");
    assert.equal(sequenceSummary([1]), "outskirts: 1 result in 1 folder.");
  });
});

describe("statusTooltip", () => {
  it("lists the count of each folder", () => {
    assert.equal(
      statusTooltip([{ name: "App", count: 12 }, { name: "Library", count: undefined }]),
      "App: 12 results\nLibrary: not scanned",
    );
  });
});
