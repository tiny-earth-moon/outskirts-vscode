import * as assert from "node:assert/strict";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveExecutable } from "../../src/executable";
import { executableDescription } from "../../src/optionsModel";
import { probeVersion } from "../../src/versionProbe";

function script(body: string): string {
  const folder = mkdtempSync(join(tmpdir(), "outskirts-probe-"));
  const file = join(folder, "outskirts");
  writeFileSync(file, `#!${process.execPath}\n${body}\n`, { mode: 0o755 });
  return file;
}

describe("probeVersion", function () {
  if (process.platform === "win32") {
    return;
  }

  it("runs in the given folder", async () => {
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), "outskirts-cwd-")));
    const marker = script(`process.stdout.write(process.cwd() === ${JSON.stringify(cwd)} ? '3.25.0' : 'elsewhere')`);
    assert.deepEqual(await probeVersion(marker, cwd), { state: "found", version: "3.25.0" });
  });

  it("tells a timeout apart from a missing executable", async () => {
    const executable = script("setTimeout(() => {}, 10000)");
    const version = await probeVersion(executable, undefined, 200);
    assert.deepEqual(version, { state: "unanswered" });
    assert.equal(executableDescription("outskirts", version), "outskirts · no answer to version");
  });
});

describe("resolveExecutable home folder", () => {
  it("expands a leading ~", () => {
    assert.equal(resolveExecutable({ globalValue: "~/bin/outskirts" }, "/home/me"), join("/home/me", "bin/outskirts"));
    assert.equal(resolveExecutable({ globalValue: "/opt/~/outskirts" }, "/home/me"), "/opt/~/outskirts");
  });
});
