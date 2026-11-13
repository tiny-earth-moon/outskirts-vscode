import * as assert from "node:assert/strict";
import { detectAgents, findExecutable, pathDirectories } from "../../src/agentDetection";
import { knownAgents } from "../../src/agents";

function existing(...files: string[]): (file: string) => boolean {
  const set = new Set(files);
  return (file) => set.has(file);
}

describe("pathDirectories", () => {
  it("splits the PATH and drops empty and relative entries", () => {
    assert.deepEqual(pathDirectories("/usr/bin::.:bin:/opt/bin", ":"), ["/usr/bin", "/opt/bin"]);
    assert.deepEqual(pathDirectories(undefined, ":"), []);
  });
});

describe("findExecutable", () => {
  const directories = ["/usr/local/bin", "/opt/bin"];

  it("returns the first directory of the PATH that holds the executable", () => {
    const exists = existing("/opt/bin/claude", "/usr/local/bin/claude");
    assert.equal(findExecutable("claude", directories, exists), "/usr/local/bin/claude");
    assert.equal(findExecutable("claude", ["/opt/bin"], exists), "/opt/bin/claude");
    assert.equal(findExecutable("codex", directories, exists), undefined);
  });

  it("checks an absolute path as it is and refuses relative paths", () => {
    const exists = existing("/home/me/agent", "/usr/local/bin/agent");
    assert.equal(findExecutable("/home/me/agent", directories, exists), "/home/me/agent");
    assert.equal(findExecutable("/home/me/missing", directories, exists), undefined);
    assert.equal(findExecutable("bin/agent", ["/usr/local"], exists), undefined);
    assert.equal(findExecutable("", directories, exists), undefined);
  });

  it("tries each extension, for Windows", () => {
    const exists = existing("/opt/bin/codex.cmd");
    assert.equal(findExecutable("codex", directories, exists, ["", ".exe", ".cmd"]), "/opt/bin/codex.cmd");
  });
});

describe("detectAgents", () => {
  it("maps the id of each installed agent to its executable", () => {
    const detected = detectAgents(knownAgents, ["/usr/bin", "/opt/bin"], existing("/opt/bin/claude", "/usr/bin/cursor-agent"));
    assert.deepEqual([...detected], [
      ["claude", "/opt/bin/claude"],
      ["cursor", "/usr/bin/cursor-agent"],
    ]);
  });
});
