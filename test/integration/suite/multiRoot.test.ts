import * as assert from "node:assert/strict";
import * as path from "node:path";
import * as vscode from "vscode";
import type { FolderNode } from "../../../src/folderModel";
import type { ResultGroup } from "../../../src/treeModel";
import { activateWithFake, root } from "./activate";

function mainFile(folder: string): vscode.Uri {
  return vscode.Uri.file(path.join(root, "test/integration", folder, "Sources/Demo/main.swift"));
}

describe("outskirts in a multi-root workspace", () => {
  it("keeps the results of each folder apart", async () => {
    const { tree } = await activateWithFake();
    const [app, library] = vscode.workspace.workspaceFolders ?? [];
    await vscode.commands.executeCommand("outskirts.scanFolder", app.uri);
    await vscode.commands.executeCommand("outskirts.scanFolder", library.uri);
    assert.equal(vscode.languages.getDiagnostics(mainFile("fixture-workspace")).length, 1);
    assert.equal(vscode.languages.getDiagnostics(mainFile("fixture-library")).length, 1);

    await vscode.commands.executeCommand("outskirts.clearFolder", library.uri);
    assert.equal(vscode.languages.getDiagnostics(mainFile("fixture-workspace")).length, 1);
    assert.equal(vscode.languages.getDiagnostics(mainFile("fixture-library")).length, 0);

    const nodes = tree.getChildren() as FolderNode[];
    assert.deepEqual(nodes.map((node) => node.name), ["App", "Library"]);
    assert.equal(tree.getTreeItem(nodes[0]).description, "1 result · just now");
    assert.equal(tree.getTreeItem(nodes[1]).description, "not scanned");
    const [group] = tree.getChildren(nodes[0]) as ResultGroup[];
    assert.equal(group.label, "main.swift");

    await vscode.commands.executeCommand("outskirts.clear");
    assert.equal(vscode.languages.getDiagnostics(mainFile("fixture-workspace")).length, 0);
  });
});
