import * as vscode from "vscode";
import { bindDiagnostics } from "./diagnostics";
import { ResultsStore } from "./resultsStore";
import { ResultsTreeProvider } from "./resultsTree";
import { Scanner } from "./scanCommand";
import { editScanOptions } from "./scanOptions";
import { createStatusBar } from "./statusBar";
import { GroupBy } from "./treeModel";

export interface OutskirtsApi {
  readonly tree: ResultsTreeProvider;
}

export function activate(context: vscode.ExtensionContext): OutskirtsApi {
  const collection = vscode.languages.createDiagnosticCollection("outskirts");
  const output = vscode.window.createOutputChannel("outskirts");
  const store = new ResultsStore();
  const scanner = new Scanner(store, output);
  const tree = new ResultsTreeProvider(store, () => scanner.folder?.uri.fsPath);
  const setContext = (key: string, value: unknown): void => {
    void vscode.commands.executeCommand("setContext", `outskirts.${key}`, value);
  };
  const groupBy = (mode: GroupBy): void => {
    tree.groupBy = mode;
    setContext("groupBy", mode);
  };
  setContext("state", store.state);
  setContext("groupBy", tree.groupBy);
  context.subscriptions.push(
    collection,
    output,
    scanner,
    tree,
    bindDiagnostics(collection, store),
    store.onDidChange(() => {
      setContext("state", store.state);
    }),
    scanner.onDidChangeRunning((running) => {
      setContext("scanning", running);
    }),
    vscode.window.createTreeView("outskirts.results", { treeDataProvider: tree, showCollapseAll: true }),
    createStatusBar(store, scanner),
    vscode.commands.registerCommand("outskirts.scan", () => scanner.scan()),
    vscode.commands.registerCommand("outskirts.cancel", () => {
      scanner.cancel();
    }),
    vscode.commands.registerCommand("outskirts.clear", () => {
      store.clear();
    }),
    vscode.commands.registerCommand("outskirts.groupByFile", () => {
      groupBy("file");
    }),
    vscode.commands.registerCommand("outskirts.groupByKind", () => {
      groupBy("kind");
    }),
    vscode.commands.registerCommand("outskirts.scanOptions", editScanOptions),
    vscode.commands.registerCommand("outskirts.openSettings", () =>
      vscode.commands.executeCommand("workbench.action.openSettings", "@ext:tiny-earth-moon.outskirts"),
    ),
  );
  return { tree };
}

export function deactivate(): void {}
