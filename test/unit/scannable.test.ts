import * as assert from "node:assert/strict";
import { isScannableRoot } from "../../src/scannable";

describe("isScannableRoot", () => {
  it("accepts a package, a project, a workspace, a project spec or a configuration", () => {
    for (const name of ["Package.swift", "App.xcodeproj", "App.xcworkspace", "project.yml", ".outskirts.yml", ".periphery.yml"]) {
      assert.equal(isScannableRoot(["README.md", name]), true, name);
    }
  });

  it("rejects other folders", () => {
    assert.equal(isScannableRoot([]), false);
    assert.equal(isScannableRoot(["README.md", "Sources", "package.json", "project.yaml"]), false);
  });
});
