import * as assert from "node:assert/strict";
import { ignoreDeclaration, ignoreFile, ignoreParameter, splitLines, unusedParameterName } from "../../src/ignoreEdit";

describe("ignore comment edits", () => {
  it("inserts the ignore comment above the declaration with its indentation", () => {
    const lines = ["struct A {", "    func unused() {}", "}"];
    assert.deepEqual(ignoreDeclaration(lines, 1, "\n"), { line: 1, replace: false, text: "    // outskirts:ignore\n" });
  });

  it("inserts above the attributes and below the doc comment", () => {
    const lines = ["  /// Docs", "  @MainActor", "  @objc", "  func f() {}"];
    assert.deepEqual(ignoreDeclaration(lines, 3, "\n"), { line: 1, replace: false, text: "  // outskirts:ignore\n" });
  });

  it("keeps the CRLF line endings", () => {
    const { lines, eol } = splitLines("import A\r\nclass B {}\r\n");
    assert.equal(ignoreDeclaration(lines, 1, eol)?.text, "// outskirts:ignore\r\n");
  });

  it("does not duplicate an existing ignore comment, with either prefix", () => {
    assert.equal(ignoreDeclaration(["// outskirts:ignore - kept", "class A {}"], 1, "\n"), undefined);
    assert.equal(ignoreDeclaration(["// periphery:ignore", "@objc", "class A {}"], 2, "\n"), undefined);
  });

  it("ignores a parameter on its function", () => {
    const lines = ["    @discardableResult", "    func f(", "        a: Int", "    ) {}"];
    assert.deepEqual(ignoreParameter(lines, 2, "a", "\n"), { line: 0, replace: false, text: "    // outskirts:ignore:parameters a\n" });
  });

  it("appends a parameter to an existing list, keeping its trailing comment", () => {
    const lines = ["// outskirts:ignore:parameters a, b - reason", "func f(a: Int, b: Int, c: Int) {}"];
    assert.deepEqual(ignoreParameter(lines, 1, "c", "\n"), { line: 0, replace: true, text: "// outskirts:ignore:parameters a,b,c - reason" });
    assert.equal(ignoreParameter(lines, 1, "a", "\n"), undefined);
  });

  it("inserts ignore:all after the header comment and before the imports", () => {
    const lines = ["//", "// File.swift", "//", "", "import Foundation"];
    assert.deepEqual(ignoreFile(lines, "\n"), { line: 3, replace: false, text: "// outskirts:ignore:all\n" });
    assert.equal(ignoreFile(["/* License", " * text", " */", "import A"], "\n")?.line, 3);
    assert.equal(ignoreFile(["import A"], "\n")?.line, 0);
    assert.equal(ignoreFile(["// outskirts:ignore:all", "import A"], "\n"), undefined);
  });

  it("reads the parameter name of an unused parameter message", () => {
    assert.equal(unusedParameterName("Unused parameter 'value'"), "value");
    assert.equal(unusedParameterName("Unused function 'f()'"), undefined);
  });
});
