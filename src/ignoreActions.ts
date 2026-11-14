import * as vscode from "vscode";
import { ignoreDeclaration, ignoreFile, ignoreParameter, LineEdit, splitLines, unusedParameterName } from "./ignoreEdit";
import { ResultsStore } from "./resultsStore";

const markCommand = "outskirts.markFileStale";

function toEdit(uri: vscode.Uri, edit: LineEdit): vscode.WorkspaceEdit {
  const workspaceEdit = new vscode.WorkspaceEdit();
  if (edit.replace) {
    workspaceEdit.replace(uri, new vscode.Range(edit.line, 0, edit.line, Number.MAX_SAFE_INTEGER), edit.text);
  } else {
    workspaceEdit.insert(uri, new vscode.Position(edit.line, 0), edit.text);
  }
  return workspaceEdit;
}

class IgnoreActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(document: vscode.TextDocument, _range: vscode.Range, context: vscode.CodeActionContext): vscode.CodeAction[] {
    const diagnostics = context.diagnostics.filter((diagnostic) => diagnostic.source === "outskirts");
    if (diagnostics.length === 0) {
      return [];
    }
    const { lines, eol } = splitLines(document.getText());
    const actions: vscode.CodeAction[] = [];
    const add = (title: string, edit: LineEdit | undefined, diagnostic: vscode.Diagnostic, preferred: boolean): void => {
      if (edit === undefined || actions.some((action) => action.title === title)) {
        return;
      }
      const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
      action.edit = toEdit(document.uri, edit);
      action.diagnostics = [diagnostic];
      action.isPreferred = preferred;
      action.command = { command: markCommand, title, arguments: [document.uri] };
      actions.push(action);
    };
    for (const diagnostic of diagnostics) {
      const line = diagnostic.range.start.line;
      const parameter = unusedParameterName(diagnostic.message);
      if (parameter === undefined) {
        add("Ignore with // outskirts:ignore", ignoreDeclaration(lines, line, eol), diagnostic, true);
      } else {
        add(`Ignore parameter with // outskirts:ignore:parameters ${parameter}`, ignoreParameter(lines, line, parameter, eol), diagnostic, true);
      }
    }
    add("Ignore all in this file with // outskirts:ignore:all", ignoreFile(lines, eol), diagnostics[0], false);
    return actions;
  }
}

export function registerIgnoreActions(store: ResultsStore): vscode.Disposable[] {
  return [
    vscode.languages.registerCodeActionsProvider({ language: "swift" }, new IgnoreActionProvider(), {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    }),
    vscode.commands.registerCommand(markCommand, (uri: vscode.Uri) => {
      for (const project of store.all().keys()) {
        store.markStale(project, uri.fsPath);
      }
    }),
  ];
}
