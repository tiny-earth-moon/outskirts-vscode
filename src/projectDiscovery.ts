import * as vscode from "vscode";
import { discoverProjects, FolderListing, isCandidateDirectory } from "./projects";
import { Project } from "./project";

export async function findProjects(folders: readonly vscode.WorkspaceFolder[]): Promise<Project[]> {
  const listings = await Promise.all(folders.map(listFolder));
  const byKey = new Map(folders.map((folder) => [folder.uri.toString(), folder]));
  return discoverProjects(listings).flatMap((entry) => {
    const workspaceFolder = byKey.get(entry.folderKey);
    return workspaceFolder === undefined
      ? []
      : [{ key: entry.key, name: entry.name, uri: vscode.Uri.parse(entry.key), workspaceFolder }];
  });
}

async function listFolder(folder: vscode.WorkspaceFolder): Promise<FolderListing> {
  const entries = await readEntries(folder.uri);
  const directories = entries.filter(([name, type]) =>
    isCandidateDirectory(name, (type & vscode.FileType.Directory) !== 0, (type & vscode.FileType.SymbolicLink) !== 0),
  );
  const children = await Promise.all(
    directories.map(async ([name]) => {
      const uri = vscode.Uri.joinPath(folder.uri, name);
      return { key: uri.toString(), name, entries: (await readEntries(uri)).map(([entry]) => entry) };
    }),
  );
  return { key: folder.uri.toString(), name: folder.name, entries: entries.map(([name]) => name), children };
}

async function readEntries(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
  try {
    return await vscode.workspace.fs.readDirectory(uri);
  } catch {
    return [];
  }
}
