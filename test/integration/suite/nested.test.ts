import * as assert from "node:assert/strict";
import * as path from "node:path";
import * as vscode from "vscode";
import type { FolderNode } from "../../../src/folderModel";
import type { ResultGroup } from "../../../src/treeModel";
import { activateWithFake, root } from "./activate";

const parent = path.join(root, "test/integration/fixture-parent");

function mainFile(project: string): vscode.Uri {
  return vscode.Uri.file(path.join(parent, project, "Sources/Demo/main.swift"));
}

describe("outskirts in a folder of projects", () => {
  it("finds the projects one level below and keeps their results apart", async () => {
    const { tree } = await activateWithFake();
    const [folder] = vscode.workspace.workspaceFolders ?? [];
    await vscode.commands.executeCommand("outskirts.scanFolder", vscode.Uri.joinPath(folder.uri, "App"));
    assert.equal(vscode.languages.getDiagnostics(mainFile("App")).length, 1);
    assert.equal(vscode.languages.getDiagnostics(mainFile("Library")).length, 0);

    const nodes = tree.getChildren() as FolderNode[];
    assert.deepEqual(nodes.map((node) => node.name), ["App", "Library"]);
    assert.deepEqual(nodes.map((node) => node.root), [path.join(parent, "App"), path.join(parent, "Library")]);
    assert.equal(tree.getTreeItem(nodes[0]).description, "1 result · just now");
    assert.equal(tree.getTreeItem(nodes[1]).description, "not scanned");
    const [group] = tree.getChildren(nodes[0]) as ResultGroup[];
    assert.equal(tree.getTreeItem(group).description, "Sources/Demo · 1");

    await vscode.commands.executeCommand("outskirts.clear");
    assert.equal(vscode.languages.getDiagnostics(mainFile("App")).length, 0);
  });
});
