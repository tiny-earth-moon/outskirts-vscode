import * as vscode from "vscode";
import { scan } from "./scanCommand";

export function activate(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection("outskirts");
  const output = vscode.window.createOutputChannel("outskirts");
  context.subscriptions.push(
    collection,
    output,
    vscode.commands.registerCommand("outskirts.scan", () => scan(collection, output)),
    vscode.commands.registerCommand("outskirts.clear", () => {
      collection.clear();
    }),
  );
}

export function deactivate(): void {}
