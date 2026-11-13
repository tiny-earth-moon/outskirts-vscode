import * as assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { activateWithFake, root } from "./activate";

const fakeAgent = `#!/usr/bin/env node
const { writeFileSync } = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
if (args[0] === "--version") {
  process.stdout.write("1.0.0\\n");
  process.exit(0);
}
writeFileSync(path.join(__dirname, "launch.json"), JSON.stringify({ count: args.length, cwd: process.cwd(), prompt: args[0] }));
`;

interface Launch {
  count: number;
  cwd: string;
  prompt: string;
}

async function waitForFile(file: string, timeout: number): Promise<Launch> {
  const end = Date.now() + timeout;
  while (!existsSync(file)) {
    if (Date.now() > end) {
      throw new Error("The fake agent did not start.");
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return JSON.parse(readFileSync(file, "utf8")) as Launch;
}

export function describeFixWithAgent(): void {
  describe("outskirts.fixWithAgent", () => {
    it("starts the selected agent in the project directory with the prompt as one argument", async () => {
      const { testing, options } = await activateWithFake();
      if (testing === undefined) {
        throw new Error("The testing API is only available in test mode.");
      }
      const directory = mkdtempSync(path.join(os.tmpdir(), "outskirts-agent-"));
      const executable = path.join(directory, "claude");
      writeFileSync(executable, fakeAgent);
      chmodSync(executable, 0o755);
      const config = vscode.workspace.getConfiguration("outskirts");
      try {
        testing.setAgentSearchPath([directory]);
        await config.update("agent", "claude", vscode.ConfigurationTarget.Global);
        const agentRow = options.tree.getChildren().find((row) => row.id === "agent");
        assert.equal(agentRow?.description, "Claude Code");

        await vscode.commands.executeCommand("outskirts.scan");
        await vscode.commands.executeCommand("outskirts.fixWithAgent");
        const launch = await waitForFile(path.join(directory, "launch.json"), 20000);
        assert.equal(launch.count, 1);
        assert.equal(launch.cwd, realpathSync(path.join(root, "test/integration/fixture-workspace")));
        assert.match(launch.prompt, /^Remove the unused Swift code listed below, found by outskirts in the project fixture-workspace\./);
        assert.ok(launch.prompt.endsWith("\n\nSources/Demo/main.swift\n3:6  function unusedHelper() — unused"));
        assert.ok(vscode.window.terminals.some((terminal) => terminal.name === "outskirts: Claude Code"));
      } finally {
        await config.update("agent", undefined, vscode.ConfigurationTarget.Global);
        testing.setAgentSearchPath(undefined);
        vscode.window.terminals.filter((terminal) => terminal.name.startsWith("outskirts: ")).forEach((terminal) => {
          terminal.dispose();
        });
        await vscode.commands.executeCommand("outskirts.clear");
        rmSync(directory, { recursive: true, force: true });
      }
    });
  });
}
