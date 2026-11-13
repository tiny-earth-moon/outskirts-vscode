import * as vscode from "vscode";
import { pickOneFolder } from "./pickFolder";
import { joinArguments, tokenize } from "./tokenize";

const severities = ["error", "warning", "information", "hint"];

export async function editScanOptions(folders: readonly vscode.WorkspaceFolder[]): Promise<void> {
  const folder = await pickOneFolder(folders);
  if (folder === undefined) {
    return;
  }
  const config = vscode.workspace.getConfiguration("outskirts", folder.uri);
  const skipBuild = config.get<boolean>("skipBuild", false);
  const severity = config.get<string>("severity", "warning");
  const args = config.get<string[]>("arguments", []);
  const items = [
    { id: "skipBuild", label: `$(${skipBuild ? "pass-filled" : "circle-large-outline"}) Reuse the existing index`, description: "--skip-build" },
    { id: "severity", label: "$(warning) Severity", description: severity },
    { id: "arguments", label: "$(edit) Extra arguments", description: args.length === 0 ? "none" : joinArguments(args) },
  ];
  const choice = await vscode.window.showQuickPick(items, { title: `outskirts: Scan Options (${folder.name})` });
  const target = vscode.ConfigurationTarget.WorkspaceFolder;
  switch (choice?.id) {
    case "skipBuild":
      await config.update("skipBuild", !skipBuild, target);
      return;
    case "severity": {
      const picked = await vscode.window.showQuickPick(severities, { title: "outskirts: Severity", placeHolder: severity });
      if (picked !== undefined) {
        await config.update("severity", picked, target);
      }
      return;
    }
    case "arguments":
      await editArguments(config, args);
      return;
  }
}

async function editArguments(config: vscode.WorkspaceConfiguration, args: string[]): Promise<void> {
  const text = await vscode.window.showInputBox({
    title: "outskirts: Extra Arguments",
    prompt: "Arguments appended to `outskirts scan`, quoted like in a shell (no shell is used).",
    value: joinArguments(args),
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
