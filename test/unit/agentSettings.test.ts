import * as assert from "node:assert/strict";
import { knownAgents, promptPlaceholder } from "../../src/agents";
import { agentSelection, userValue, validateAgentCommand } from "../../src/agentSettings";

describe("userValue", () => {
  it("reads the user value, then the default, and never a workspace value", () => {
    assert.equal(userValue({ defaultValue: "", globalValue: "codex", workspaceValue: "claude" }), "codex");
    assert.equal(userValue({ defaultValue: "", workspaceValue: "claude", workspaceFolderValue: "claude" }), "");
    assert.equal(userValue(undefined), undefined);
  });
});

describe("validateAgentCommand", () => {
  it("accepts an executable followed by arguments holding ${prompt} once, as a whole argument", () => {
    const command = ["my-agent", "--interactive", promptPlaceholder];
    assert.deepEqual(validateAgentCommand(command), command);
  });

  it("refuses anything else", () => {
    for (const value of [
      undefined,
      "my-agent ${prompt}",
      [],
      ["", promptPlaceholder],
      [promptPlaceholder],
      ["my-agent"],
      ["my-agent", promptPlaceholder, promptPlaceholder],
      ["my-agent", "--prompt=${prompt}"],
      ["my-agent", "--prompt=${prompt}", promptPlaceholder],
      ["my-agent", 3, promptPlaceholder],
    ]) {
      assert.throws(() => validateAgentCommand(value), /outskirts\.agentCommand/, JSON.stringify(value));
    }
  });
});

describe("agentSelection", () => {
  const command = { defaultValue: [], globalValue: ["/opt/my-agent", "-i", promptPlaceholder] };

  it("is none when no agent is set, even if a workspace sets one", () => {
    assert.deepEqual(agentSelection({ defaultValue: "", workspaceValue: "claude" }, command), { kind: "none" });
  });

  it("returns the known agent set by the user", () => {
    assert.deepEqual(agentSelection({ defaultValue: "", globalValue: "claude" }, command), { kind: "agent", agent: knownAgents[0] });
  });

  it("builds the custom agent from the user command, ignoring a workspace command", () => {
    assert.deepEqual(agentSelection({ globalValue: "custom" }, command), {
      kind: "agent",
      agent: { id: "custom", name: "Custom command", executable: "/opt/my-agent", args: ["-i", promptPlaceholder] },
    });
    const selection = agentSelection({ globalValue: "custom" }, { defaultValue: [], workspaceValue: ["evil", promptPlaceholder] });
    assert.equal(selection.kind, "invalid");
  });

  it("reports an unknown agent id", () => {
    assert.deepEqual(agentSelection({ globalValue: "other" }, command), {
      kind: "invalid",
      reason: "Unknown agent 'other' in the setting outskirts.agent.",
    });
  });
});
