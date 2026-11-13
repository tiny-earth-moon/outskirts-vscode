import * as assert from "node:assert/strict";
import * as path from "node:path";
import * as vscode from "vscode";
import type { ResultGroup } from "../../../src/treeModel";
import { activateWithFake, root } from "./activate";

const fake = path.join(root, "test/integration/fake-outskirts");

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

  it("shows the scan options of the folder and toggles reusing the index", async () => {
    const { options } = await activateWithFake();
    await options.probed();
    const rows = options.tree.getChildren();
    const items = rows.map((row) => options.tree.getTreeItem(row));
    assert.deepEqual(items.map((item) => item.label), ["Reuse existing index", "Severity", "Extra arguments", "Group results", "outskirts"]);
    assert.deepEqual(items.map((item) => item.description), ["--skip-build", "warning", "none", "by file", `${fake} 3.24.0`]);
    assert.equal(items[0].checkboxState, vscode.TreeItemCheckboxState.Unchecked);

    const [folder] = vscode.workspace.workspaceFolders ?? [];
    const config = (): vscode.WorkspaceConfiguration => vscode.workspace.getConfiguration("outskirts", folder.uri);
    const settings = vscode.Uri.joinPath(folder.uri, ".vscode");
    try {
      await options.setChecked(rows[0], true);
      assert.equal(config().get("skipBuild"), true);
      assert.equal(options.tree.getTreeItem(options.tree.getChildren()[0]).checkboxState, vscode.TreeItemCheckboxState.Checked);
    } finally {
      await config().update("skipBuild", undefined, vscode.ConfigurationTarget.WorkspaceFolder);
      await vscode.workspace.fs.delete(settings, { recursive: true });
    }
  });
});
