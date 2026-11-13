import * as assert from "node:assert/strict";
import { AgentLaunch, agentLaunch, LaunchEnvironment, npmShimScript } from "../../src/agentLaunch";
import { knownAgents, launchRequest } from "../../src/agents";

const shim = "C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd";
const script = "C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js";

function npmShim(target: string, extraLines = ""): string {
  return [
    "@ECHO off",
    "GOTO start",
    ":find_dp0",
    "SET dp0=%~dp0",
    "EXIT /b",
    ":start",
    "SETLOCAL",
    "CALL :find_dp0",
    extraLines,
    'IF EXIST "%dp0%\\node.exe" (',
    '  SET "_prog=%dp0%\\node.exe"',
    ") ELSE (",
    '  SET "_prog=node"',
    ")",
    "",
    `endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & set PATHEXT=%PATHEXT:;.JS;=;% & "%_prog%"  "%dp0%\\${target}" %*`,
    "",
  ].join("\r\n");
}

const olderNpmShim = [
  "@ECHO off",
  "SETLOCAL",
  "CALL :find_dp0",
  'IF EXIST "%dp0%\\node.exe" (',
  '  SET "_prog=%dp0%\\node.exe"',
  ") ELSE (",
  '  SET "_prog=node"',
  "  SET PATHEXT=%PATHEXT:;.JS;=;%",
  ")",
  '"%_prog%"  "%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*',
  "ENDLOCAL",
  "EXIT /b %errorlevel%",
  ":find_dp0",
  "SET dp0=%~dp0",
  "EXIT /b",
].join("\r\n");

function windows(files: Record<string, string>, node?: string): LaunchEnvironment {
  return {
    platform: "win32",
    readText: (file) => files[file],
    isFile: (file) => file in files,
    isExecutable: (file) => file in files && /\.(exe|com|cmd|bat)$/i.test(file),
    findNode: () => node,
  };
}

function refusal(launch: AgentLaunch): string {
  if (launch.kind !== "refused") {
    assert.fail(`expected a refusal, got ${launch.executable}`);
  }
  return launch.reason;
}

describe("agentLaunch", () => {
  it("starts the executable as it is on macOS and Linux", () => {
    for (const platform of ["darwin", "linux"] as const) {
      const environment = { ...windows({}), platform };
      assert.deepEqual(agentLaunch("/opt/bin/codex", environment), { kind: "direct", executable: "/opt/bin/codex", prefix: [] });
      assert.deepEqual(agentLaunch("/opt/bin/agent.cmd", environment), { kind: "direct", executable: "/opt/bin/agent.cmd", prefix: [] });
    }
  });

  it("starts an .exe or a .com as it is on Windows", () => {
    assert.deepEqual(agentLaunch("C:\\Tools\\claude.exe", windows({})), { kind: "direct", executable: "C:\\Tools\\claude.exe", prefix: [] });
    assert.deepEqual(agentLaunch("C:\\Tools\\agent.COM", windows({})), { kind: "direct", executable: "C:\\Tools\\agent.COM", prefix: [] });
  });

  it("starts the script of an npm .cmd with the node.exe next to it, or the one on the PATH, never through cmd.exe", () => {
    const local = "C:\\Users\\me\\AppData\\Roaming\\npm\\node.exe";
    const files = { [shim]: npmShim("node_modules\\@openai\\codex\\bin\\codex.js"), [script]: "" };
    assert.deepEqual(agentLaunch(shim, windows({ ...files, [local]: "" }, "C:\\Program Files\\nodejs\\node.exe")), {
      kind: "direct",
      executable: local,
      prefix: [script],
    });
    assert.deepEqual(agentLaunch(shim, windows(files, "C:\\Program Files\\nodejs\\node.exe")), {
      kind: "direct",
      executable: "C:\\Program Files\\nodejs\\node.exe",
      prefix: [script],
    });
    assert.deepEqual(agentLaunch(shim, windows({ [shim]: olderNpmShim, [script]: "" }, "C:\\nodejs\\node.exe")), {
      kind: "direct",
      executable: "C:\\nodejs\\node.exe",
      prefix: [script],
    });
  });

  it("refuses a .cmd or .bat that is not a plain npm shim, and says how to set the command instead", () => {
    const other = "C:\\Tools\\agent.cmd";
    const reason = refusal(agentLaunch(other, windows({ [other]: '@echo off\r\n"C:\\Tools\\agent.exe" %*\r\n' }, "C:\\nodejs\\node.exe")));
    assert.match(reason, /batch file/);
    assert.match(reason, /cmd\.exe/);
    assert.match(reason, /outskirts\.agentCommand/);
    assert.match(reason, /\$\{prompt\}/);
    refusal(agentLaunch("C:\\Tools\\agent.BAT", windows({}, "C:\\nodejs\\node.exe")));
  });

  it("refuses an npm shim whose script or node cannot be started directly", () => {
    const files = { [shim]: npmShim("node_modules\\@openai\\codex\\bin\\codex.js"), [script]: "" };
    refusal(agentLaunch(shim, windows({ [shim]: files[shim] }, "C:\\nodejs\\node.exe")));
    refusal(agentLaunch(shim, windows(files, undefined)));
    refusal(agentLaunch(shim, windows(files, "C:\\Users\\me\\.volta\\bin\\node.cmd")));
    refusal(agentLaunch(shim, windows({ [shim]: npmShim("node_modules\\a\\cli.js", "@SET NODE_OPTIONS=--inspect"), [script]: "" }, "C:\\nodejs\\node.exe")));
  });

  it("refuses on Windows what is neither a program nor a batch file", () => {
    assert.match(refusal(agentLaunch("C:\\Tools\\codex", windows({}))), /outskirts\.agentCommand/);
    refusal(agentLaunch("C:\\Tools\\codex.ps1", windows({})));
    refusal(agentLaunch("C:\\Tools\\codex.js", windows({})));
  });
});

describe("npmShimScript", () => {
  it("reads the script path that the shim passes to node", () => {
    assert.equal(npmShimScript(shim, npmShim("node_modules\\@openai\\codex\\bin\\codex.js")), script);
    assert.equal(npmShimScript(shim, npmShim("..\\lib\\cli.js")), "C:\\Users\\me\\AppData\\Roaming\\lib\\cli.js");
  });

  it("rejects a shim that runs another program, passes options, or whose path cmd.exe would expand", () => {
    assert.equal(npmShimScript(shim, npmShim("node_modules\\%USERNAME%\\cli.js")), undefined);
    assert.equal(npmShimScript(shim, npmShim("node_modules\\a&b\\cli.js")), undefined);
    assert.equal(npmShimScript(shim, npmShim("node_modules\\a\\cli.js").replace('"%_prog%"  ', '"%_prog%" --flag ')), undefined);
    assert.equal(npmShimScript(shim, npmShim("node_modules\\a\\cli.js").replaceAll("node", "sh")), undefined);
    assert.equal(npmShimScript(shim, '@"%~dp0\\agent.exe" %*\r\n'), undefined);
  });
});

describe("launchRequest with a resolved npm shim", () => {
  it("passes the script first and the prompt as one untouched argument", () => {
    const prompt = 'Remove a & b | c %PATH% ^x "quoted" && del';
    assert.deepEqual(launchRequest(knownAgents[1], "C:\\nodejs\\node.exe", prompt, "C:\\work\\App", [script]), {
      name: "outskirts: GitHub Copilot CLI",
      executable: "C:\\nodejs\\node.exe",
      args: [script, "-i", prompt],
      cwd: "C:\\work\\App",
    });
  });
});
