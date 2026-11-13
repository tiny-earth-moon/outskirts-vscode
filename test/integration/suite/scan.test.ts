import * as assert from "node:assert/strict";
import * as path from "node:path";
import * as vscode from "vscode";

const root = path.resolve(__dirname, "../../../..");

describe("outskirts.scan", () => {
  it("shows the results of the executable as diagnostics", async () => {
    const config = vscode.workspace.getConfiguration("outskirts");
    await config.update("path", path.join(root, "test/integration/fake-outskirts"), vscode.ConfigurationTarget.Global);
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

    await vscode.commands.executeCommand("outskirts.clear");
    assert.equal(vscode.languages.getDiagnostics(file).length, 0);
  });
});
