import { rm, stat } from "node:fs/promises";
import * as vscode from "vscode";
import { acceptArguments, baselineOption, baselinePath, configValue, configuredBaseline } from "./baseline";
import { ConfigFile, readConfigFile } from "./baselineConfig";
import { updateConfig } from "./configDocument";
import { pickOneProject } from "./pickFolder";
import { Project } from "./project";
import { ProjectList } from "./projectList";
import { ProjectRow } from "./projectsModel";
import { ResultsStore } from "./resultsStore";
import { Scanner } from "./scanCommand";

interface Located {
  root: string;
  config: ConfigFile;
  configured: string | undefined;
  file: string;
}

export function registerBaselineCommands(projects: ProjectList, scanner: Scanner, store: ResultsStore): vscode.Disposable[] {
  const resolve = async (row: ProjectRow | undefined, placeholder: string): Promise<Project | undefined> =>
    row === undefined ? pickOneProject(projects.projects, placeholder) : projects.find(row.key);
  return [
    vscode.commands.registerCommand("outskirts.acceptBaseline", async (row?: ProjectRow) => {
      const project = await resolve(row, "Project whose current results to accept as baseline");
      if (project !== undefined) {
        await guard(() => accept(project, scanner, store));
      }
    }),
    vscode.commands.registerCommand("outskirts.clearBaseline", async (row?: ProjectRow) => {
      const project = await resolve(row, "Project whose baseline to delete");
      if (project !== undefined) {
        await guard(() => clear(project));
      }
    }),
  ];
}

async function locate(project: Project): Promise<Located> {
  const root = project.uri.fsPath;
  const config = await readConfigFile(root);
  const configured = config.text === undefined ? undefined : configuredBaseline(config.text);
  return { root, config, configured, file: baselinePath(root, configured) };
}

async function accept(project: Project, scanner: Scanner, store: ResultsStore): Promise<void> {
  const located = await locate(project);
  const shown = configValue(located.root, located.file);
  if (located.configured === undefined && (await exists(located.file))) {
    const replace = "Replace";
    const choice = await vscode.window.showWarningMessage(
      `${shown} already exists and is not the baseline of the configuration. Replace it with the current results of ${project.name}?`,
      { modal: true },
      replace,
    );
    if (choice !== replace) {
      return;
    }
  }
  const written = await scanner.scanWith([project], { arguments: acceptArguments(located.file), skipBuild: store.all().has(project.key) });
  if (!written) {
    return;
  }
  if (located.configured !== undefined) {
    await scanner.scanWith([project], { skipBuild: true });
    return;
  }
  const use = `Use it in ${located.config.name}`;
  const choice = await vscode.window.showInformationMessage(
    `The results of ${project.name} are recorded in ${shown}. Scans hide them once ${located.config.name} names it as baseline.`,
    use,
  );
  if (choice === use) {
    await writeBaselineKey(located, configValue(located.root, located.file));
    await scanner.scanWith([project], { skipBuild: true });
  }
}

async function clear(project: Project): Promise<void> {
  const located = await locate(project);
  const shown = configValue(located.root, located.file);
  if (!(await exists(located.file))) {
    void vscode.window.showInformationMessage(`${project.name} has no baseline file (${shown}).`);
    return;
  }
  const remove = "Delete";
  const removeBoth = `Delete and Remove from ${located.config.name}`;
  const buttons = located.configured === undefined ? [remove] : [remove, removeBoth];
  const detail = located.configured === undefined ? undefined : `Delete alone keeps baseline: ${located.configured} in ${located.config.name}, and the next scan will fail until the file exists again.`;
  const choice = await vscode.window.showWarningMessage(`Delete the baseline ${shown} of ${project.name}?`, { modal: true, detail }, ...buttons);
  if (choice === undefined) {
    return;
  }
  await rm(located.file);
  if (choice === removeBoth) {
    await writeBaselineKey(located, undefined);
  }
}

async function writeBaselineKey(located: Located, value: string | undefined): Promise<void> {
  const config = await readConfigFile(located.root);
  const uri = vscode.Uri.file(config.path);
  if (vscode.workspace.textDocuments.some((document) => document.uri.fsPath === uri.fsPath && document.isDirty)) {
    throw new Error(`${config.name} has unsaved changes in an editor. Save or revert them, then try again.`);
  }
  const text = config.text ?? "";
  const updated = updateConfig(text, [baselineOption], { baseline: value });
  if (updated !== text || config.text === undefined) {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(updated, "utf8"));
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function guard(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
  }
}
