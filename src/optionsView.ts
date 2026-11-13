import * as vscode from "vscode";
import { CurrentFolder } from "./currentFolder";
import { editArguments, editSeverity, setSkipBuild } from "./editOptions";
import { OptionRow } from "./optionsModel";
import { executableName, OptionsTreeProvider } from "./optionsTree";
import { pickOneFolder } from "./pickFolder";
import { folderKey, ScannableFolders } from "./scannableFolders";
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
  scannable: ScannableFolders,
  scanner: Scanner,
  groupBy: { get: () => GroupBy; set: (mode: GroupBy) => void },
): OptionsView {
  const current = new CurrentFolder();
  const folder = (): vscode.WorkspaceFolder | undefined => {
    const key = current.current;
    return key === undefined ? undefined : scannable.find(key);
  };
  const tree = new OptionsTreeProvider(folder, groupBy.get);
  const view = vscode.window.createTreeView("outskirts.options", { treeDataProvider: tree });
  const refresh = (): void => {
    const shown = folder();
    view.description = current.several ? shown?.name : undefined;
    void vscode.commands.executeCommand("setContext", "outskirts.severalFolders", current.several);
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
  const withFolder = (action: (target: vscode.WorkspaceFolder) => Promise<void>) => async (): Promise<void> => {
    const target = folder();
    if (target !== undefined) {
      await action(target);
    }
  };
  const setChecked = async (row: OptionRow, checked: boolean): Promise<void> => {
    const target = folder();
    if (row.id === "skipBuild" && target !== undefined) {
      await setSkipBuild(target, checked);
    }
  };
  current.setFolders(scannable.folders.map(folderKey));
  reprobe();
  refresh();
  const subscriptions = [
    tree,
    view,
    scannable.onDidChange(() => {
      current.setFolders(scannable.folders.map(folderKey));
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
    view.onDidChangeCheckboxState(async (event) => {
      for (const [row, state] of event.items) {
        await setChecked(row, state === vscode.TreeItemCheckboxState.Checked);
      }
    }),
    vscode.commands.registerCommand("outskirts.editSeverity", withFolder(editSeverity)),
    vscode.commands.registerCommand("outskirts.editArguments", withFolder(editArguments)),
    vscode.commands.registerCommand("outskirts.toggleGroupBy", () => {
      groupBy.set(groupBy.get() === "kind" ? "file" : "kind");
    }),
    vscode.commands.registerCommand("outskirts.scanCurrentFolder", withFolder((target) => scanner.scan([target]))),
    vscode.commands.registerCommand("outskirts.selectFolder", async () => {
      const picked = await pickOneFolder(scannable.folders);
      if (picked !== undefined) {
        select(folderKey(picked));
      }
    }),
    vscode.commands.registerCommand("outskirts.scanOptions", async () => {
      if (current.several) {
        const picked = await pickOneFolder(scannable.folders);
        if (picked === undefined) {
          return;
        }
        select(folderKey(picked));
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
