import * as vscode from "vscode";
import { ResultsStore } from "./resultsStore";
import { filesWithResults, projectsWithFile } from "./staleModel";

export function watchStaleFiles(store: ResultsStore): vscode.Disposable {
  let watched = "";
  let watchers: vscode.Disposable[] = [];
  const mark = (uri: vscode.Uri): void => {
    if (uri.scheme !== "file") {
      return;
    }
    for (const project of projectsWithFile(store.all(), uri.fsPath)) {
      store.markStale(project, uri.fsPath);
    }
  };
  const disposeWatchers = (): void => {
    watchers.forEach((watcher) => {
      watcher.dispose();
    });
    watchers = [];
  };
  const rewatch = (): void => {
    const files = filesWithResults(store.all());
    const key = files.join("\n");
    if (key === watched) {
      return;
    }
    watched = key;
    disposeWatchers();
    watchers = files.flatMap((file) => {
      const uri = vscode.Uri.file(file);
      const pattern = new vscode.RelativePattern(vscode.Uri.joinPath(uri, ".."), uri.path.split("/").pop() ?? "");
      const watcher = vscode.workspace.createFileSystemWatcher(pattern, true, false, false);
      return [watcher, watcher.onDidChange(mark), watcher.onDidDelete(mark)];
    });
  };
  const subscriptions = [
    store.onDidChange(rewatch),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.contentChanges.length > 0) {
        mark(event.document.uri);
      }
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      mark(document.uri);
    }),
  ];
  return {
    dispose: () => {
      disposeWatchers();
      subscriptions.forEach((subscription) => {
        subscription.dispose();
      });
    },
  };
}
