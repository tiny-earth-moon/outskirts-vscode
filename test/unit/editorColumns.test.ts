import * as assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { toEditorColumns } from "../../src/editorColumns";
import { Finding } from "../../src/findings";
import { utf16Column } from "../../src/location";

describe("columns of the results", () => {
  it("turns the UTF-8 byte offsets of outskirts into the UTF-16 offsets of the editor", () => {
    const line = "/* é😀 */ func unusedA() {}";
    assert.equal(utf16Column(line, 18), line.indexOf("unusedA"));
    assert.equal(utf16Column("func unusedB() {}", 5), 5);
    assert.equal(utf16Column("é", 4), 3);
  });

  it("reads the line of each result, and leaves the column of an unreadable file", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "outskirts-columns-"));
    try {
      const file = path.join(root, "main.swift");
      writeFileSync(file, "func used() {}\r\nused()\r\n/* é😀 */ func unusedA() {}\n");
      const finding = (at: string, line: number, column: number): Finding => ({ file: at, line, column, kind: "function", name: "f", message: "m" });
      const messages: string[] = [];
      const placed = await toEditorColumns([finding(file, 2, 18), finding(file, 0, 0), finding(path.join(root, "Gone.swift"), 0, 7)], (message) => {
        messages.push(message);
      });
      assert.deepEqual(placed.map((item) => item.column), [15, 0, 7]);
      assert.equal(messages.length, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
