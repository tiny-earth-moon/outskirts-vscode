import { stat } from "node:fs/promises";
import * as vscode from "vscode";
import { ResultsStore } from "./resultsStore";
import { latestWrite, projectsByFile, watchRoots } from "./staleModel";

export function watchStaleFiles(store: ResultsStore, rootOf: (project: string) => string | undefined): vscode.Disposable {
  let watched = "";
  let watchers: vscode.Disposable[] = [];
  let index = new Map<string, string[]>();
  let disposed = false;
  const mark = (uri: vscode.Uri, writtenAt?: number): void => {
    if (uri.scheme !== "file" || disposed) {
      return;
    }
    store.noteChange(uri.fsPath, writtenAt);
    for (const project of index.get(uri.fsPath) ?? []) {
      store.markStale(project, uri.fsPath, writtenAt);
    }
  };
  const markWritten = (uri: vscode.Uri): void => {
    if (uri.scheme !== "file") {
      return;
    }
    stat(uri.fsPath).then(
      (stats) => {
        mark(uri, latestWrite(stats.mtimeMs));
      },
      () => {
        mark(uri);
      },
    );
  };
  const disposeWatchers = (): void => {
    watchers.forEach((watcher) => {
      watcher.dispose();
    });
    watchers = [];
  };
  const rewatch = (): void => {
    index = projectsByFile(store.all());
    const roots = watchRoots(store.all(), rootOf, store.scanned);
    const key = roots.map((root) => `${root.pattern} ${root.base}`).join("\n");
    if (key === watched) {
      return;
    }
    watched = key;
    disposeWatchers();
    watchers = roots.flatMap((root) => {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(root.base), root.pattern), true, false, false);
      return [watcher, watcher.onDidChange(markWritten), watcher.onDidDelete((uri) => {
        mark(uri);
      })];
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
      disposed = true;
      disposeWatchers();
      subscriptions.forEach((subscription) => {
        subscription.dispose();
      });
    },
  };
}
