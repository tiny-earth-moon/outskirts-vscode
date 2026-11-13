import * as vscode from "vscode";
import { AgentRegistry } from "./agentRegistry";
import { AgentPickChoice, agentPickItems, agentPickPlaceholder, doesNotRun } from "./agentStatus";

interface PickItem extends vscode.QuickPickItem {
  choice?: AgentPickChoice;
  current?: boolean;
}

export async function pickAgent(registry: AgentRegistry): Promise<boolean> {
  for (;;) {
    const picked = await choose(registry);
    if (picked === undefined) {
      return false;
    }
    const config = vscode.workspace.getConfiguration("outskirts");
    switch (picked.kind) {
      case "refresh":
        registry.refresh();
        continue;
      case "unavailable":
        void vscode.window.showWarningMessage(`${picked.executable} was ${doesNotRun}; install the agent, then refresh.`);
        return false;
      case "custom":
        await config.update("agent", "custom", vscode.ConfigurationTarget.Global);
        await vscode.commands.executeCommand("workbench.action.openSettings", "outskirts.agentCommand");
        return false;
      case "agent":
        await config.update("agent", picked.id, vscode.ConfigurationTarget.Global);
        return true;
    }
  }
}

function items(registry: AgentRegistry): PickItem[] {
  const availability = (executable: string) => registry.availability(executable);
  const result: PickItem[] = [];
  let previous: AgentPickChoice["kind"] = "agent";
  for (const item of agentPickItems(registry.detected, registry.selectedId, availability)) {
    if (item.choice.kind === "unavailable" && previous !== "unavailable") {
      result.push({ label: "not available", kind: vscode.QuickPickItemKind.Separator });
    } else if (item.choice.kind === "custom") {
      result.push({ label: "", kind: vscode.QuickPickItemKind.Separator });
    }
    previous = item.choice.kind;
    const icon = item.choice.kind === "refresh" ? "$(refresh) " : item.current ? "$(check) " : "";
    result.push({ label: `${icon}${item.label}`, description: item.description, choice: item.choice, current: item.current });
  }
  return result;
}

function choose(registry: AgentRegistry): Promise<AgentPickChoice | undefined> {
  const pick = vscode.window.createQuickPick<PickItem>();
  pick.title = "Select Agent";
  pick.placeholder = "Looking for installed agents…";
  pick.busy = true;
  let hidden = false;
  const result = new Promise<AgentPickChoice | undefined>((resolve) => {
    let accepted: PickItem | undefined;
    pick.onDidAccept(() => {
      accepted = pick.selectedItems[0];
      pick.hide();
    });
    pick.onDidHide(() => {
      hidden = true;
      resolve(accepted?.choice);
      pick.dispose();
    });
  });
  pick.show();
  void registry.probeDetected().then(() => {
    if (hidden) {
      return;
    }
    const entries = items(registry);
    pick.items = entries;
    pick.placeholder = agentPickPlaceholder(registry.detected, (executable) => registry.availability(executable));
    const current = entries.find((entry) => entry.current === true);
    if (current !== undefined) {
      pick.activeItems = [current];
    }
    pick.busy = false;
  });
  return result;
}
