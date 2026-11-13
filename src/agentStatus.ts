import { AgentDefinition, customAgentId, knownAgents } from "./agents";
import { AgentSelection } from "./agentSettings";

export type AgentAvailability = "unknown" | "available" | "unavailable";

export type AgentStatus =
  | { kind: "none" }
  | { kind: "invalid"; reason: string }
  | { kind: "missing"; agent: AgentDefinition; reason?: string }
  | { kind: "ready"; agent: AgentDefinition; executable: string };

export const doesNotRun = "found on the PATH but does not run";

export function agentStatus(
  selection: AgentSelection,
  resolve: (agent: AgentDefinition) => string | undefined,
  availability: (executable: string) => AgentAvailability,
): AgentStatus {
  if (selection.kind !== "agent") {
    return selection;
  }
  const { agent } = selection;
  const executable = resolve(agent);
  if (executable === undefined) {
    return { kind: "missing", agent };
  }
  if (agent.id !== customAgentId && availability(executable) === "unavailable") {
    return { kind: "missing", agent, reason: `${executable} was ${doesNotRun}.` };
  }
  return { kind: "ready", agent, executable };
}

export function agentDescription(status: AgentStatus): string {
  switch (status.kind) {
    case "none":
      return "not set";
    case "invalid":
      return "invalid setting";
    case "missing":
      return `${status.agent.name} (not installed)`;
    case "ready":
      return status.agent.name;
  }
}

export function agentTooltip(status: AgentStatus): string {
  switch (status.kind) {
    case "none":
      return "Click to choose the coding agent that Fix with Agent starts.";
    case "invalid":
      return status.reason;
    case "missing":
      return `${status.reason ?? `${status.agent.executable} was not found on the PATH.`} Click to choose another agent.`;
    case "ready":
      return status.executable;
  }
}

export type AgentPickChoice =
  | { kind: "agent"; id: string }
  | { kind: "unavailable"; id: string; executable: string }
  | { kind: "custom" }
  | { kind: "refresh" };

export interface AgentPickItem {
  label: string;
  description?: string;
  choice: AgentPickChoice;
  current: boolean;
}

export function agentPickItems(
  detected: ReadonlyMap<string, string>,
  currentId: string | undefined,
  availability: (executable: string) => AgentAvailability,
): AgentPickItem[] {
  const usable: AgentPickItem[] = [];
  const unusable: AgentPickItem[] = [];
  for (const agent of knownAgents) {
    const executable = detected.get(agent.id);
    if (executable === undefined) {
      continue;
    }
    const current = agent.id === currentId;
    if (availability(executable) === "unavailable") {
      unusable.push({ label: agent.name, description: doesNotRun, choice: { kind: "unavailable", id: agent.id, executable }, current });
    } else {
      usable.push({ label: agent.name, description: executable, choice: { kind: "agent", id: agent.id }, current });
    }
  }
  return [
    ...usable,
    ...unusable,
    { label: "Custom command…", description: "outskirts.agentCommand", choice: { kind: "custom" }, current: currentId === "custom" },
    { label: "Refresh", description: "look for installed agents again", choice: { kind: "refresh" }, current: false },
  ];
}

export function agentPickPlaceholder(
  detected: ReadonlyMap<string, string>,
  availability: (executable: string) => AgentAvailability,
): string {
  return [...detected.values()].every((executable) => availability(executable) === "unavailable")
    ? "No known agent found on the PATH: refresh after installing one, or set a custom command"
    : "Coding agent to start with Fix with Agent";
}
