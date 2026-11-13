import { AgentStatus, agentDescription, agentTooltip } from "./agentStatus";
import { joinArguments } from "./tokenize";
import { GroupBy } from "./treeModel";

export const installHint = "Install it with `brew install tiny-earth-moon/tap/outskirts` or set `outskirts.path`.";

export type ExecutableVersion = { state: "checking" } | { state: "found"; version: string } | { state: "missing" };

export interface OptionsSnapshot {
  skipBuild: boolean;
  severity: string;
  arguments: readonly string[];
  groupBy: GroupBy;
  executable: string;
  version: ExecutableVersion;
  agent: AgentStatus;
  agentVerify: boolean;
}

export type OptionId = "skipBuild" | "severity" | "arguments" | "groupBy" | "executable" | "agent" | "agentVerify";

export interface OptionRow {
  id: OptionId;
  label: string;
  description: string;
  icon: string;
  tooltip?: string;
  checked?: boolean;
}

export function executableDescription(executable: string, version: ExecutableVersion): string {
  switch (version.state) {
    case "checking":
      return `${executable} · checking…`;
    case "found":
      return `${executable} ${version.version}`;
    case "missing":
      return `${executable} · not found`;
  }
}

export function optionRows(snapshot: OptionsSnapshot): OptionRow[] {
  return [
    {
      id: "skipBuild",
      label: "Reuse existing index",
      description: "--skip-build",
      icon: "database",
      tooltip: "Scans without building, on the index of the last build.",
      checked: snapshot.skipBuild,
    },
    { id: "severity", label: "Severity", description: snapshot.severity, icon: "warning" },
    {
      id: "arguments",
      label: "Extra arguments",
      description: snapshot.arguments.length === 0 ? "none" : joinArguments(snapshot.arguments),
      icon: "edit",
    },
    { id: "groupBy", label: "Group results", description: snapshot.groupBy === "kind" ? "by kind" : "by file", icon: "list-tree" },
    {
      id: "executable",
      label: "Executable",
      description: executableDescription(snapshot.executable, snapshot.version),
      icon: "terminal",
      tooltip: snapshot.version.state === "missing" ? installHint : "Open the settings of the extension.",
    },
    { id: "agent", label: "Agent", description: agentDescription(snapshot.agent), icon: "sparkle", tooltip: agentTooltip(snapshot.agent) },
    {
      id: "agentVerify",
      label: "Agent verifies by building",
      description: "",
      icon: "tools",
      tooltip: "Lets the agent build the project or run its tests after its changes; otherwise it only searches the code.",
      checked: snapshot.agentVerify,
    },
  ];
}

export interface ShownProject {
  name: string;
  folderName: string;
  nested: boolean;
}

export function optionsDescription(project: ShownProject | undefined, several: boolean): string | undefined {
  if (project?.nested === true) {
    return `${project.name} · shared by ${project.folderName}`;
  }
  return several ? project?.name : undefined;
}
