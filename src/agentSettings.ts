import { AgentDefinition, customAgentId, knownAgent, promptPlaceholder } from "./agents";

export interface SettingValues<T> {
  defaultValue?: T;
  globalValue?: T;
  workspaceValue?: T;
  workspaceFolderValue?: T;
}

export type AgentSelection =
  | { kind: "none" }
  | { kind: "invalid"; reason: string }
  | { kind: "agent"; agent: AgentDefinition };

export function userValue<T>(setting: SettingValues<T> | undefined): T | undefined {
  return setting?.globalValue ?? setting?.defaultValue;
}

export function validateAgentCommand(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error("The setting outskirts.agentCommand must be an array of strings.");
  }
  const command: string[] = value;
  if (command.length === 0 || command[0].trim() === "") {
    throw new Error("The setting outskirts.agentCommand is empty; its first item is the agent executable.");
  }
  if (command[0] === promptPlaceholder) {
    throw new Error("The first item of outskirts.agentCommand must be the agent executable, not ${prompt}.");
  }
  const placeholders = command.filter((arg) => arg === promptPlaceholder).length;
  if (placeholders !== 1 || command.some((arg) => arg !== promptPlaceholder && arg.includes(promptPlaceholder))) {
    throw new Error("The setting outskirts.agentCommand must hold ${prompt} exactly once, as a whole argument.");
  }
  return command;
}

export function agentSelection(
  agent: SettingValues<string> | undefined,
  command: SettingValues<unknown> | undefined,
): AgentSelection {
  const id = userValue(agent) ?? "";
  if (id === "") {
    return { kind: "none" };
  }
  if (id === customAgentId) {
    try {
      const [executable, ...args] = validateAgentCommand(userValue(command) ?? []);
      return { kind: "agent", agent: { id: customAgentId, name: "Custom command", executable, args } };
    } catch (error) {
      return { kind: "invalid", reason: error instanceof Error ? error.message : String(error) };
    }
  }
  const known = knownAgent(id);
  return known === undefined ? { kind: "invalid", reason: `Unknown agent '${id}' in the setting outskirts.agent.` } : { kind: "agent", agent: known };
}
