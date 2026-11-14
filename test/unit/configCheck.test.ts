import * as assert from "node:assert/strict";
import { parseCheck } from "../../src/configCheck";

describe("parseCheck", () => {
  it("reads a valid file", () => {
    assert.deepEqual(parseCheck(0, ".outskirts.yml: ok\n", ".outskirts.yml"), { state: "valid", messages: [] });
  });

  it("lists the problems without the file name, the level or the count", () => {
    const output = [
      "warning: .outskirts.yml: invalid key 'retain_pubic' (did you mean 'retain_public'?)",
      "\u001b[33mwarning: .outskirts.yml: 'strict' expects a boolean, got the integer 1\u001b[0m",
      "error: .outskirts.yml: 2 problems found",
      "",
    ].join("\n");
    assert.deepEqual(parseCheck(1, output, ".outskirts.yml"), {
      state: "problems",
      messages: ["invalid key 'retain_pubic' (did you mean 'retain_public'?)", "'strict' expects a boolean, got the integer 1"],
    });
    assert.deepEqual(parseCheck(1, "", ".outskirts.yml").messages, ["outskirts config check found a problem but printed nothing."]);
  });

  it("says when the check did not complete", () => {
    const result = parseCheck(64, "Error: Unknown option '--config'", ".outskirts.yml");
    assert.equal(result.state, "unavailable");
    assert.deepEqual(result.messages, ["outskirts config check did not run to completion (status 64).", "Error: Unknown option '--config'"]);
  });
});
