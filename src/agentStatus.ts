import { AgentDefinition, knownAgents } from "./agents";
import { AgentSelection } from "./agentSettings";

export type AgentStatus =
  | { kind: "none" }
  | { kind: "invalid"; reason: string }
  | { kind: "missing"; agent: AgentDefinition }
  | { kind: "ready"; agent: AgentDefinition; executable: string };

export function agentStatus(selection: AgentSelection, resolve: (agent: AgentDefinition) => string | undefined): AgentStatus {
  if (selection.kind !== "agent") {
    return selection;
  }
  const executable = resolve(selection.agent);
  return executable === undefined ? { kind: "missing", agent: selection.agent } : { kind: "ready", agent: selection.agent, executable };
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
      return `${status.agent.executable} was not found on the PATH. Click to choose another agent.`;
    case "ready":
      return status.executable;
  }
}

export type AgentPickChoice = { kind: "agent"; id: string } | { kind: "custom" } | { kind: "refresh" };

export interface AgentPickItem {
  label: string;
  description?: string;
  choice: AgentPickChoice;
  current: boolean;
}

export function agentPickItems(detected: ReadonlyMap<string, string>, currentId: string | undefined): AgentPickItem[] {
  const agents: AgentPickItem[] = knownAgents
    .filter((agent) => detected.has(agent.id))
    .map((agent) => ({
      label: agent.name,
      description: detected.get(agent.id),
      choice: { kind: "agent", id: agent.id },
      current: agent.id === currentId,
    }));
  return [
    ...agents,
    { label: "Custom command…", description: "outskirts.agentCommand", choice: { kind: "custom" }, current: currentId === "custom" },
    { label: "Refresh", description: "look for installed agents again", choice: { kind: "refresh" }, current: false },
  ];
}

export function agentPickPlaceholder(detected: ReadonlyMap<string, string>): string {
  return detected.size === 0
    ? "No known agent found on the PATH: refresh after installing one, or set a custom command"
    : "Coding agent to start with Fix with Agent";
}
