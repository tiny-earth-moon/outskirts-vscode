import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";

const manifest = JSON.parse(readFileSync(path.join(__dirname, "../../../package.json"), "utf8")) as { activationEvents: string[] };
const contains = manifest.activationEvents.filter((event) => event.startsWith("workspaceContains:")).map((event) => event.slice(18));

describe("activation events", () => {
  it("match a file inside Xcode bundles, since a glob only matches files", () => {
    for (const pattern of contains.filter((entry) => /[*?]/.test(entry))) {
      assert.doesNotMatch(pattern, /\.(xcodeproj|xcworkspace)$/, pattern);
    }
  });

  it("cover every project marker at the root and one level below", () => {
    for (const marker of ["Package.swift", ".outskirts.yml", ".periphery.yml", "*.xcodeproj/project.pbxproj", "*.xcworkspace/contents.xcworkspacedata"]) {
      assert.ok(contains.includes(marker), marker);
      assert.ok(contains.includes(`*/${marker}`), `*/${marker}`);
    }
  });
});
