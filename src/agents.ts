export const promptPlaceholder = "${prompt}";

export interface AgentDefinition {
  readonly id: string;
  readonly name: string;
  readonly executable: string;
  readonly args: readonly string[];
}

export const customAgentId = "custom";

export const knownAgents: readonly AgentDefinition[] = [
  { id: "claude", name: "Claude Code", executable: "claude", args: [promptPlaceholder] },
  { id: "copilot", name: "GitHub Copilot CLI", executable: "copilot", args: ["-i", promptPlaceholder] },
  { id: "codex", name: "Codex CLI", executable: "codex", args: [promptPlaceholder] },
  { id: "gemini", name: "Gemini CLI", executable: "gemini", args: ["-i", promptPlaceholder] },
  { id: "cursor", name: "Cursor Agent", executable: "cursor-agent", args: [promptPlaceholder] },
];

export function knownAgent(id: string): AgentDefinition | undefined {
  return knownAgents.find((agent) => agent.id === id);
}

export function substitutePrompt(args: readonly string[], prompt: string): string[] {
  return args.map((arg) => (arg === promptPlaceholder ? prompt : arg));
}

export interface LaunchRequest {
  name: string;
  executable: string;
  args: string[];
  cwd: string;
}

export function launchRequest(agent: AgentDefinition, executable: string, prompt: string, cwd: string): LaunchRequest {
  return { name: `outskirts: ${agent.name}`, executable, args: substitutePrompt(agent.args, prompt), cwd };
}
