import * as assert from "node:assert/strict";
import { joinArguments, tokenize } from "../../src/tokenize";

describe("tokenize", () => {
  it("splits on whitespace", () => {
    assert.deepEqual(tokenize("  --schemes  App\t--verbose "), ["--schemes", "App", "--verbose"]);
  });

  it("keeps quoted text together and supports escapes", () => {
    assert.deepEqual(tokenize(`--targets "My App" 'a b' x\\ y "q\\"q" ''`), ["--targets", "My App", "a b", "x y", 'q"q', ""]);
  });

  it("keeps shell characters literal", () => {
    assert.deepEqual(tokenize("a;b $(c) | d"), ["a;b", "$(c)", "|", "d"]);
  });

  it("rejects an unclosed quote", () => {
    assert.throws(() => tokenize(`"open`), /Unclosed/);
  });

  it("round-trips through joinArguments", () => {
    const args = ["--schemes", "My App", "it's", "", "a\\b"];
    assert.deepEqual(tokenize(joinArguments(args)), args);
  });
});
