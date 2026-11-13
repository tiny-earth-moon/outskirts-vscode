import * as vscode from "vscode";
import { setAgentVerify } from "./agentVerify";
import { AgentRegistry } from "./agentRegistry";
import { CurrentFolder } from "./currentFolder";
import { editArguments, editSeverity, setSkipBuild } from "./editOptions";
import { OptionRow, optionsDescription } from "./optionsModel";
import { executableName, OptionsTreeProvider } from "./optionsTree";
import { pickOneProject } from "./pickFolder";
import { isNested, Project } from "./project";
import { ProjectList } from "./projectList";
import { Scanner } from "./scanCommand";
import { GroupBy } from "./treeModel";
import { probeVersion } from "./versionProbe";

export interface OptionsView extends vscode.Disposable {
  readonly tree: OptionsTreeProvider;
  readonly probed: () => Promise<void>;
  readonly setChecked: (row: OptionRow, checked: boolean) => Promise<void>;
  readonly select: (key: string) => void;
  readonly refresh: () => void;
}

export function createOptionsView(
  projects: ProjectList,
  scanner: Scanner,
  groupBy: { get: () => GroupBy; set: (mode: GroupBy) => void },
  agents: AgentRegistry,
): OptionsView {
  const current = new CurrentFolder();
  const project = (): Project | undefined => {
    const key = current.current;
    return key === undefined ? undefined : projects.find(key);
  };
  const tree = new OptionsTreeProvider(() => project()?.workspaceFolder, groupBy.get, () => agents.status());
  const view = vscode.window.createTreeView("outskirts.options", { treeDataProvider: tree });
  const refresh = (): void => {
    const shown = project();
    view.description = optionsDescription(
      shown === undefined ? undefined : { name: shown.name, folderName: shown.workspaceFolder.name, nested: isNested(shown) },
      current.several,
    );
    void vscode.commands.executeCommand("setContext", "outskirts.severalProjects", current.several);
    tree.refresh();
  };
  const select = (key: string): void => {
    if (current.select(key)) {
      refresh();
    }
  };
  let probe = Promise.resolve();
  let generation = 0;
  const reprobe = (): void => {
    const probing = ++generation;
    tree.version = { state: "checking" };
    tree.refresh();
    probe = probeVersion(executableName()).then((version) => {
      if (probing !== generation) {
        return;
      }
      tree.version = version;
      tree.refresh();
    });
  };
  const withProject = (action: (target: Project) => Promise<void>) => async (): Promise<void> => {
    const target = project();
    if (target !== undefined) {
      await action(target);
    }
  };
  const setChecked = async (row: OptionRow, checked: boolean): Promise<void> => {
    const target = project();
    if (row.id === "skipBuild" && target !== undefined) {
      await setSkipBuild(target.workspaceFolder, checked);
    } else if (row.id === "agentVerify") {
      await setAgentVerify(checked);
    }
  };
  current.setFolders(projects.projects.map((entry) => entry.key));
  reprobe();
  refresh();
  const subscriptions = [
    tree,
    view,
    projects.onDidChange(() => {
      current.setFolders(projects.projects.map((entry) => entry.key));
      refresh();
    }),
    scanner.onDidChangeRunning(() => {
      if (scanner.scanning !== undefined) {
        select(scanner.scanning);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("outskirts.path")) {
        reprobe();
      } else if (event.affectsConfiguration("outskirts")) {
        tree.refresh();
      }
    }),
    agents.onDidChange(() => {
      tree.refresh();
    }),
    view.onDidChangeCheckboxState(async (event) => {
      for (const [row, state] of event.items) {
        await setChecked(row, state === vscode.TreeItemCheckboxState.Checked);
      }
    }),
    vscode.commands.registerCommand("outskirts.editSeverity", withProject((target) => editSeverity(target.workspaceFolder))),
    vscode.commands.registerCommand("outskirts.editArguments", withProject((target) => editArguments(target.workspaceFolder))),
    vscode.commands.registerCommand("outskirts.toggleGroupBy", () => {
      groupBy.set(groupBy.get() === "kind" ? "file" : "kind");
    }),
    vscode.commands.registerCommand("outskirts.scanCurrentFolder", withProject((target) => scanner.scan([target]))),
    vscode.commands.registerCommand("outskirts.selectFolder", async () => {
      const picked = await pickOneProject(projects.projects);
      if (picked !== undefined) {
        select(picked.key);
      }
    }),
    vscode.commands.registerCommand("outskirts.scanOptions", async () => {
      if (current.several) {
        const picked = await pickOneProject(projects.projects);
        if (picked === undefined) {
          return;
        }
        select(picked.key);
      }
      await vscode.commands.executeCommand("outskirts.options.focus");
    }),
  ];
  return {
    tree,
    probed: () => probe,
    setChecked,
    select,
    refresh,
    dispose: () => {
      subscriptions.forEach((subscription) => {
        subscription.dispose();
      });
    },
  };
}
