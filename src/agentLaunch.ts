import * as path from "node:path";

export type AgentLaunch =
  | { kind: "direct"; executable: string; prefix: string[] }
  | { kind: "refused"; reason: string };

export interface LaunchEnvironment {
  platform: NodeJS.Platform;
  readText: (file: string) => string | undefined;
  isFile: (file: string) => boolean;
  isExecutable: (file: string) => boolean;
  findNode: () => string | undefined;
}

const directExtensions = new Set([".exe", ".com"]);
const batchExtensions = new Set([".cmd", ".bat"]);

export function agentLaunch(executable: string, environment: LaunchEnvironment): AgentLaunch {
  if (environment.platform !== "win32") {
    return { kind: "direct", executable, prefix: [] };
  }
  const extension = path.win32.extname(executable).toLowerCase();
  if (directExtensions.has(extension)) {
    return { kind: "direct", executable, prefix: [] };
  }
  if (batchExtensions.has(extension)) {
    return npmShimLaunch(executable, environment) ?? { kind: "refused", reason: batchRefusal(executable) };
  }
  return { kind: "refused", reason: `${executable} is not a program that Windows starts directly. ${customHint}` };
}

export function npmShimScript(shim: string, text: string): string | undefined {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== "");
  const setsOthers = lines.some((line) => /^@?set\s/i.test(line) && !/^@?set\s+(dp0=%~dp0$|"_prog=|PATHEXT=%PATHEXT:;\.JS;=;%$)/i.test(line));
  const runsNode = lines.some((line) => /^IF EXIST "%dp0%\\node\.exe" \($/i.test(line)) && lines.some((line) => /^SET "_prog=node"$/i.test(line));
  if (setsOthers || !runsNode) {
    return undefined;
  }
  const runs = lines.filter((line) => line.includes('"%_prog%"'));
  const match = runs.length === 1 ? /(?:^|&\s*)"%_prog%"\s+"%dp0%\\([^"%!^&|<>]+)"\s+%\*$/.exec(runs[0]) : null;
  return match === null ? undefined : path.win32.join(path.win32.dirname(shim), match[1]);
}

function npmShimLaunch(shim: string, environment: LaunchEnvironment): AgentLaunch | undefined {
  const text = environment.readText(shim);
  const script = text === undefined ? undefined : npmShimScript(shim, text);
  if (script === undefined || !environment.isFile(script)) {
    return undefined;
  }
  const local = path.win32.join(path.win32.dirname(shim), "node.exe");
  const node = environment.isExecutable(local) ? local : environment.findNode();
  if (node === undefined || !directExtensions.has(path.win32.extname(node).toLowerCase())) {
    return undefined;
  }
  return { kind: "direct", executable: node, prefix: [script] };
}

const customHint =
  'Set outskirts.agent to "custom" and outskirts.agentCommand to the program of the agent, an .exe, or node.exe followed by the script of the agent, e.g. ["node", "C:\\\\path\\\\to\\\\agent.js", "${prompt}"].';

function batchRefusal(executable: string): string {
  return `${executable} is a batch file: Windows runs it through cmd.exe, which would read the prompt as commands, so it is not started. ${customHint}`;
}
