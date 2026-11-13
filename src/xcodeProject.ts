import { readdir, readFile } from "node:fs/promises";
import * as path from "node:path";

const configurationFiles = [".outskirts.yml", ".outskirts.yaml", ".periphery.yml", ".periphery.yaml"];
const projectOptions = ["--project", "--generic-project-config", "--config"];
const projectKeys = /^["']?(project|generic_project_config)["']?\s*:/m;

export interface ProjectFolder {
  name: string;
  entries: readonly string[];
  configuration: string | undefined;
}

export class ProjectChoiceError extends Error {}

export function projectArguments(folder: ProjectFolder, extra: readonly string[]): string[] {
  if (folder.entries.includes("Package.swift") || namesProject(extra) || namesProjectIn(folder.configuration)) {
    return [];
  }
  const workspaces = folder.entries.filter((name) => name.endsWith(".xcworkspace")).sort();
  const candidates = workspaces.length > 0 ? workspaces : folder.entries.filter((name) => name.endsWith(".xcodeproj")).sort();
  if (candidates.length > 1) {
    throw new ProjectChoiceError(
      `${folder.name} holds several Xcode ${workspaces.length > 0 ? "workspaces" : "projects"} (${candidates.join(", ")}). ` +
        `Choose the one to scan with "--project <name>" in Extra arguments, or "project:" in .outskirts.yml.`,
    );
  }
  return candidates.length === 1 ? ["--project", candidates[0]] : [];
}

export async function readProjectFolder(directory: string): Promise<ProjectFolder> {
  const entries = await readdir(directory);
  const file = configurationFiles.find((name) => entries.includes(name));
  const configuration = file === undefined ? undefined : await readFile(path.join(directory, file), "utf8");
  return { name: path.basename(directory), entries, configuration };
}

function namesProject(extra: readonly string[]): boolean {
  const end = extra.indexOf("--");
  return (end === -1 ? extra : extra.slice(0, end)).some((argument) =>
    projectOptions.some((option) => argument === option || argument.startsWith(`${option}=`)),
  );
}

function namesProjectIn(configuration: string | undefined): boolean {
  return configuration !== undefined && projectKeys.test(configuration);
}
