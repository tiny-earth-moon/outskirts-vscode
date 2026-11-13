import * as assert from "node:assert/strict";
import { Finding } from "../../src/findings";
import { ResultsStore } from "../../src/resultsStore";
import { freshFindings, isStaleFinding, projectsByFile, watchRoots } from "../../src/staleModel";

function finding(file: string, line: number): Finding {
  return { file, line, column: 0, kind: "function", name: "f()", code: "unused", message: "Unused" };
}

const a = finding("/app/A.swift", 1);
const b = finding("/app/B.swift", 2);

function store(): ResultsStore {
  const results = new ResultsStore();
  results.set("app", [a, b], "warning", 1);
  results.set("other", [finding("/app/A.swift", 1)], "warning", 1);
  return results;
}

describe("stale results", () => {
  it("marks a file of one project only, once", () => {
    const results = store();
    let changes = 0;
    results.onDidChange(() => changes++);
    assert.equal(results.markStale("app", "/app/A.swift"), true);
    assert.equal(results.markStale("app", "/app/A.swift"), false);
    assert.deepEqual([...(results.get("app")?.stale ?? [])], ["/app/A.swift"]);
    assert.equal(results.get("other")?.stale.size, 0);
    assert.equal(changes, 1);
  });

  it("ignores files without results and unknown projects", () => {
    const results = store();
    assert.equal(results.markStale("app", "/app/C.swift"), false);
    assert.equal(results.markStale("none", "/app/A.swift"), false);
  });

  it("is cleared by a new scan or a clear of the project", () => {
    const results = store();
    results.markStale("app", "/app/A.swift");
    results.set("app", [a, b], "warning", 2);
    assert.equal(results.get("app")?.stale.size, 0);
    results.markStale("app", "/app/A.swift");
    results.clear("app");
    results.set("app", [a], "warning", 3);
    assert.equal(results.get("app")?.stale.size, 0);
  });

  it("keeps the scan's count and leaves stale results out of fresh ones", () => {
    const results = store();
    results.markStale("app", "/app/A.swift");
    assert.equal(results.total, 3);
    assert.deepEqual(freshFindings(results.get("app"), [a, b]), [b]);
    assert.deepEqual(freshFindings(results.get("app"), [a]), []);
    assert.equal(isStaleFinding(results.all(), a), true);
    assert.equal(isStaleFinding(results.all(), b), false);
  });

  it("watches each project once, whatever its number of files, and keeps watching after a change", () => {
    const results = store();
    const roots = { app: "/app", other: "/app" } as Record<string, string | undefined>;
    assert.deepEqual(watchRoots(results.all(), (key) => roots[key]), [{ base: "/app", pattern: "**/*" }]);
    results.markStale("app", "/app/B.swift");
    assert.deepEqual(watchRoots(results.all(), (key) => roots[key]), [{ base: "/app", pattern: "**/*" }]);
  });

  it("watches the folder of a result outside its project, with its name in the base and never in the pattern", () => {
    const results = new ResultsStore();
    results.set("app", [finding("/app/Sources/A.swift", 1), finding("/libs/Foo[1]{a,b}*/Bar[2].swift", 1)], "warning", 1);
    results.set("nested", [finding("/app/Sub/C.swift", 1)], "warning", 1);
    const roots = { app: "/app", nested: "/app/Sub" } as Record<string, string | undefined>;
    assert.deepEqual(watchRoots(results.all(), (key) => roots[key]), [
      { base: "/app", pattern: "**/*" },
      { base: "/libs/Foo[1]{a,b}*", pattern: "*" },
    ]);
    assert.deepEqual(watchRoots(results.all(), () => undefined), [
      { base: "/app/Sources", pattern: "*" },
      { base: "/app/Sub", pattern: "*" },
      { base: "/libs/Foo[1]{a,b}*", pattern: "*" },
    ]);
  });

  it("watches a project while it is scanned, before it has results", () => {
    assert.deepEqual(watchRoots(new ResultsStore().all(), (key) => (key === "app" ? "/app" : undefined), ["app", "gone"]), [{ base: "/app", pattern: "**/*" }]);
  });

  it("indexes the projects of a changed or deleted file", () => {
    const index = projectsByFile(store().all());
    assert.deepEqual(index.get("/app/A.swift"), ["app", "other"]);
    assert.deepEqual(index.get("/app/B.swift"), ["app"]);
    assert.equal(index.get("/app/Gone.swift"), undefined);
  });
});
