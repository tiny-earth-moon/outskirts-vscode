import * as path from "node:path";
import * as vscode from "vscode";
import { detectAgents, findExecutable, pathDirectories } from "./agentDetection";
import { AgentDefinition, customAgentId, knownAgents } from "./agents";
import { agentSelection, userValue } from "./agentSettings";
import { AgentStatus, agentStatus } from "./agentStatus";
import { executableExtensions, isExecutableFile } from "./executableFile";

export class AgentRegistry {
  private found: ReadonlyMap<string, string> = new Map();
  private searchPath: readonly string[] | undefined;
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changed.event;

  constructor() {
    this.refresh();
  }

  get detected(): ReadonlyMap<string, string> {
    return this.found;
  }

  get selectedId(): string | undefined {
    return userValue(vscode.workspace.getConfiguration("outskirts").inspect<string>("agent"));
  }

  refresh(): void {
    this.found = detectAgents(knownAgents, this.directories(), isExecutableFile, executableExtensions());
    this.changed.fire();
  }

  status(): AgentStatus {
    const config = vscode.workspace.getConfiguration("outskirts");
    const selection = agentSelection(config.inspect<string>("agent"), config.inspect<unknown>("agentCommand"));
    return agentStatus(selection, (agent) => this.resolve(agent));
  }

  setSearchPathForTesting(directories: readonly string[] | undefined): void {
    this.searchPath = directories;
    this.refresh();
  }

  dispose(): void {
    this.changed.dispose();
  }

  private resolve(agent: AgentDefinition): string | undefined {
    if (agent.id !== customAgentId) {
      return this.found.get(agent.id);
    }
    return findExecutable(agent.executable, this.directories(), isExecutableFile, executableExtensions());
  }

  private directories(): readonly string[] {
    return this.searchPath ?? pathDirectories(process.env.PATH, path.delimiter);
  }
}
