import * as vscode from "vscode";

export async function pickFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    void vscode.window.showErrorMessage("outskirts: open a folder that holds a Swift package or an Xcode project.");
    return undefined;
  }
  const active = vscode.window.activeTextEditor?.document.uri;
  const activeFolder = active === undefined ? undefined : vscode.workspace.getWorkspaceFolder(active);
  if (activeFolder !== undefined) {
    return activeFolder;
  }
  if (folders.length === 1) {
    return folders[0];
  }
  return vscode.window.showWorkspaceFolderPick({ placeHolder: "Folder to scan with outskirts" });
}
