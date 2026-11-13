import * as vscode from "vscode";
import { Project } from "./project";

const noProjectMessage = "Open a folder that holds a Swift package or an Xcode project, at its root or one level below.";

interface ProjectItem extends vscode.QuickPickItem {
  projects: readonly Project[];
}

export async function pickScanTargets(
  projects: readonly Project[],
  preselected: Project | undefined,
): Promise<readonly Project[] | undefined> {
  if (projects.length <= 1) {
    return single(projects);
  }
  const items: ProjectItem[] = [
    ...projects.map(item),
    { label: "All projects", description: "one after another", projects },
  ];
  const active = items.find((candidate) => candidate.projects.length === 1 && candidate.projects[0] === preselected);
  const picked = await choose(items, "Project to scan with outskirts", active);
  return picked?.projects;
}

export async function pickOneProject(projects: readonly Project[]): Promise<Project | undefined> {
  if (projects.length <= 1) {
    return single(projects)?.[0];
  }
  const picked = await choose(projects.map(item), "Project whose scan options to show", undefined);
  return picked?.projects[0];
}

function item(project: Project): ProjectItem {
  return { label: project.name, description: project.uri.fsPath, projects: [project] };
}

function single(projects: readonly Project[]): readonly Project[] | undefined {
  if (projects.length === 0) {
    void vscode.window.showErrorMessage(noProjectMessage);
    return undefined;
  }
  return projects;
}

function choose(items: ProjectItem[], placeholder: string, active: ProjectItem | undefined): Promise<ProjectItem | undefined> {
  const pick = vscode.window.createQuickPick<ProjectItem>();
  pick.items = items;
  pick.placeholder = placeholder;
  if (active !== undefined) {
    pick.activeItems = [active];
  }
  return new Promise((resolve) => {
    let accepted: ProjectItem | undefined;
    pick.onDidAccept(() => {
      accepted = pick.selectedItems[0];
      pick.hide();
    });
    pick.onDidHide(() => {
      resolve(accepted);
      pick.dispose();
    });
    pick.show();
  });
}
