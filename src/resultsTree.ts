import * as vscode from "vscode";
import { FolderInfo, nextDescriptionChange } from "./folderModel";
import { isFolderNode, isResultGroup, treeChildren, TreeNode } from "./folderTree";
import { ResultsStore } from "./resultsStore";
import { isStaleFinding, staleHint } from "./staleModel";
import { GroupBy, groupDescription, leafDescription, leafLabel } from "./treeModel";

export type ResultNode = TreeNode;

export class ResultsTreeProvider implements vscode.TreeDataProvider<ResultNode> {
  private readonly changed = new vscode.EventEmitter<undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  private mode: GroupBy = "file";
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly store: ResultsStore,
    private readonly folders: () => readonly FolderInfo[],
    private readonly scanning: () => string | undefined,
    private readonly now: () => number = Date.now,
  ) {}

  get groupBy(): GroupBy {
    return this.mode;
  }

  set groupBy(mode: GroupBy) {
    this.mode = mode;
    this.refresh();
  }

  refresh(): void {
    this.changed.fire(undefined);
    clearTimeout(this.timer);
    const delay = nextDescriptionChange(this.store.all(), this.now());
    this.timer = delay === undefined ? undefined : setTimeout(() => {
      this.refresh();
    }, delay + 1000);
  }

  getChildren(node?: ResultNode): ResultNode[] {
    const context = {
      folders: this.folders(),
      results: this.store.all(),
      groupBy: this.mode,
      scanning: this.scanning(),
      now: this.now(),
    };
    return treeChildren(context, node);
  }

  getTreeItem(node: ResultNode): vscode.TreeItem {
    if (isFolderNode(node)) {
      const state = node.expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
      const item = new vscode.TreeItem(node.name, state);
      item.id = `folder:${node.key}`;
      item.description = node.description;
      item.tooltip = node.stale ? `${node.root}\n${staleHint}` : node.root;
      item.contextValue = (this.store.get(node.key)?.findings.length ?? 0) > 0 ? "folder.results" : "folder";
      item.iconPath = vscode.ThemeIcon.Folder;
      item.resourceUri = vscode.Uri.parse(node.key);
      return item;
    }
    if (isResultGroup(node)) {
      const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.Expanded);
      item.id = `${node.folder ?? ""}:${this.mode}:${node.key}`;
      const stale = this.mode === "file" && node.folder !== undefined && this.store.get(node.folder)?.stale.has(node.key) === true;
      item.description = groupDescription(node, stale);
      item.iconPath = this.mode === "file" ? vscode.ThemeIcon.File : new vscode.ThemeIcon("symbol-misc");
      if (this.mode === "file") {
        item.resourceUri = vscode.Uri.file(node.key);
        item.contextValue = "fileGroup";
      }
      return item;
    }
    const item = new vscode.TreeItem(leafLabel(node), vscode.TreeItemCollapsibleState.None);
    item.description = leafDescription(node, this.mode, isStaleFinding(this.store.all(), node));
    item.tooltip = node.message;
    item.iconPath = new vscode.ThemeIcon("warning");
    item.contextValue = "result";
    const position = new vscode.Position(node.line, node.column);
    item.command = {
      command: "vscode.open",
      title: "Open",
      arguments: [vscode.Uri.file(node.file), { selection: new vscode.Range(position, position) }],
    };
    return item;
  }

  getParent(): ResultNode | undefined {
    return undefined;
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.changed.dispose();
  }
}
