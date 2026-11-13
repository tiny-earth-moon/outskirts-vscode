import { readFileSync, statSync } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { detectAgents, findExecutable, pathDirectories } from "./agentDetection";
import { AgentLaunch, agentLaunch } from "./agentLaunch";
import { AgentDefinition, customAgentId, knownAgents } from "./agents";
import { agentSelection, userValue } from "./agentSettings";
import { probeAgent } from "./agentProbe";
import { AgentAvailability, AgentStatus, agentStatus } from "./agentStatus";
import { executableExtensions, isExecutableFile } from "./executableFile";

export class AgentRegistry {
  private found: ReadonlyMap<string, string> = new Map();
  private searchPath: readonly string[] | undefined;
  private readonly probes = new Map<string, Promise<boolean>>();
  private readonly probed = new Map<string, boolean>();
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
    this.probes.clear();
    this.probed.clear();
    this.changed.fire();
  }

  availability(executable: string): AgentAvailability {
    const result = this.probed.get(executable);
    return result === undefined ? "unknown" : result ? "available" : "unavailable";
  }

  async probeDetected(): Promise<void> {
    await Promise.all([...this.found.values()].map((executable) => this.probe(executable)));
  }

  async probeSelected(): Promise<void> {
    const status = this.status();
    if (status.kind === "ready" && status.agent.id !== customAgentId) {
      await this.probe(status.executable);
    }
  }

  status(): AgentStatus {
    const config = vscode.workspace.getConfiguration("outskirts");
    const selection = agentSelection(config.inspect<string>("agent"), config.inspect<unknown>("agentCommand"));
    return agentStatus(
      selection,
      (agent) => this.resolve(agent),
      (executable) => this.availability(executable),
      (executable) => this.refusal(executable),
    );
  }

  launch(executable: string): AgentLaunch {
    return agentLaunch(executable, {
      platform: process.platform,
      readText: readSmallText,
      isFile: (file) => isFile(file),
      isExecutable: (file) => isExecutableFile(file),
      findNode: () => findExecutable("node", this.directories(), isExecutableFile, executableExtensions()),
    });
  }

  refusal(executable: string): string | undefined {
    const launch = this.launch(executable);
    return launch.kind === "refused" ? launch.reason : undefined;
  }

  setSearchPath(directories: readonly string[] | undefined): void {
    this.searchPath = directories;
    this.refresh();
  }

  private probe(executable: string): Promise<boolean> {
    let probe = this.probes.get(executable);
    if (probe === undefined) {
      const probes = this.probes;
      const launch = this.launch(executable);
      const started = launch.kind === "direct" ? probeAgent(launch.executable, undefined, launch.prefix) : Promise.resolve(false);
      probe = started.then((runs) => {
        if (probes.get(executable) === probe) {
          this.probed.set(executable, runs);
          this.changed.fire();
        }
        return runs;
      });
      probes.set(executable, probe);
    }
    return probe;
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

function readSmallText(file: string): string | undefined {
  try {
    return statSync(file).size <= 65_536 ? readFileSync(file, "utf8") : undefined;
  } catch {
    return undefined;
  }
}

function isFile(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}
