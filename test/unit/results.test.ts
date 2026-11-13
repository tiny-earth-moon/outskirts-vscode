import * as assert from "node:assert/strict";
import { InvalidOutputError, parseResults } from "../../src/results";

describe("parseResults", () => {
  it("returns no result for the [] of a scan that found nothing", () => {
    assert.deepEqual(parseResults("[]\n"), []);
  });

  it("fails on an empty output, which skip_stdout_results gives whatever the results, instead of reading no result", () => {
    assert.throws(() => parseResults(""), (error: unknown) => error instanceof InvalidOutputError && error.message.includes("skip_stdout_results"));
    assert.throws(() => parseResults(" \n"), InvalidOutputError);
  });

  it("rejects invalid JSON", () => {
    assert.throws(() => parseResults("[{"), InvalidOutputError);
  });

  it("rejects a result without hints", () => {
    assert.throws(() => parseResults('[{"kind":"class","name":"A","location":"a:1:1"}]'), InvalidOutputError);
  });
});
