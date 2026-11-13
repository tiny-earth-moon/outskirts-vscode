import * as assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { parseLocation, shownPath } from "../../src/location";
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
