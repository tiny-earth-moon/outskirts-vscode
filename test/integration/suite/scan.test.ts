import * as assert from "node:assert/strict";
import * as path from "node:path";
import * as vscode from "vscode";
import type { ResultGroup } from "../../../src/treeModel";
import { activateWithFake, root } from "./activate";

describe("outskirts.scan", () => {
  it("shows the results of the executable as diagnostics", async () => {
    const { tree } = await activateWithFake();
    await vscode.commands.executeCommand("outskirts.scan");
    const file = vscode.Uri.file(path.join(root, "test/integration/fixture-workspace/Sources/Demo/main.swift"));
    const diagnostics = vscode.languages.getDiagnostics(file);
    assert.equal(diagnostics.length, 1);
    const [diagnostic] = diagnostics;
    assert.equal(diagnostic.message, "Unused function 'unusedHelper()'");
    assert.equal(diagnostic.source, "outskirts");
    assert.equal(diagnostic.code, "unused");
    assert.equal(diagnostic.severity, vscode.DiagnosticSeverity.Warning);
    assert.deepEqual([diagnostic.range.start.line, diagnostic.range.start.character], [2, 5]);

    const [group, ...others] = tree.getChildren() as ResultGroup[];
    assert.equal(others.length, 0);
    assert.equal(group.label, "main.swift");
    assert.equal(tree.getTreeItem(group).description, "Sources/Demo · 1");
    const [leaf] = tree.getChildren(group);
    const item = tree.getTreeItem(leaf);
    assert.equal(item.label, "unusedHelper()");
    assert.equal(item.description, "unused function · line 3");
    assert.equal(item.command?.command, "vscode.open");

    await vscode.commands.executeCommand("outskirts.clear");
    assert.equal(vscode.languages.getDiagnostics(file).length, 0);
  });
});
