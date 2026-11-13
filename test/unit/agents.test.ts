import * as assert from "node:assert/strict";
import { knownAgent, knownAgents, launchRequest, promptPlaceholder, substitutePrompt } from "../../src/agents";

describe("knownAgents", () => {
  it("has unique ids and executables, each with exactly one whole prompt argument", () => {
    assert.equal(new Set(knownAgents.map((agent) => agent.id)).size, knownAgents.length);
    assert.equal(new Set(knownAgents.map((agent) => agent.executable)).size, knownAgents.length);
    for (const agent of knownAgents) {
      assert.equal(agent.args.filter((arg) => arg === promptPlaceholder).length, 1, agent.id);
      assert.ok(agent.args.every((arg) => arg === promptPlaceholder || !arg.includes(promptPlaceholder)), agent.id);
    }
  });

  it("starts each agent in an interactive session with the prompt", () => {
    assert.deepEqual(
      knownAgents.map((agent) => [agent.id, agent.executable, ...agent.args]),
      [
        ["claude", "claude", promptPlaceholder],
        ["copilot", "copilot", "-i", promptPlaceholder],
        ["codex", "codex", promptPlaceholder],
        ["gemini", "gemini", "-i", promptPlaceholder],
        ["cursor", "cursor-agent", promptPlaceholder],
      ],
    );
    assert.equal(knownAgent("codex")?.name, "Codex CLI");
    assert.equal(knownAgent("custom"), undefined);
  });
});

describe("substitutePrompt", () => {
  const hostile = "Remove `rm -rf ~` $(touch /tmp/x) \"quoted\" 'single' ; | & > < \\ ${HOME}\nnext line";

  it("passes the prompt as one argument whatever characters it holds", () => {
    const args = substitutePrompt(["-i", promptPlaceholder], hostile);
    assert.deepEqual(args, ["-i", hostile]);
  });

  it("keeps other arguments and partial placeholders as they are", () => {
    assert.deepEqual(substitutePrompt(["--x", "a${prompt}b", promptPlaceholder], "p"), ["--x", "a${prompt}b", "p"]);
  });

  it("does not substitute placeholders found in the prompt itself", () => {
    assert.deepEqual(substitutePrompt([promptPlaceholder, "--flag"], promptPlaceholder), [promptPlaceholder, "--flag"]);
  });
});

describe("launchRequest", () => {
  it("names the terminal after the agent and runs the resolved executable in the project", () => {
    const agent = knownAgents[1];
    assert.deepEqual(launchRequest(agent, "/opt/bin/copilot", "Remove it", "/work/App"), {
      name: "outskirts: GitHub Copilot CLI",
      executable: "/opt/bin/copilot",
      args: ["-i", "Remove it"],
      cwd: "/work/App",
    });
  });
});
