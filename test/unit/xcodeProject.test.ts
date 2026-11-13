import * as assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { buildScanArguments } from "../../src/scanArguments";
import { ProjectChoiceError, projectArguments, readProjectFolder } from "../../src/xcodeProject";

const folder = (entries: string[], configuration?: string) => ({ name: "App", entries, configuration });

describe("projectArguments", () => {
  it("names the only Xcode project of the folder", () => {
    assert.deepEqual(projectArguments(folder(["App.xcodeproj", "Sources"]), []), ["--project", "App.xcodeproj"]);
  });

  it("prefers the workspace to the project", () => {
    assert.deepEqual(projectArguments(folder(["App.xcodeproj", "App.xcworkspace", "Pods"]), []), ["--project", "App.xcworkspace"]);
  });

  it("asks to choose among several workspaces, or several projects without a workspace", () => {
    assert.throws(() => projectArguments(folder(["B.xcworkspace", "A.xcworkspace", "A.xcodeproj"]), []), (error: unknown) =>
      error instanceof ProjectChoiceError && error.message.includes("several Xcode workspaces (A.xcworkspace, B.xcworkspace)"));
    assert.throws(() => projectArguments(folder(["A.xcodeproj", "B.xcodeproj"]), []), ProjectChoiceError);
  });

  it("names nothing for a Swift package, which outskirts finds by itself", () => {
    assert.deepEqual(projectArguments(folder(["Package.swift", "App.xcodeproj"]), []), []);
    assert.deepEqual(projectArguments(folder([".outskirts.yml"], "retain_public: true\n"), []), []);
  });

  it("leaves the project to the extra arguments that name it", () => {
    for (const extra of [["--project", "Other.xcodeproj"], ["--project=Other.xcodeproj"], ["--config", "ci.yml"], ["--generic-project-config", "g.json"]]) {
      assert.deepEqual(projectArguments(folder(["A.xcodeproj", "B.xcodeproj"]), extra), [], extra.join(" "));
    }
    assert.deepEqual(projectArguments(folder(["App.xcodeproj"]), ["--", "--project", "x"]), ["--project", "App.xcodeproj"]);
  });

  it("leaves the project to the configuration file that names it", () => {
    assert.deepEqual(projectArguments(folder(["App.xcodeproj", ".outskirts.yml"], "schemes:\n  - App\nproject: App.xcodeproj\n"), []), []);
    assert.deepEqual(projectArguments(folder(["App.xcodeproj", ".outskirts.yml"], "schemes:\n  - App\n"), []), ["--project", "App.xcodeproj"]);
  });
});

describe("scan arguments of an Xcode folder", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "outskirts-xcode-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("passes the workspace of a folder that holds only Xcode files", async () => {
    mkdirSync(path.join(root, "App.xcodeproj"));
    mkdirSync(path.join(root, "App.xcworkspace"));
    writeFileSync(path.join(root, ".outskirts.yml"), "schemes:\n  - App\n");
    const extra = ["--retain-public"];
    assert.deepEqual(buildScanArguments(extra, { project: projectArguments(await readProjectFolder(root), extra) }), [
      "scan", "--format", "json", "--quiet", "--project", "App.xcworkspace", "--retain-public",
    ]);
  });

  it("passes no project when the configuration file names it", async () => {
    mkdirSync(path.join(root, "App.xcodeproj"));
    writeFileSync(path.join(root, ".periphery.yml"), "project: App.xcodeproj\nschemes:\n  - App\n");
    assert.deepEqual(projectArguments(await readProjectFolder(root), []), []);
  });
});
