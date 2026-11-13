import * as vscode from "vscode";
import { Finding } from "./findings";
import { ResultsStore } from "./resultsStore";
import { GroupBy, groupFindings, leafDescription, leafLabel, ResultGroup } from "./treeModel";

export type ResultNode = ResultGroup | Finding;

export class ResultsTreeProvider implements vscode.TreeDataProvider<ResultNode> {
  private readonly changed = new vscode.EventEmitter<undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  private mode: GroupBy = "file";

  constructor(private readonly store: ResultsStore, private readonly root: () => string | undefined) {
    store.onDidChange(() => {
      this.changed.fire(undefined);
    });
  }

  get groupBy(): GroupBy {
    return this.mode;
  }

  set groupBy(mode: GroupBy) {
    this.mode = mode;
    this.changed.fire(undefined);
  }

  getChildren(node?: ResultNode): ResultNode[] {
    if (node === undefined) {
      return groupFindings(this.store.findings, this.mode, this.root());
    }
    return isGroup(node) ? node.findings : [];
  }

  getTreeItem(node: ResultNode): vscode.TreeItem {
    if (isGroup(node)) {
      const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.Expanded);
      item.id = `${this.mode}:${node.key}`;
      item.description = [node.description, String(node.findings.length)].filter((part) => part !== undefined).join(" · ");
      item.iconPath = this.mode === "file" ? vscode.ThemeIcon.File : new vscode.ThemeIcon("symbol-misc");
      if (this.mode === "file") {
        item.resourceUri = vscode.Uri.file(node.key);
      }
      return item;
    }
    const item = new vscode.TreeItem(leafLabel(node), vscode.TreeItemCollapsibleState.None);
    item.description = leafDescription(node, this.mode);
    item.tooltip = node.message;
    item.iconPath = new vscode.ThemeIcon("warning");
    const position = new vscode.Position(node.line, node.column);
    item.command = {
      command: "vscode.open",
      title: "Open",
      arguments: [vscode.Uri.file(node.file), { selection: new vscode.Range(position, position) }],
    };
    return item;
  }

  dispose(): void {
    this.changed.dispose();
  }
}

function isGroup(node: ResultNode): node is ResultGroup {
  return "findings" in node;
}
