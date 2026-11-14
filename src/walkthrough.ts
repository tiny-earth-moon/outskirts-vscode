import * as vscode from "vscode";
import { resolveExecutable } from "./executable";
import { probeVersion } from "./versionProbe";
import { installCommand, shouldOpenWalkthrough, walkthroughId, walkthroughShownKey } from "./walkthroughState";

export function registerWalkthrough(context: vscode.ExtensionContext): vscode.Disposable[] {
  const detect = async (): Promise<void> => {
    let found: boolean;
    try {
      const executable = resolveExecutable(vscode.workspace.getConfiguration("outskirts").inspect<string>("path"));
      found = (await probeVersion(executable)).state === "found";
    } catch {
      found = false;
    }
    await vscode.commands.executeCommand("setContext", "outskirts.executableFound", found);
  };
  void detect();
  const testing = context.extensionMode === vscode.ExtensionMode.Test;
  if (shouldOpenWalkthrough(context.globalState.get<boolean>(walkthroughShownKey, false), testing)) {
    void context.globalState.update(walkthroughShownKey, true);
    void vscode.commands.executeCommand("workbench.action.openWalkthrough", walkthroughId, false);
  }
  return [
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("outskirts.path")) {
        void detect();
      }
    }),
    vscode.window.onDidChangeWindowState((state) => {
      if (state.focused) {
        void detect();
      }
    }),
    vscode.commands.registerCommand("outskirts.openWalkthrough", () =>
      vscode.commands.executeCommand("workbench.action.openWalkthrough", walkthroughId, false),
    ),
    vscode.commands.registerCommand("outskirts.installExecutable", () => {
      const terminal = vscode.window.createTerminal("Install outskirts");
      terminal.show();
      terminal.sendText(installCommand, false);
    }),
  ];
}
