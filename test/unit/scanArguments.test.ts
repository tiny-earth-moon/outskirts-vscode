import * as assert from "node:assert/strict";
import { resolveExecutable } from "../../src/executable";
import { buildScanArguments } from "../../src/scanArguments";

describe("buildScanArguments", () => {
  it("asks for quiet JSON and appends the extra arguments", () => {
    assert.deepEqual(buildScanArguments(["--schemes", "App"]), ["scan", "--format", "json", "--quiet", "--schemes", "App"]);
  });

  it("asks to reuse the index before the extra arguments when skipBuild is set", () => {
    assert.deepEqual(buildScanArguments(["--schemes", "App"], { skipBuild: true }), ["scan", "--format", "json", "--quiet", "--skip-build", "--schemes", "App"]);
  });

  it("names the Xcode project before the extra arguments", () => {
    assert.deepEqual(buildScanArguments(["--schemes", "App"], { skipBuild: true, project: ["--project", "App.xcworkspace"] }), [
      "scan", "--format", "json", "--quiet", "--skip-build", "--project", "App.xcworkspace", "--schemes", "App",
    ]);
  });
});

describe("buildScanArguments with an outskirts that can be told to print the results", () => {
  it("asks for the results on stdout before the extra arguments, which keep the last word", () => {
    assert.deepEqual(buildScanArguments(["--schemes", "App", "--", "-quiet"], { printResults: true }), [
      "scan", "--format", "json", "--quiet", "--no-skip-stdout-results", "--schemes", "App", "--", "-quiet",
    ]);
    assert.equal(buildScanArguments([]).includes("--no-skip-stdout-results"), false);
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
