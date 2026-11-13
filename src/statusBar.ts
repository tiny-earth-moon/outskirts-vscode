import * as vscode from "vscode";
import { FolderInfo } from "./folderModel";
import { ResultsStore } from "./resultsStore";
import { Scanner } from "./scanCommand";
import { statusTooltip } from "./summary";

export function createStatusBar(
  store: ResultsStore,
  scanner: Scanner,
  folders: () => readonly FolderInfo[],
): { update(): void; dispose(): void } {
  const item = vscode.window.createStatusBarItem("outskirts.status", vscode.StatusBarAlignment.Left);
  item.name = "outskirts";
  item.command = "outskirts.results.focus";
  const update = (): void => {
    if (scanner.running) {
      item.text = "$(loading~spin) outskirts";
      item.tooltip = "outskirts: scanning";
      item.show();
    } else if (store.all().size === 0) {
      item.hide();
    } else {
      item.text = `$(circle-large-outline) ${String(store.total)}`;
      item.tooltip = statusTooltip(
        folders().map((folder) => ({ name: folder.name, count: store.get(folder.key)?.findings.length })),
      );
      item.show();
    }
  };
  const subscriptions = [store.onDidChange(update), scanner.onDidChangeRunning(update)];
  return {
    update,
    dispose: () => {
      subscriptions.forEach((subscription) => {
        subscription.dispose();
      });
      item.dispose();
    },
  };
}
