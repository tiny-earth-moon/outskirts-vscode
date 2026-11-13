import * as assert from "node:assert/strict";
import { interpretRun, ScanFailedError } from "../../src/outcome";
import { InvalidOutputError } from "../../src/results";

const result = '[{"kind":"class","name":"A","hints":["unused"],"location":"a.swift:1:1"}]';

describe("interpretRun", () => {
  it("reads the results of a successful scan", () => {
    assert.equal(interpretRun({ exitCode: 0, stdout: result, stderr: "" }).length, 1);
  });

  it("reads the results of a --strict scan that exits with 1", () => {
    assert.equal(interpretRun({ exitCode: 1, stdout: result, stderr: "" }).length, 1);
  });

  it("fails with the end of stderr when there is no JSON", () => {
    assert.throws(
      () => interpretRun({ exitCode: 1, stdout: "", stderr: "a\nb\nc\nd\ne\nerror: build failed\n" }),
      (error: unknown) => error instanceof ScanFailedError && error.stderrTail === "b\nc\nd\ne\nerror: build failed",
    );
  });

  it("fails on a usage error", () => {
    assert.throws(() => interpretRun({ exitCode: 64, stdout: "", stderr: "Usage" }), ScanFailedError);
  });

  it("reports invalid JSON on success explicitly", () => {
    assert.throws(() => interpretRun({ exitCode: 0, stdout: "nope", stderr: "" }), InvalidOutputError);
  });
});
