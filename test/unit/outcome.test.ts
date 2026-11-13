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

  it("shows the error of outskirts as is with the setting that fixes it when an Xcode project has no schemes", () => {
    assert.throws(
      () => interpretRun({ exitCode: 1, stdout: "", stderr: "Error: The '--schemes' option is required.\n" }),
      (error: unknown) =>
        error instanceof ScanFailedError &&
        error.message.includes("Error: The '--schemes' option is required.") &&
        error.message.includes('"--schemes <scheme>" in Extra arguments, or "schemes:" in .outskirts.yml'),
    );
  });

  it("tells how to name the Xcode project when outskirts cannot identify it", () => {
    const stderr = "Error: Failed to identify project in the current directory. For Xcode projects use the '--project' option.\n";
    assert.throws(
      () => interpretRun({ exitCode: 1, stdout: "", stderr }),
      (error: unknown) => error instanceof ScanFailedError && error.message.includes('"--project <name>" in Extra arguments'),
    );
  });

  it("reports invalid JSON on success explicitly", () => {
    assert.throws(() => interpretRun({ exitCode: 0, stdout: "nope", stderr: "" }), InvalidOutputError);
  });
});
