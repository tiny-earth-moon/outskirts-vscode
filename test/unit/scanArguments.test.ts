import * as assert from "node:assert/strict";
import { resolveExecutable } from "../../src/executable";
import { buildScanArguments } from "../../src/scanArguments";

describe("buildScanArguments", () => {
  it("asks for quiet JSON and appends the extra arguments", () => {
    assert.deepEqual(buildScanArguments(["--schemes", "App"]), ["scan", "--format", "json", "--quiet", "--schemes", "App"]);
  });

  it("asks to reuse the index before the extra arguments when skipBuild is set", () => {
    assert.deepEqual(buildScanArguments(["--schemes", "App"], true), ["scan", "--format", "json", "--quiet", "--skip-build", "--schemes", "App"]);
  });
});

describe("resolveExecutable", () => {
  it("ignores workspace values", () => {
    assert.equal(
      resolveExecutable({ defaultValue: "outskirts", workspaceValue: "/evil", workspaceFolderValue: "/evil2" }),
      "outskirts",
    );
  });

  it("uses the user value", () => {
    assert.equal(resolveExecutable({ defaultValue: "outskirts", globalValue: "/opt/bin/outskirts", workspaceValue: "/evil" }), "/opt/bin/outskirts");
  });

  it("rejects an empty value", () => {
    assert.throws(() => resolveExecutable({ globalValue: " " }));
  });
});
