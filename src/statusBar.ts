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
    item.command = scanner.scanningOnSave ? "outskirts.cancel" : "outskirts.results.focus";
    if (scanner.running) {
      item.text = scanner.scanningOnSave ? "$(loading~spin) outskirts: scanning on save…" : "$(loading~spin) outskirts";
      item.tooltip = scanner.scanningOnSave ? "outskirts: scanning on save, click to cancel" : "outskirts: scanning";
      item.show();
    } else if (scanner.failed.size > 0) {
      item.text = "$(error) outskirts: scan failed";
      item.tooltip = "outskirts: scan failed, click to show it";
      item.show();
    } else if (store.all().size === 0) {
      item.hide();
    } else {
      item.text = `$(circle-large-outline) outskirts: ${String(store.total)}`;
      item.tooltip = statusTooltip(
        folders().map((folder) => ({ name: folder.name, count: store.get(folder.key)?.findings.length, stale: store.get(folder.key)?.stale.size })),
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
