import * as assert from "node:assert/strict";
import { createOptionalView } from "../../src/optionalView";

describe("createOptionalView", () => {
  it("returns the view when it can be created", () => {
    const reported: unknown[] = [];
    assert.equal(createOptionalView(() => "view", (error) => reported.push(error)), "view");
    assert.deepEqual(reported, []);
  });

  it("reports the error and returns nothing when the view is not registered", () => {
    const reported: unknown[] = [];
    const missing = new Error("No view is registered with id: outskirts.projects");
    const view = createOptionalView<string>(() => {
      throw missing;
    }, (error) => reported.push(error));
    assert.equal(view, undefined);
    assert.deepEqual(reported, [missing]);
  });
});
