import * as vscode from "vscode";
import {
  parseSeverityByKind,
  severityKinds,
  severityNames,
} from "./severityByKind";
import { joinArguments, tokenize } from "./tokenize";

const severities: readonly string[] = severityNames;
const perKind = "Per kind…";

export async function editSeverity(
  folder: vscode.WorkspaceFolder,
): Promise<void> {
  const config = vscode.workspace.getConfiguration("outskirts", folder.uri);
  const severity = config.get<string>("severity", "warning");
  const picked = await vscode.window.showQuickPick([...severities, perKind], {
    title: `Severity (${folder.name})`,
    placeHolder: severity,
  });
  if (picked === perKind) {
    await editSeverityByKind(folder, config);
  } else if (picked !== undefined) {
    await config.update(
      "severity",
      picked,
      vscode.ConfigurationTarget.WorkspaceFolder,
    );
  }
}

async function editSeverityByKind(
  folder: vscode.WorkspaceFolder,
  config: vscode.WorkspaceConfiguration,
): Promise<void> {
  const overrides = parseSeverityByKind(
    config.inspect<unknown>("severityByKind")?.workspaceFolderValue,
  );
  const kinds = [...new Set([...severityKinds, ...overrides.byKind.keys()])];
  const kind = await vscode.window.showQuickPick(
    kinds.map((label) => ({ label, description: overrides.byKind.get(label) })),
    { title: `Severity per kind (${folder.name})` },
  );
  if (kind === undefined) {
    return;
  }
  const inherit = "Use outskirts.severity";
  const severity = await vscode.window.showQuickPick(
    [...severities, "off", inherit],
    { title: `Severity of ${kind.label}`, placeHolder: kind.description },
  );
  if (severity === undefined) {
    return;
  }
  const entries = new Map<string, string>(overrides.byKind);
  if (severity === inherit) {
    entries.delete(kind.label);
  } else {
    entries.set(kind.label, severity);
  }
  const next = Object.fromEntries(entries);
  await config.update(
    "severityByKind",
    Object.keys(next).length === 0 ? undefined : next,
    vscode.ConfigurationTarget.WorkspaceFolder,
  );
}

export async function editArguments(
  folder: vscode.WorkspaceFolder,
): Promise<void> {
  const config = vscode.workspace.getConfiguration("outskirts", folder.uri);
  const text = await vscode.window.showInputBox({
    title: `Extra Arguments (${folder.name})`,
    prompt:
      "Arguments appended to `outskirts scan`, quoted like in a shell (no shell is used).",
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
    await config.update(
      "arguments",
      tokenize(text),
      vscode.ConfigurationTarget.WorkspaceFolder,
    );
  }
}

export async function setSkipBuild(
  folder: vscode.WorkspaceFolder,
  value: boolean,
): Promise<void> {
  const config = vscode.workspace.getConfiguration("outskirts", folder.uri);
  await config.update(
    "skipBuild",
    value,
    vscode.ConfigurationTarget.WorkspaceFolder,
  );
}
