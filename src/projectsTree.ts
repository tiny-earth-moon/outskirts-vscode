import * as path from "node:path";
import * as vscode from "vscode";
import { Project } from "./project";
import { ProjectKind, ProjectRow, projectRows } from "./projectsModel";
import { ResultsStore } from "./resultsStore";
import { ScanError, wrappedMarkdown } from "./scanError";

const icons: Record<ProjectKind, string> = { package: "package", xcode: "device-mobile", generic: "folder" };


export class ProjectsTreeProvider implements vscode.TreeDataProvider<ProjectRow> {
  private readonly changed = new vscode.EventEmitter<undefined>();
  readonly onDidChangeTreeData = this.changed.event;

  constructor(
    private readonly store: ResultsStore,
    private readonly projects: () => readonly Project[],
    private readonly scanning: () => string | undefined,
    private readonly failed: () => ReadonlyMap<string, ScanError>,
    private readonly baselined: () => ReadonlySet<string> = () => new Set(),
  ) {}

  refresh(): void {
    this.changed.fire(undefined);
  }

  getChildren(row?: ProjectRow): ProjectRow[] {
    if (row !== undefined) {
      return [];
    }
    const several = (vscode.workspace.workspaceFolders?.length ?? 0) > 1;
    const sources = this.projects().map((project) => ({
      key: project.key,
      name: project.name,
      relativePath: relativePath(project, several),
      kind: project.kind ?? "generic",
    }));
    return projectRows(sources, { results: this.store.all(), scanning: this.scanning(), failed: this.failed(), baselined: this.baselined() });
  }

  getTreeItem(row: ProjectRow): vscode.TreeItem {
    const item = new vscode.TreeItem(row.name, vscode.TreeItemCollapsibleState.None);
    item.id = `project:${row.key}`;
    item.description = row.description;
    const error = row.state === "error" ? this.failed().get(row.key) : undefined;
    item.tooltip = error === undefined ? vscode.Uri.parse(row.key).fsPath : new vscode.MarkdownString(wrappedMarkdown(error.message));
    item.contextValue = row.contextValue;
    item.iconPath = row.state === "scanning" ? new vscode.ThemeIcon("loading~spin") : row.state === "error" ? new vscode.ThemeIcon("error") : new vscode.ThemeIcon(icons[row.kind]);
    item.command = { command: "outskirts.revealProject", title: "Show Results", arguments: [row] };
    return item;
  }

  dispose(): void {
    this.changed.dispose();
  }
}

function relativePath(project: Project, several: boolean): string {
  const relative = path.relative(project.workspaceFolder.uri.fsPath, project.uri.fsPath).split(path.sep).join("/");
  if (!several) {
    return relative;
  }
  return relative === "" ? project.workspaceFolder.name : `${project.workspaceFolder.name}/${relative}`;
}

