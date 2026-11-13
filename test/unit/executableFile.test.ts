import * as assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { findExecutable } from "../../src/agentDetection";
import { executableExtensions, isExecutableFile } from "../../src/executableFile";

describe("executableExtensions", () => {
  it("is the name alone on macOS and Linux", () => {
    assert.deepEqual(executableExtensions("darwin", ".EXE"), [""]);
    assert.deepEqual(executableExtensions("linux", undefined), [""]);
  });

  it("follows PATHEXT on Windows, never the name without an extension", () => {
    assert.deepEqual(executableExtensions("win32", ".COM;.EXE;.BAT;.CMD;.VBS"), [".COM", ".EXE", ".BAT", ".CMD", ".VBS"]);
    assert.deepEqual(executableExtensions("win32", ";.EXE; ;.CMD;"), [".EXE", ".CMD"]);
    assert.deepEqual(executableExtensions("win32", undefined), [".COM", ".EXE", ".BAT", ".CMD"]);
    assert.deepEqual(executableExtensions("win32", ""), [".COM", ".EXE", ".BAT", ".CMD"]);
  });
});

describe("isExecutableFile", () => {
  let directory: string;

  before(() => {
    directory = mkdtempSync(path.join(os.tmpdir(), "outskirts-executable-"));
    for (const name of ["codex", "codex.cmd", "codex.ps1"]) {
      writeFileSync(path.join(directory, name), "");
      chmodSync(path.join(directory, name), 0o755);
    }
  });

  after(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("on Windows, only accepts a file whose extension is in PATHEXT", () => {
    const extensions = executableExtensions("win32", ".COM;.EXE;.BAT;.CMD");
    assert.equal(isExecutableFile(path.join(directory, "codex"), "win32", extensions), false);
    assert.equal(isExecutableFile(path.join(directory, "codex.ps1"), "win32", extensions), false);
    assert.equal(isExecutableFile(path.join(directory, "codex.cmd"), "win32", extensions), true);
    assert.equal(isExecutableFile(directory, "win32", [""]), false);
  });

  it("on macOS and Linux, accepts an executable file without extension", () => {
    assert.equal(isExecutableFile(path.join(directory, "codex"), "darwin"), true);
  });

  it("on Windows, finds the .cmd of an npm-installed agent rather than its shell script", () => {
    // Lowercase, so that the test also holds on a case-sensitive file system.
    const extensions = executableExtensions("win32", ".com;.exe;.bat;.cmd");
    const exists = (file: string) => isExecutableFile(file, "win32", extensions);
    assert.equal(findExecutable("codex", [directory], exists, extensions), path.join(directory, "codex.cmd"));
    assert.equal(findExecutable("codex.cmd", [directory], exists, extensions), path.join(directory, "codex.cmd"));
    assert.equal(findExecutable(path.join(directory, "codex"), [], exists, extensions), path.join(directory, "codex.cmd"));
    assert.equal(findExecutable("codex", [directory], (file) => isExecutableFile(file, "darwin"), [""]), path.join(directory, "codex"));
  });
});
