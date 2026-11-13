import * as vscode from "vscode";

const noFolderMessage = "Open a folder that holds a Swift package or an Xcode project.";

interface FolderItem extends vscode.QuickPickItem {
  folders: readonly vscode.WorkspaceFolder[];
}

export function activeFolder(folders: readonly vscode.WorkspaceFolder[]): vscode.WorkspaceFolder | undefined {
  const active = vscode.window.activeTextEditor?.document.uri;
  const folder = active === undefined ? undefined : vscode.workspace.getWorkspaceFolder(active);
  return folders.find((candidate) => candidate.uri.toString() === folder?.uri.toString());
}

export async function pickScanTargets(
  folders: readonly vscode.WorkspaceFolder[],
  preselected: vscode.WorkspaceFolder | undefined,
): Promise<readonly vscode.WorkspaceFolder[] | undefined> {
  if (folders.length <= 1) {
    return single(folders);
  }
  const items: FolderItem[] = [
    ...folders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folders: [folder] })),
    { label: "All folders", description: "one after another", folders },
  ];
  const picked = await choose(items, "Folder to scan with outskirts", items.find((item) => item.folders[0] === preselected && item.folders.length === 1));
  return picked?.folders;
}

export async function pickOneFolder(folders: readonly vscode.WorkspaceFolder[]): Promise<vscode.WorkspaceFolder | undefined> {
  if (folders.length <= 1) {
    return single(folders)?.[0];
  }
  const items = folders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folders: [folder] }));
  const picked = await choose(items, "Folder whose scan options to edit", undefined);
  return picked?.folders[0];
}

function single(folders: readonly vscode.WorkspaceFolder[]): readonly vscode.WorkspaceFolder[] | undefined {
  if (folders.length === 0) {
    void vscode.window.showErrorMessage(noFolderMessage);
    return undefined;
  }
  return folders;
}

function choose(items: FolderItem[], placeholder: string, active: FolderItem | undefined): Promise<FolderItem | undefined> {
  const pick = vscode.window.createQuickPick<FolderItem>();
  pick.items = items;
  pick.placeholder = placeholder;
  if (active !== undefined) {
    pick.activeItems = [active];
  }
  return new Promise((resolve) => {
    let accepted: FolderItem | undefined;
    pick.onDidAccept(() => {
      accepted = pick.selectedItems[0];
      pick.hide();
    });
    pick.onDidHide(() => {
      resolve(accepted);
      pick.dispose();
    });
    pick.show();
  });
}
