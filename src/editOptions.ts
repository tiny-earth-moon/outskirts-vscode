import * as vscode from "vscode";
import { joinArguments, tokenize } from "./tokenize";

const severities = ["error", "warning", "information", "hint"];

export async function editSeverity(folder: vscode.WorkspaceFolder): Promise<void> {
  const config = vscode.workspace.getConfiguration("outskirts", folder.uri);
  const severity = config.get<string>("severity", "warning");
  const picked = await vscode.window.showQuickPick(severities, { title: `Severity (${folder.name})`, placeHolder: severity });
  if (picked !== undefined) {
    await config.update("severity", picked, vscode.ConfigurationTarget.WorkspaceFolder);
  }
}

export async function editArguments(folder: vscode.WorkspaceFolder): Promise<void> {
  const config = vscode.workspace.getConfiguration("outskirts", folder.uri);
  const text = await vscode.window.showInputBox({
    title: `Extra Arguments (${folder.name})`,
    prompt: "Arguments appended to `outskirts scan`, quoted like in a shell (no shell is used).",
    value: joinArguments(config.get<string[]>("arguments", [])),
    validateInput: (value) => {
      try {
        tokenize(value);
        return undefined;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    },
  });
  if (text !== undefined) {
    await config.update("arguments", tokenize(text), vscode.ConfigurationTarget.WorkspaceFolder);
  }
}

export async function setSkipBuild(folder: vscode.WorkspaceFolder, value: boolean): Promise<void> {
  const config = vscode.workspace.getConfiguration("outskirts", folder.uri);
  await config.update("skipBuild", value, vscode.ConfigurationTarget.WorkspaceFolder);
}
