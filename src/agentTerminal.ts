import * as vscode from "vscode";
import { LaunchRequest } from "./agents";

export function launchInTerminal(request: LaunchRequest): vscode.Terminal {
  const terminal = vscode.window.createTerminal({
    name: request.name,
    cwd: request.cwd,
    shellPath: request.executable,
    shellArgs: request.args,
    isTransient: true,
  });
  terminal.show();
  return terminal;
}
