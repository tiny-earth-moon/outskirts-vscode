import * as vscode from "vscode";
import { userValue } from "./agentSettings";

export function agentVerify(): boolean {
  return userValue(vscode.workspace.getConfiguration("outskirts").inspect<boolean>("agentVerify")) === true;
}

export async function setAgentVerify(checked: boolean): Promise<void> {
  await vscode.workspace.getConfiguration("outskirts").update("agentVerify", checked, vscode.ConfigurationTarget.Global);
}
