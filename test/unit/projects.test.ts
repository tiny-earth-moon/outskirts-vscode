import * as assert from "node:assert/strict";
import { discoverProjects, FolderListing, isCandidateDirectory, projectForUri } from "../../src/projects";

function folder(name: string, entries: string[], children: [string, string[]][] = []): FolderListing {
  const key = `file:///${name.toLowerCase()}`;
  return { key, name, entries, children: children.map(([child, list]) => ({ key: `${key}/${child}`, name: child, entries: list })) };
}

describe("discoverProjects", () => {
  it("takes a scannable workspace folder as one project and ignores its sub-directories", () => {
    const projects = discoverProjects([folder("App", ["Package.swift", "Sources"], [["Tool", ["Package.swift"]]])]);
    assert.deepEqual(projects, [{ key: "file:///app", name: "App", folderKey: "file:///app", folderName: "App", nested: false }]);
  });

  it("finds the scannable sub-directories of a parent folder", () => {
    const projects = discoverProjects([
      folder("Repos", ["README.md"], [["App", ["App.xcodeproj"]], ["Notes", ["notes.txt"]], ["Library", [".outskirts.yml"]]]),
    ]);
    assert.deepEqual(projects.map((project) => [project.key, project.name, project.folderKey, project.nested]), [
      ["file:///repos/App", "App", "file:///repos", true],
      ["file:///repos/Library", "Library", "file:///repos", true],
    ]);
  });

  it("mixes root and nested projects across workspace folders", () => {
    const projects = discoverProjects([
      folder("App", ["project.yml"]),
      folder("Repos", [], [["Library", ["Package.swift"]]]),
      folder("Docs", ["index.md"]),
    ]);
    assert.deepEqual(projects.map((project) => project.name), ["App", "Library"]);
  });

  it("names equal nested projects after their workspace folder", () => {
    const projects = discoverProjects([
      folder("Work", [], [["App", ["Package.swift"]]]),
      folder("Home", [], [["App", ["Package.swift"]]]),
    ]);
    assert.deepEqual(projects.map((project) => project.name), ["App (Work)", "App (Home)"]);
  });

  it("finds nothing in a folder without projects", () => {
    assert.deepEqual(discoverProjects([folder("Notes", ["notes.txt"], [["Drafts", ["a.md"]]])]), []);
  });
});

describe("isCandidateDirectory", () => {
  it("keeps plain directories", () => {
    assert.equal(isCandidateDirectory("App", true, false), true);
  });

  it("skips files, symlinks, hidden and generated directories", () => {
    assert.equal(isCandidateDirectory("Package.swift", false, false), false);
    assert.equal(isCandidateDirectory("Link", true, true), false);
    for (const name of [".git", ".build", "node_modules", "build", "DerivedData"]) {
      assert.equal(isCandidateDirectory(name, true, false), false, name);
    }
  });
});

describe("projectForUri", () => {
  const keys = ["file:///repos", "file:///repos/App", "file:///repos/AppKit"];

  it("picks the longest project prefix", () => {
    assert.equal(projectForUri(keys, "file:///repos/App/Sources/main.swift"), "file:///repos/App");
    assert.equal(projectForUri(keys, "file:///repos/AppKit/a.swift"), "file:///repos/AppKit");
    assert.equal(projectForUri(keys, "file:///repos/README.md"), "file:///repos");
  });

  it("finds no project outside every project", () => {
    assert.equal(projectForUri(keys, "file:///other/a.swift"), undefined);
    assert.equal(projectForUri(["file:///repos/App"], "file:///repos/Apple/a.swift"), undefined);
  });
});
