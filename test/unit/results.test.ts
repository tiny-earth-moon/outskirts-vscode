import * as assert from "node:assert/strict";
import { InvalidOutputError, parseResults } from "../../src/results";

describe("parseResults", () => {
  it("returns no result for the empty output of --quiet", () => {
    assert.deepEqual(parseResults(""), []);
  });

  it("rejects invalid JSON", () => {
    assert.throws(() => parseResults("[{"), InvalidOutputError);
  });

  it("rejects a result without hints", () => {
    assert.throws(() => parseResults('[{"kind":"class","name":"A","location":"a:1:1"}]'), InvalidOutputError);
  });
});
