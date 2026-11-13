import * as assert from "node:assert/strict";
import { ExecutableNotFoundError, resolveOnPath, SearchEnvironment } from "../../src/commandPath";

function environment(platform: NodeJS.Platform, pathVariable: string, files: string[], extensions = [""]): SearchEnvironment {
  return { platform, pathVariable, extensions, exists: (file) => files.includes(file) };
}

describe("resolveOnPath", () => {
  it("on Windows, never takes an outskirts planted in the project folder or a relative PATH entry", () => {
    const search = environment("win32", ".;src;C:\\Tools", ["outskirts.EXE", "src\\outskirts.EXE", "C:\\Tools\\outskirts.EXE"], ["", ".EXE"]);
    assert.equal(resolveOnPath("outskirts", search), "C:\\Tools\\outskirts.EXE");
  });

  it("on Windows, fails rather than fall back to the project folder", () => {
    const search = environment("win32", "C:\\Tools;", ["outskirts.EXE"], ["", ".EXE"]);
    assert.throws(() => resolveOnPath("outskirts", search), ExecutableNotFoundError);
  });

  it("on macOS and Linux, resolves the name to an absolute path and skips relative entries", () => {
    const search = environment("darwin", "::bin:/usr/local/bin:/opt/bin", ["bin/outskirts", "/opt/bin/outskirts"]);
    assert.equal(resolveOnPath("outskirts", search), "/opt/bin/outskirts");
  });

  it("keeps an absolute path and rejects a relative one", () => {
    const search = environment("linux", "/usr/bin", []);
    assert.equal(resolveOnPath("/opt/outskirts", search), "/opt/outskirts");
    assert.throws(() => resolveOnPath("./outskirts", search), ExecutableNotFoundError);
  });
});
