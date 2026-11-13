import * as assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { probeAgent } from "../../src/agentProbe";

describe("probeAgent", () => {
  let directory: string;

  before(() => {
    directory = mkdtempSync(path.join(os.tmpdir(), "outskirts-probe-"));
  });

  after(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  function script(name: string, body: string): string {
    const file = path.join(directory, name);
    writeFileSync(file, `#!/bin/sh\n${body}\n`);
    chmodSync(file, 0o755);
    return file;
  }

  it("is true when `--version` exits with 0", async () => {
    assert.equal(await probeAgent(process.execPath), true);
  });

  it("passes the prefix before `--version`, as for the script of an npm shim started with node", async () => {
    const versionScript = path.join(directory, "agent.js");
    writeFileSync(versionScript, 'process.exit(process.argv[2] === "--version" ? 0 : 1);\n');
    assert.equal(await probeAgent(process.execPath, 5000, [versionScript]), true);
    assert.equal(await probeAgent(process.execPath, 5000, [versionScript, "extra"]), false);
  });

  it("is false on a non-zero exit, a timeout or a spawn error", async () => {
    assert.equal(await probeAgent(script("shim", "echo 'not found' >&2; exit 127")), false);
    assert.equal(await probeAgent(script("slow", "sleep 5"), 200), false);
    assert.equal(await probeAgent(path.join(directory, "missing")), false);
  });
});
