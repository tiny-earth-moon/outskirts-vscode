import * as assert from "node:assert/strict";
import { Finding } from "../../src/findings";
import { ProjectsContext, projectKind, projectRows } from "../../src/projectsModel";
import { FolderResults } from "../../src/resultsStore";

const finding: Finding = { file: "/a/A.swift", line: 0, column: 0, kind: "function", name: "a()", message: "Unused" };

function results(count: number, stale: string[] = []): FolderResults {
  return { findings: Array<Finding>(count).fill(finding), severity: "warning", scannedAt: 0, stale: new Set(stale) };
}

function context(partial: Partial<ProjectsContext>): ProjectsContext {
  return { results: new Map(), scanning: undefined, failed: new Set(), ...partial };
}

const app = { key: "file:///w/App", name: "App", relativePath: "App", kind: "xcode" as const };
const root = { key: "file:///w", name: "w", relativePath: "", kind: "package" as const };

describe("Projects view rows", () => {
  it("tells the kind of a project from its root entries", () => {
    assert.equal(projectKind(["Package.swift", "App.xcodeproj"]), "xcode");
    assert.equal(projectKind(["App.xcworkspace"]), "xcode");
    assert.equal(projectKind(["Package.swift"]), "package");
    assert.equal(projectKind([".outskirts.yml"]), "generic");
  });

  it("orders the rows by path, the workspace root first", () => {
    assert.deepEqual(projectRows([app, root], context({})).map((row) => row.name), ["w", "App"]);
  });

  it("describes each state, with the path before it when the project is nested", () => {
    const rows = (partial: Partial<ProjectsContext>): string[] => projectRows([app], context(partial)).map((row) => row.description);
    assert.deepEqual(rows({}), ["App · not scanned"]);
    assert.deepEqual(rows({ scanning: app.key, results: new Map([[app.key, results(2)]]) }), ["App · scanning…"]);
    assert.deepEqual(rows({ failed: new Set([app.key]) }), ["App · scan failed"]);
    assert.deepEqual(rows({ results: new Map([[app.key, results(0)]]) }), ["App · no unused code"]);
    assert.deepEqual(rows({ results: new Map([[app.key, results(1)]]) }), ["App · 1 result"]);
    assert.deepEqual(rows({ results: new Map([[app.key, results(3, ["/a/A.swift"])]]) }), ["App · 3 results, stale"]);
    assert.deepEqual(projectRows([root], context({})).map((row) => row.description), ["not scanned"]);
  });

  it("gives each state the context value its menus need", () => {
    const value = (partial: Partial<ProjectsContext>): string => projectRows([app], context(partial))[0].contextValue;
    assert.equal(value({}), "project.idle");
    assert.equal(value({ scanning: app.key }), "project.scanning");
    assert.equal(value({ results: new Map([[app.key, results(0)]]) }), "project.idle.results");
    assert.equal(value({ results: new Map([[app.key, results(2, ["/a/A.swift"])]]) }), "project.idle.results");
    assert.equal(value({ failed: new Set([app.key]) }), "project.idle.results");
  });

  it("marks a scanned project whose scan uses a baseline", () => {
    const rows = projectRows([app, root], context({ results: new Map([[app.key, results(3)]]), baselined: new Set([app.key, root.key]) }));
    assert.equal(rows.find((row) => row.key === app.key)?.description, "App · 3 results · baseline");
    assert.equal(rows.find((row) => row.key === root.key)?.description, "not scanned");
  });
});
