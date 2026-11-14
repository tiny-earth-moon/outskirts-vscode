import * as assert from "node:assert/strict";
import { interpretRun } from "../../src/outcome";
import { InvalidOutputError } from "../../src/results";
import { configArgument, redirectSources } from "../../src/resultsRedirect";

const quiet = { exitCode: 0, stdout: "", stderr: "" };

describe("redirectSources", () => {
  it("reads an empty stdout of a successful quiet scan as zero results when nothing redirects them", () => {
    const redirects = redirectSources(["--strict"], "retain_public: true\n");
    assert.deepEqual(redirects, []);
    assert.deepEqual(interpretRun(quiet, redirects), []);
    assert.deepEqual(interpretRun(quiet, redirectSources([], undefined)), []);
  });

  it("keeps the error when Extra arguments send the results elsewhere", () => {
    for (const extra of [["--skip-stdout-results"], ["--write-results", "out.json"], ["--write-results=out.json"]]) {
      const redirects = redirectSources(extra, undefined);
      assert.deepEqual(redirects, ["arguments"]);
      assert.throws(() => interpretRun(quiet, redirects), InvalidOutputError);
    }
    assert.deepEqual(redirectSources(["--skip-stdout-results", "--no-skip-stdout-results"], undefined), []);
  });

  it("keeps the error when the configuration file sends the results elsewhere", () => {
    for (const config of ["skip_stdout_results: true\n", "write_results: out.json\n"]) {
      const redirects = redirectSources([], config);
      assert.deepEqual(redirects, ["configuration"]);
      assert.throws(() => interpretRun(quiet, redirects), InvalidOutputError);
    }
    assert.deepEqual(redirectSources([], "skip_stdout_results: false\nwrite_results:\n"), []);
  });

  it("finds the configuration file named by --config", () => {
    assert.equal(configArgument(["--config", "ci.yml"]), "ci.yml");
    assert.equal(configArgument(["--config=ci.yml"]), "ci.yml");
    assert.equal(configArgument(["--strict"]), undefined);
  });

  it("keeps the error of a failed scan that prints nothing", () => {
    assert.throws(() => interpretRun({ exitCode: 1, stdout: "", stderr: "boom" }, []), (error: unknown) => !(error instanceof InvalidOutputError));
  });
});
