import { createOptionalView } from "./optionalView";
import * as vscode from "vscode";
import { AgentRegistry } from "./agentRegistry";
import { registerConfigEditor } from "./configEditor";
import { bindDiagnostics, followSeverity } from "./diagnostics";
import { FolderNode, viewState } from "./folderModel";
import { registerFixWithAgent } from "./fixWithAgent";
import { isFolderNode } from "./folderTree";
import { registerIgnoreActions } from "./ignoreActions";
import { OptionsView, createOptionsView } from "./optionsView";
import { pickScanTargets } from "./pickFolder";
import { Project } from "./project";
import { ProjectList } from "./projectList";
import { ProjectRow } from "./projectsModel";
import { ProjectsTreeProvider } from "./projectsTree";
import { ResultsStore } from "./resultsStore";
import { ResultsTreeProvider } from "./resultsTree";
import { Scanner } from "./scanCommand";
import { watchStaleFiles } from "./staleWatcher";
import { createStatusBar } from "./statusBar";
import { GroupBy } from "./treeModel";

export interface OutskirtsApi {
  readonly tree: ResultsTreeProvider;
  readonly ready: Promise<void>;
  readonly options: OptionsView;
  readonly testing?: TestingApi;
}

export interface TestingApi {
  readonly setAgentSearchPath: (directories: readonly string[] | undefined) => void;
}

type FolderTarget = FolderNode | vscode.Uri;

export function activate(context: vscode.ExtensionContext): OutskirtsApi {
  const collection = vscode.languages.createDiagnosticCollection("outskirts");
  const output = vscode.window.createOutputChannel("outskirts");
  const store = new ResultsStore();
  const projects = new ProjectList();
  const agents = new AgentRegistry();
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
  const options = createOptionsView(projects, scanner, { get: () => tree.groupBy, set: groupBy }, agents);
  const resultsView = vscode.window.createTreeView("outskirts.results", { treeDataProvider: tree, showCollapseAll: true });
  const updateState = (): void => {
    setContext("state", viewState(projects.infos, store.all()));
    setContext("hasResults", store.total > 0);
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
  const projectsTree = new ProjectsTreeProvider(store, () => projects.projects, () => scanner.scanning, () => scanner.failed);
  const projectsView = createOptionalView(
    () => vscode.window.createTreeView("outskirts.projects", { treeDataProvider: projectsTree }),
    (error) => {
      output.appendLine(`Projects view unavailable: ${error instanceof Error ? error.message : String(error)}`);
      void vscode.window
        .showWarningMessage("outskirts was updated: reload the window to show its Projects view.", "Reload Window")
        .then((choice) => (choice === undefined ? undefined : vscode.commands.executeCommand("workbench.action.reloadWindow")));
    },
  );
  const rowProject = (row: ProjectRow | undefined): Project | undefined => (row === undefined ? undefined : projects.find(row.key));
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
    followSeverity(store, () => projects.projects),
    watchStaleFiles(store, (key) => projects.find(key)?.uri.fsPath),
    store.onDidChange(updateState),
    projects.onDidChange(() => {
      store.retain(projects.infos.map((folder) => folder.key));
      scanner.cancelRemoved((key) => projects.find(key) !== undefined);
      updateState();
      statusBar.update();
    }),
    scanner.onDidChangeRunning((running) => {
      setContext("scanning", running);
      tree.refresh();
    }),
    options,
    agents,
    ...registerFixWithAgent(store, projects, agents),
    ...registerIgnoreActions(store),
    registerConfigEditor(context.extensionUri, projects, context.workspaceState),
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
    projectsTree,
    ...(projectsView === undefined ? [] : [projectsView]),
    store.onDidChange(() => { projectsTree.refresh(); }),
    projects.onDidChange(() => { projectsTree.refresh(); }),
    scanner.onDidChangeRunning(() => { projectsTree.refresh(); }),
    vscode.commands.registerCommand("outskirts.scanProject", async (row?: ProjectRow) => {
      const project = rowProject(row);
      if (project !== undefined) {
        await scanner.scan([project]);
      }
    }),
    vscode.commands.registerCommand("outskirts.scanAll", () => scanner.scan(projects.projects)),
    vscode.commands.registerCommand("outskirts.clearProject", (row?: ProjectRow) => {
      const project = rowProject(row);
      if (project !== undefined) {
        scanner.forget(project.key);
        store.clear(project.key);
        projectsTree.refresh();
      }
    }),
    vscode.commands.registerCommand("outskirts.openConfiguration", async (row?: ProjectRow) => {
      const project = rowProject(row);
      if (project !== undefined) {
        await vscode.commands.executeCommand("outskirts.editConfiguration", project);
      }
    }),
    vscode.commands.registerCommand("outskirts.revealProject", async (row?: ProjectRow) => {
      if (row === undefined) {
        return;
      }
      options.select(row.key);
      const node = tree.getChildren().find((child) => isFolderNode(child) && child.key === row.key);
      if (node === undefined) {
        await vscode.commands.executeCommand("outskirts.results.focus");
        return;
      }
      await resultsView.reveal(node, { select: true, focus: true, expand: true });
    }),
    vscode.commands.registerCommand("outskirts.openSettings", () =>
      vscode.commands.executeCommand("workbench.action.openSettings", "@ext:tiny-earth-moon.outskirts"),
    ),
  );
  const testing: TestingApi | undefined =
    context.extensionMode === vscode.ExtensionMode.Test
      ? { setAgentSearchPath: (directories) => { agents.setSearchPath(directories); } }
      : undefined;
  return { tree, ready, options, testing };
}

export function deactivate(): void {}
