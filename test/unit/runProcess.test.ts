import * as assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExecutableNotFoundError, runProcess, WorkingDirectoryNotFoundError } from "../../src/runProcess";

function run(executable: string, args: string[], cwd: string, output: string[] = []) {
  return runProcess(executable, args, { cwd, signal: new AbortController().signal, onOutput: (text) => output.push(text) });
}

describe("runProcess", () => {
  it("reports a missing working folder, not a missing executable", async () => {
    const cwd = join(tmpdir(), "outskirts-missing-folder-for-test");
    await assert.rejects(run(process.execPath, ["-e", ""], cwd), (error: unknown) => {
      assert.ok(error instanceof WorkingDirectoryNotFoundError);
      assert.match(error.message, /outskirts-missing-folder-for-test/);
      return true;
    });
  });

  it("reports a missing executable in an existing folder", async () => {
    await assert.rejects(run("outskirts-no-such-executable", [], tmpdir()), ExecutableNotFoundError);
  });

  it("sends stderr and a summary to the output, not the results on stdout", async () => {
    const output: string[] = [];
    const script = "process.stderr.write('building\\n'); process.stdout.write('[{\"secret\":1}]')";
    const result = await run(process.execPath, ["-e", script], tmpdir(), output);
    assert.equal(result.stdout, "[{\"secret\":1}]");
    const text = output.join("");
    assert.match(text, /building/);
    assert.match(text, /14 bytes of results/);
    assert.doesNotMatch(text, /secret/);
  });
});
