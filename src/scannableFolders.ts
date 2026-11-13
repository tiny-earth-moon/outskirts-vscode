import * as vscode from "vscode";
import { FolderInfo } from "./folderModel";
import { isScannableRoot } from "./scannable";

export class ScannableFolders {
  private current: readonly vscode.WorkspaceFolder[] = [];
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changed.event;
  private readonly subscription = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    void this.refresh();
  });
  private generation = 0;

  get folders(): readonly vscode.WorkspaceFolder[] {
    return this.current;
  }

  get infos(): FolderInfo[] {
    return this.current.map(folderInfo);
  }

  find(key: string): vscode.WorkspaceFolder | undefined {
    return this.current.find((folder) => folderKey(folder) === key);
  }

  async refresh(): Promise<void> {
    const generation = ++this.generation;
    const folders = vscode.workspace.workspaceFolders ?? [];
    const checks = await Promise.all(folders.map(isScannable));
    if (generation !== this.generation) {
      return;
    }
    this.current = folders.filter((_folder, index) => checks[index]);
    this.changed.fire();
  }

  dispose(): void {
    this.subscription.dispose();
    this.changed.dispose();
  }
}

export function folderKey(folder: vscode.WorkspaceFolder): string {
  return folder.uri.toString();
}

export function folderInfo(folder: vscode.WorkspaceFolder): FolderInfo {
  return { key: folderKey(folder), name: folder.name, root: folder.uri.fsPath };
}

async function isScannable(folder: vscode.WorkspaceFolder): Promise<boolean> {
  try {
    const entries = await vscode.workspace.fs.readDirectory(folder.uri);
    return isScannableRoot(entries.map(([name]) => name));
  } catch {
    return false;
  }
}
