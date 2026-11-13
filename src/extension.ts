import * as vscode from "vscode";
import { bindDiagnostics } from "./diagnostics";
import { FolderNode, viewState } from "./folderModel";
import { isFolderNode } from "./folderTree";
import { OptionsView, createOptionsView } from "./optionsView";
import { pickScanTargets } from "./pickFolder";
import { Project } from "./project";
import { ProjectList } from "./projectList";
import { ResultsStore } from "./resultsStore";
import { ResultsTreeProvider } from "./resultsTree";
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
  const projects = new ProjectList();
  const scanner = new Scanner(store, output);
  const tree = new ResultsTreeProvider(store, () => projects.infos, () => scanner.scanning);
  const statusBar = createStatusBar(store, scanner, () => projects.infos);
  const setContext = (key: string, value: unknown): void => {
    void vscode.commands.executeCommand("setContext", `outskirts.${key}`, value);
  };
  const groupBy = (mode: GroupBy): void => {
    tree.groupBy = mode;
    setContext("groupBy", mode);
    options.refresh();
  };
  const options = createOptionsView(projects, scanner, { get: () => tree.groupBy, set: groupBy });
  const resultsView = vscode.window.createTreeView("outskirts.results", { treeDataProvider: tree, showCollapseAll: true });
  const updateState = (): void => {
    setContext("state", viewState(projects.infos, store.all()));
    tree.refresh();
  };
  const target = (node: FolderTarget | undefined): Project | undefined => {
    if (node === undefined) {
      return undefined;
    }
    return projects.find(node instanceof vscode.Uri ? node.toString() : node.key);
  };
  const scanPicked = async (preselect: boolean): Promise<void> => {
    if (scanner.running) {
      void vscode.window.showWarningMessage("A scan is already running.");
      return;
    }
    const active = vscode.window.activeTextEditor?.document.uri;
    const preselected = preselect && active !== undefined ? projects.containing(active) : undefined;
    const picked = await pickScanTargets(projects.projects, preselected);
    if (picked !== undefined) {
      await scanner.scan(picked);
    }
  };
  setContext("groupBy", tree.groupBy);
  const ready = projects.refresh();
  context.subscriptions.push(
    collection,
    output,
    scanner,
    tree,
    projects,
    statusBar,
    bindDiagnostics(collection, store),
    store.onDidChange(updateState),
    projects.onDidChange(() => {
      store.retain(projects.infos.map((folder) => folder.key));
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
      const project = target(node);
      if (project !== undefined) {
        await scanner.scan([project]);
      }
    }),
    vscode.commands.registerCommand("outskirts.refresh", () => projects.refresh()),
    vscode.commands.registerCommand("outskirts.cancel", () => {
      scanner.cancel();
    }),
    vscode.commands.registerCommand("outskirts.clear", () => {
      store.clearAll();
    }),
    vscode.commands.registerCommand("outskirts.clearFolder", (node?: FolderTarget) => {
      const project = target(node);
      if (project !== undefined) {
        store.clear(project.key);
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
