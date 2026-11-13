import * as path from "node:path";
import * as vscode from "vscode";
import type { OutskirtsApi } from "../../../src/extension";

export const root = path.resolve(__dirname, "../../../..");

export async function activateWithFake(): Promise<OutskirtsApi> {
  const config = vscode.workspace.getConfiguration("outskirts");
  await config.update("path", path.join(root, "test/integration/fake-outskirts"), vscode.ConfigurationTarget.Global);
  const extension = vscode.extensions.getExtension<OutskirtsApi>("tiny-earth-moon.outskirts");
  if (extension === undefined) {
    throw new Error("The extension is not installed.");
  }
  const api = await extension.activate();
  await api.ready;
  return api;
}
