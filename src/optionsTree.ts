import * as vscode from "vscode";
import { agentVerify } from "./agentVerify";
import { AgentStatus } from "./agentStatus";
import { resolveExecutable } from "./executable";
import { ExecutableVersion, OptionRow, optionRows } from "./optionsModel";
import { GroupBy } from "./treeModel";

const commands: Partial<Record<OptionRow["id"], string>> = {
  severity: "outskirts.editSeverity",
  arguments: "outskirts.editArguments",
  configuration: "outskirts.editConfiguration",
  groupBy: "outskirts.toggleGroupBy",
  executable: "outskirts.openSettings",
  agent: "outskirts.pickAgent",
};

export class OptionsTreeProvider implements vscode.TreeDataProvider<OptionRow> {
  private readonly changed = new vscode.EventEmitter<undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  version: ExecutableVersion = { state: "checking" };

  constructor(
    private readonly folder: () => vscode.WorkspaceFolder | undefined,
    private readonly groupBy: () => GroupBy,
    private readonly agent: () => AgentStatus,
    private readonly project: () => vscode.Uri | undefined = () => undefined,
  ) {}

  refresh(): void {
    this.changed.fire(undefined);
  }

  getChildren(row?: OptionRow): OptionRow[] {
    const folder = this.folder();
    if (row !== undefined || folder === undefined) {
      return [];
    }
    const config = vscode.workspace.getConfiguration("outskirts", folder.uri);
    return optionRows({
      skipBuild: config.get<boolean>("skipBuild", false),
      severity: config.get<string>("severity", "warning"),
      arguments: config.get<string[]>("arguments", []),
      groupBy: this.groupBy(),
      executable: executableName(),
      version: this.version,
      agent: this.agent(),
      agentVerify: agentVerify(),
    });
  }

  getTreeItem(row: OptionRow): vscode.TreeItem {
    const item = new vscode.TreeItem(row.label, vscode.TreeItemCollapsibleState.None);
    item.id = `option:${row.id}`;
    item.description = row.description;
    item.tooltip = row.tooltip;
    item.iconPath = new vscode.ThemeIcon(row.icon);
    if (row.checked !== undefined) {
      item.checkboxState = row.checked ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;
    }
    const command = commands[row.id];
    if (command !== undefined) {
      const project = row.id === "configuration" ? this.project() : undefined;
      item.command = { command, title: row.label, arguments: project === undefined ? [] : [project] };
    }
    return item;
  }

  dispose(): void {
    this.changed.dispose();
  }
}

export function executableName(): string {
  try {
    return resolveExecutable(vscode.workspace.getConfiguration("outskirts").inspect<string>("path"));
  } catch {
    return "(empty path)";
  }
}
