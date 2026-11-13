import * as vscode from "vscode";
import { pickAgent } from "./agentPick";
import { commandLineLength, fitPrompt, maxPromptBytes, maxPromptResults } from "./agentPrompt";
import { AgentRegistry } from "./agentRegistry";
import { FixScope, nodeScope, projectsWithResults } from "./agentScope";
import { launchRequest } from "./agents";
import { launchInTerminal } from "./agentTerminal";
import { TreeNode } from "./folderTree";
import { pickOneProject } from "./pickFolder";
import { ProjectList } from "./projectList";
import { agentVerify } from "./agentVerify";
import { ResultsStore } from "./resultsStore";
import { statusError } from "./agentStatus";
import { freshFindings, staleScopeMessage } from "./staleModel";

export function registerFixWithAgent(store: ResultsStore, projects: ProjectList, registry: AgentRegistry): vscode.Disposable[] {
  const scopeOf = async (node: TreeNode | undefined): Promise<FixScope | undefined> => {
    if (node !== undefined) {
      return nodeScope(node, store.all());
    }
    const keys = projectsWithResults(projects.projects.map((project) => project.key), store.all());
    const candidates = projects.projects.filter((project) => keys.includes(project.key));
    if (candidates.length === 0) {
      return undefined;
    }
    const picked = await pickOneProject(candidates, "Project whose results to fix with the agent");
    return picked === undefined ? undefined : { project: picked.key, findings: store.get(picked.key)?.findings ?? [] };
  };
  const fix = async (node?: TreeNode): Promise<void> => {
    if (!vscode.workspace.isTrusted) {
      void vscode.window.showErrorMessage("An agent edits the project, so it only starts in a trusted workspace.");
      return;
    }
    const scope = await scopeOf(node);
    const project = scope === undefined ? undefined : projects.find(scope.project);
    if (scope === undefined || project === undefined || scope.findings.length === 0) {
      void vscode.window.showInformationMessage("No results to fix: scan the project first.");
      return;
    }
    const findings = freshFindings(store.get(scope.project), scope.findings);
    if (findings.length === 0) {
      void vscode.window.showInformationMessage(staleScopeMessage);
      return;
    }
    await registry.probeSelected();
    let status = registry.status();
    if (status.kind !== "ready") {
      if (!(await pickAgent(registry))) {
        return;
      }
      status = registry.status();
      if (status.kind !== "ready") {
        void vscode.window.showErrorMessage(statusError(status));
        return;
      }
    }
    const root = project.uri.fsPath;
    const agent = status.agent;
    const launch = registry.launch(status.executable);
    if (launch.kind === "refused") {
      void vscode.window.showErrorMessage(launch.reason);
      return;
    }
    const request = (text: string) => launchRequest(agent, launch.executable, text, root, launch.prefix);
    const lineLength = commandLineLength(process.platform, launch.executable, (text) => request(text).args);
    const prompt = fitPrompt({ projectName: project.name, root, findings, verify: agentVerify() }, maxPromptBytes, maxPromptResults, lineLength);
    launchInTerminal(request(prompt));
  };
  return [
    vscode.commands.registerCommand("outskirts.fixWithAgent", fix),
    vscode.commands.registerCommand("outskirts.pickAgent", () => pickAgent(registry)),
  ];
}
