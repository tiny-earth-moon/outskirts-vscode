import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";

const root = path.join(__dirname, "../../..");
const workflow = readFileSync(path.join(root, ".github/workflows/publish.yml"), "utf8");
const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8")) as { packages: Record<string, { version?: string }> };

function jobs(text: string): Map<string, string> {
  const result = new Map<string, string>();
  const body = text.slice(text.indexOf("\njobs:\n"));
  const parts = body.split(/^ {2}([\w-]+):\n/m).slice(1);
  for (let index = 0; index + 1 < parts.length; index += 2) {
    result.set(parts[index], parts[index + 1]);
  }
  return result;
}

describe("publish workflow", () => {
  const all = jobs(workflow);
  const publishing = [...all].filter(([, body]) => /id-token:\s*write/.test(body));

  it("has the publishing jobs, and only they hold the OIDC token", () => {
    assert.deepEqual(publishing.map(([name]) => name).sort(), ["marketplace", "open-vsx"]);
  });

  it("installs no dependency of the project where the OIDC token is", () => {
    for (const [name, body] of publishing) {
      assert.doesNotMatch(body, /npm (ci|install|i)\b|actions\/checkout|cache: npm/, name);
    }
  });

  it("runs only the publishing tools, at their exact version of package-lock.json", () => {
    for (const [name, body] of publishing) {
      const calls = [...body.matchAll(/\bnpx\b(.*)/g)].map((match) => match[1].trim());
      assert.ok(calls.length > 0, name);
      for (const call of calls) {
        const match = /^--yes ((?:@[\w-]+\/)?[\w-]+)@(\d+\.\d+\.\d+) /.exec(call);
        assert.ok(match !== null, `${name}: ${call}`);
        assert.ok(["@vscode/vsce", "ovsx"].includes(match[1]), `${name}: ${call}`);
        assert.equal(match[2], lock.packages[`node_modules/${match[1]}`].version, `${name}: ${call}`);
      }
    }
  });
});
