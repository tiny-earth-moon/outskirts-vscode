import * as assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { isRelativeLocation, parseLocation, relativeResultsBase, shownPath } from "../../src/location";
import { checkRelativeLocations, UnresolvedPathError } from "../../src/relativeResults";
import { folderAliases } from "../../src/realFolders";

describe("result paths of a project reached through a symbolic link", () => {
  const aliases = [
    { real: "/private/tmp/work", shown: "/tmp/work" },
    { real: "/real/pkg", shown: "/ws/link/pkg" },
  ];

  it("shows the real paths printed by outskirts under the path the project is opened at", () => {
    assert.equal(parseLocation("/real/pkg/Sources/App/main.swift:3:19", "/ws/link/pkg", aliases).file, "/ws/link/pkg/Sources/App/main.swift");
    assert.equal(shownPath("/private/tmp/work/A.swift", aliases), "/tmp/work/A.swift");
    assert.equal(shownPath("/real/pkg", aliases), "/ws/link/pkg");
  });

  it("leaves other paths and look-alike prefixes alone", () => {
    assert.equal(shownPath("/real/pkg2/A.swift", aliases), "/real/pkg2/A.swift");
    assert.equal(shownPath("/elsewhere/A.swift", aliases), "/elsewhere/A.swift");
  });

  it("finds the real folder behind a link, and none for a real folder", async () => {
    const root = realpathSync(mkdtempSync(path.join(tmpdir(), "outskirts-link-")));
    try {
      mkdirSync(path.join(root, "real"));
      symlinkSync(path.join(root, "real"), path.join(root, "link"));
      assert.deepEqual(await folderAliases([path.join(root, "link"), path.join(root, "real")]), [
        { real: path.join(root, "real"), shown: path.join(root, "link") },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("relative result paths", () => {
  it("are relative to --relative-to, itself relative to --project-root, itself relative to the project folder", () => {
    assert.equal(relativeResultsBase("/ws/pkg", []), "/ws/pkg");
    assert.equal(relativeResultsBase("/ws/pkg", ["--relative-to", "Sources"]), "/ws/pkg/Sources");
    assert.equal(relativeResultsBase("/ws/pkg", ["--relative-to=/repo"]), "/repo");
    assert.equal(relativeResultsBase("/ws", ["--project-root", "pkg", "--relative-results"]), "/ws/pkg");
    assert.equal(relativeResultsBase("/ws", ["--project-root", "a", "--project-root=b", "--relative-to", "Sources"]), "/ws/b/Sources");
    assert.equal(relativeResultsBase("/ws/pkg", ["--", "--relative-to", "x"]), "/ws/pkg");
    assert.equal(parseLocation("App/main.swift:3:19", relativeResultsBase("/ws/pkg", ["--relative-to", "Sources"])).file, "/ws/pkg/Sources/App/main.swift");
  });

  it("are told apart from absolute ones", () => {
    assert.equal(isRelativeLocation("Sources/A.swift:1:1"), true);
    assert.equal(isRelativeLocation("/w/Sources/A.swift:1:1"), false);
  });

  it("are refused with a clear error when they are not under the base", async () => {
    const root = realpathSync(mkdtempSync(path.join(tmpdir(), "outskirts-relative-")));
    try {
      mkdirSync(path.join(root, "Sources"));
      writeFileSync(path.join(root, "Sources", "A.swift"), "");
      const result = (location: string) => ({ kind: "class", name: "A", hints: ["unused"], location });
      await checkRelativeLocations([result("Sources/A.swift:1:7"), result(path.join(root, "Gone.swift:1:1"))], root);
      await assert.rejects(checkRelativeLocations([result("A.swift:1:7")], root), UnresolvedPathError);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
