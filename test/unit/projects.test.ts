import * as assert from "node:assert/strict";
import { discoverProjects, FolderListing, isCandidateDirectory, projectForUri, projectWatchPatterns } from "../../src/projects";

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
      folder("App", ["App.xcodeproj"]),
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

  it("lists a project reached from two overlapping workspace folders once, as its own workspace folder", () => {
    const parent: FolderListing = {
      key: "file:///r",
      name: "r",
      entries: ["README.md"],
      children: [{ key: "file:///r/app", name: "app", entries: ["Package.swift"] }],
    };
    const child: FolderListing = { key: "file:///r/app", name: "app", entries: ["Package.swift"], children: [] };
    for (const folders of [[parent, child], [child, parent]]) {
      const projects = discoverProjects(folders);
      assert.deepEqual(projects, [{ key: "file:///r/app", name: "app", folderKey: "file:///r/app", folderName: "app", nested: false }]);
    }
  });

  it("finds nothing in a folder without projects", () => {
    assert.deepEqual(discoverProjects([folder("Notes", ["notes.txt"], [["Drafts", ["a.md"]]])]), []);
  });
});

describe("isCandidateDirectory", () => {
  it("skips the dependency directories, which hold the projects of others", () => {
    for (const name of ["Pods", "Carthage", "vendor", "Vendor", "SourcePackages"]) {
      assert.equal(isCandidateDirectory(name, true, false), false, name);
    }
  });

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

describe("projectWatchPatterns", () => {
  const glob = (pattern: string): RegExp =>
    new RegExp(
      `^${pattern
        .replace(/[.+^$()|[\]\\]/g, "\\$&")
        .replace(/\*/g, "[^/]*")
        .replace(/\{([^}]*)\}/g, (_match, list: string) => `(${list.split(",").join("|")})`)}$`,
    );
  const watched = (path: string): boolean => projectWatchPatterns.some((pattern) => glob(pattern).test(path));

  it("follows the project files of a folder and of its sub-directories, Xcode bundles included", () => {
    for (const name of ["Package.swift", ".outskirts.yml", ".periphery.yml", "App.xcodeproj", "App.xcworkspace"]) {
      assert.equal(watched(name), true, name);
      assert.equal(watched(`App/${name}`), true, `App/${name}`);
    }
  });

  it("follows a sub-directory added or deleted as a whole", () => {
    assert.equal(watched("App"), true);
  });

  it("ignores the files deeper in a project", () => {
    assert.equal(watched("App/Sources/main.swift"), false);
    assert.equal(watched("App/App.xcodeproj/project.pbxproj"), false);
    assert.equal(watched("App/Lib/Package.swift"), false);
  });
});
