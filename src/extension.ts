import * as vscode from "vscode";
import { bindDiagnostics } from "./diagnostics";
import { FolderNode, viewState } from "./folderModel";
import { isFolderNode } from "./folderTree";
import { OptionsView, createOptionsView } from "./optionsView";
import { activeFolder, pickScanTargets } from "./pickFolder";
import { ResultsStore } from "./resultsStore";
import { ResultsTreeProvider } from "./resultsTree";
import { ScannableFolders } from "./scannableFolders";
import { Scanner } from "./scanCommand";
import { createStatusBar } from "./statusBar";
import { GroupBy } from "./treeModel";

export interface OutskirtsApi {
  readonly tree: ResultsTreeProvider;
  readonly ready: Promise<void>;
  readonly options: OptionsView;
}

type FolderTarget = FolderNode | vscode.Uri;

export function activate(context: vscode.ExtensionContext): OutskirtsApi {
  const collection = vscode.languages.createDiagnosticCollection("outskirts");
  const output = vscode.window.createOutputChannel("outskirts");
  const store = new ResultsStore();
  const scannable = new ScannableFolders();
  const scanner = new Scanner(store, output);
  const tree = new ResultsTreeProvider(store, () => scannable.infos, () => scanner.scanning);
  const statusBar = createStatusBar(store, scanner, () => scannable.infos);
  const setContext = (key: string, value: unknown): void => {
    void vscode.commands.executeCommand("setContext", `outskirts.${key}`, value);
  };
  const groupBy = (mode: GroupBy): void => {
    tree.groupBy = mode;
    setContext("groupBy", mode);
    options.refresh();
  };
  const options = createOptionsView(scannable, scanner, { get: () => tree.groupBy, set: groupBy });
  const resultsView = vscode.window.createTreeView("outskirts.results", { treeDataProvider: tree, showCollapseAll: true });
  const updateState = (): void => {
    setContext("state", viewState(scannable.infos, store.all()));
    tree.refresh();
  };
  const target = (node: FolderTarget | undefined): vscode.WorkspaceFolder | undefined => {
    if (node === undefined) {
      return undefined;
    }
    return scannable.find(node instanceof vscode.Uri ? node.toString() : node.key);
  };
  const scanPicked = async (preselect: boolean): Promise<void> => {
    if (scanner.running) {
      void vscode.window.showWarningMessage("A scan is already running.");
      return;
    }
    const folders = scannable.folders;
    const picked = await pickScanTargets(folders, preselect ? activeFolder(folders) : undefined);
    if (picked !== undefined) {
      await scanner.scan(picked);
    }
  };
  setContext("groupBy", tree.groupBy);
  const ready = scannable.refresh();
  context.subscriptions.push(
    collection,
    output,
    scanner,
    tree,
    scannable,
    statusBar,
    bindDiagnostics(collection, store),
    store.onDidChange(updateState),
    scannable.onDidChange(() => {
      store.retain(scannable.infos.map((folder) => folder.key));
      updateState();
      statusBar.update();
    }),
    scanner.onDidChangeRunning((running) => {
      setContext("scanning", running);
      tree.refresh();
    }),
    options,
    resultsView,
    resultsView.onDidChangeSelection((event) => {
      const node = event.selection.at(0);
      if (node !== undefined && isFolderNode(node)) {
        options.select(node.key);
      }
    }),
    vscode.commands.registerCommand("outskirts.scan", () => scanPicked(true)),
    vscode.commands.registerCommand("outskirts.scanView", () => scanPicked(false)),
    vscode.commands.registerCommand("outskirts.scanFolder", async (node?: FolderTarget) => {
      const folder = target(node);
      if (folder !== undefined) {
        await scanner.scan([folder]);
      }
    }),
    vscode.commands.registerCommand("outskirts.cancel", () => {
      scanner.cancel();
    }),
    vscode.commands.registerCommand("outskirts.clear", () => {
      store.clearAll();
    }),
    vscode.commands.registerCommand("outskirts.clearFolder", (node?: FolderTarget) => {
      const folder = target(node);
      if (folder !== undefined) {
        store.clear(folder.uri.toString());
      }
    }),
    vscode.commands.registerCommand("outskirts.groupByFile", () => {
      groupBy("file");
    }),
    vscode.commands.registerCommand("outskirts.groupByKind", () => {
      groupBy("kind");
    }),
    vscode.commands.registerCommand("outskirts.openSettings", () =>
      vscode.commands.executeCommand("workbench.action.openSettings", "@ext:tiny-earth-moon.outskirts"),
    ),
  );
  return { tree, ready, options };
}

export function deactivate(): void {}
