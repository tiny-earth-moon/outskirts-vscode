import * as vscode from "vscode";
import { Project } from "./project";
import { ResultsStore } from "./resultsStore";
import { SaveScheduler, saveMode } from "./saveScheduler";
import { Scanner } from "./scanCommand";

const indexNotice = "Scan on save reuses the index of the last build (outskirts.skipBuild): results follow the last build, not the saved file, and changed files stay marked stale until you build.";

export function watchSaves(
  store: ResultsStore,
  scanner: Scanner,
  find: (key: string) => Project | undefined,
  containing: (uri: vscode.Uri) => Project | undefined,
): vscode.Disposable {
  let noticeShown = false;
  const config = (key: string) => vscode.workspace.getConfiguration("outskirts", find(key)?.workspaceFolder.uri);
  const scheduler = new SaveScheduler(
    {
      mode: (key) => saveMode(config(key).get("scanOnSave")),
      delay: (key) => config(key).get<number>("scanOnSaveDelay", 1500),
      projectOf: (file) => containing(vscode.Uri.file(file))?.key,
      eligible: (key) => vscode.workspace.isTrusted && find(key) !== undefined && store.get(key) !== undefined,
      busy: () => scanner.running,
      start: (keys) => {
        const projects = keys.map(find).filter((project) => project !== undefined);
        if (!noticeShown && projects.some((project) => config(project.key).get<boolean>("skipBuild", false))) {
          noticeShown = true;
          void vscode.window.showInformationMessage(indexNotice);
        }
        void scanner.scanWith(projects, { onSave: true });
      },
    },
    { set: (callback, ms) => setTimeout(callback, ms), clear: (handle) => { clearTimeout(handle as NodeJS.Timeout); } },
  );
  const subscriptions = [
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.uri.scheme === "file" && document.uri.fsPath.endsWith(".swift")) {
        scheduler.saved(document.uri.fsPath);
      }
    }),
    scanner.onDidChangeRunning((running) => {
      if (!running) {
        setTimeout(() => {
          scheduler.idle();
        }, 0);
      }
    }),
  ];
  return {
    dispose: () => {
      scheduler.dispose();
      subscriptions.forEach((subscription) => {
        subscription.dispose();
      });
    },
  };
}
