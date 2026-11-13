import * as assert from "node:assert/strict";
import { scanSummary, sequenceSummary, statusTooltip } from "../../src/summary";

describe("scanSummary", () => {
  it("names the scanned folder", () => {
    assert.equal(scanSummary(0, "App"), "No unused code found in App.");
    assert.equal(scanSummary(1, "App"), "1 result in App.");
    assert.equal(scanSummary(12, "App"), "12 results in App.");
  });
});

describe("sequenceSummary", () => {
  it("sums the results of every folder", () => {
    assert.equal(sequenceSummary([3, 9]), "12 results in 2 folders.");
    assert.equal(sequenceSummary([0, 0]), "No unused code found in 2 folders.");
    assert.equal(sequenceSummary([1]), "1 result in 1 folder.");
  });
});

describe("statusTooltip", () => {
  it("lists the count of each folder", () => {
    assert.equal(
      statusTooltip([{ name: "App", count: 12 }, { name: "Library", count: undefined }]),
      "App: 12 results\nLibrary: not scanned",
    );
  });

  it("mentions the files to rescan", () => {
    assert.equal(statusTooltip([{ name: "App", count: 12, stale: 2 }]), "App: 12 results · 2 to rescan");
  });
});
