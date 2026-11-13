import * as vscode from "vscode";
import { AgentRegistry } from "./agentRegistry";
import { AgentPickItem, agentPickItems, agentPickPlaceholder } from "./agentStatus";

interface PickItem extends vscode.QuickPickItem {
  item: AgentPickItem;
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

function choose(registry: AgentRegistry): Promise<AgentPickItem["choice"] | undefined> {
  const items: PickItem[] = agentPickItems(registry.detected, registry.selectedId).map((item) => ({
    label: item.choice.kind === "refresh" ? "$(refresh) Refresh" : item.current ? `$(check) ${item.label}` : item.label,
    description: item.description,
    item,
  }));
  return new Promise((resolve) => {
    const pick = vscode.window.createQuickPick<PickItem>();
    pick.title = "Select Agent";
    pick.items = items;
    pick.placeholder = agentPickPlaceholder(registry.detected);
    const current = items.find((entry) => entry.item.current);
    if (current !== undefined) {
      pick.activeItems = [current];
    }
    let accepted: PickItem | undefined;
    pick.onDidAccept(() => {
      accepted = pick.selectedItems[0];
      pick.hide();
    });
    pick.onDidHide(() => {
      resolve(accepted?.item.choice);
      pick.dispose();
    });
    pick.show();
  });
}
