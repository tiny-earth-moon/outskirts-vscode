import * as vscode from "vscode";
import { FolderInfo } from "./folderModel";

export interface Project {
  readonly key: string;
  readonly name: string;
  readonly uri: vscode.Uri;
  readonly workspaceFolder: vscode.WorkspaceFolder;
}

export function isNested(project: Project): boolean {
  return project.uri.toString() !== project.workspaceFolder.uri.toString();
}

export function projectInfo(project: Project): FolderInfo {
  return { key: project.key, name: project.name, root: project.uri.fsPath };
}
