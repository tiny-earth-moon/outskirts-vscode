import * as vscode from "vscode";
import { ResultsStore } from "./resultsStore";
import { Scanner } from "./scanCommand";
import { statusText } from "./summary";

export function createStatusBar(store: ResultsStore, scanner: Scanner): vscode.Disposable {
  const item = vscode.window.createStatusBarItem("outskirts.status", vscode.StatusBarAlignment.Left);
  item.name = "outskirts";
  item.command = "outskirts.results.focus";
  const update = (): void => {
    if (scanner.running) {
      item.text = "$(loading~spin) outskirts";
      item.tooltip = "outskirts: scanning";
      item.show();
    } else if (store.state === "none") {
      item.hide();
    } else {
      item.text = `$(search) ${statusText(store.findings.length)}`;
      item.tooltip = "Show the outskirts results";
      item.show();
    }
  };
  const subscriptions = [store.onDidChange(update), scanner.onDidChangeRunning(update)];
  return new vscode.Disposable(() => {
    subscriptions.forEach((subscription) => {
      subscription.dispose();
    });
    item.dispose();
  });
}
