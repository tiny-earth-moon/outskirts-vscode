import * as assert from "node:assert/strict";
import { knownAgents, promptPlaceholder } from "../../src/agents";
import {
  AgentAvailability,
  agentDescription,
  agentPickItems,
  agentPickPlaceholder,
  agentStatus,
  agentTooltip,
  statusError,
} from "../../src/agentStatus";

const claude = knownAgents[0];
const custom = { id: "custom", name: "Custom command", executable: "/opt/my-agent", args: [promptPlaceholder] };

function probed(result: AgentAvailability): () => AgentAvailability {
  return () => result;
}

describe("agentStatus", () => {
  const selected = { kind: "agent", agent: claude } as const;

  it("is ready when the executable resolves and has not been probed yet, or runs", () => {
    const ready = { kind: "ready", agent: claude, executable: "/bin/claude" };
    assert.deepEqual(agentStatus(selected, () => "/bin/claude", probed("unknown")), ready);
    assert.deepEqual(agentStatus(selected, () => "/bin/claude", probed("available")), ready);
  });

  it("is missing when the executable does not resolve, or does not run", () => {
    assert.deepEqual(agentStatus(selected, () => undefined, probed("available")), { kind: "missing", agent: claude });
    const broken = agentStatus(selected, () => "/bin/claude", probed("unavailable"));
    assert.deepEqual(broken, { kind: "missing", agent: claude, reason: "/bin/claude was found on the PATH but does not run." });
    assert.equal(agentDescription(broken), "Claude Code (not installed)");
    assert.equal(agentTooltip(broken), "/bin/claude was found on the PATH but does not run. Click to choose another agent.");
  });

  it("does not use a probe for a custom command", () => {
    assert.deepEqual(agentStatus({ kind: "agent", agent: custom }, () => "/opt/my-agent", probed("unavailable")), {
      kind: "ready",
      agent: custom,
      executable: "/opt/my-agent",
    });
  });

  it("passes no selection through", () => {
    assert.deepEqual(agentStatus({ kind: "none" }, () => "/bin/claude", probed("available")), { kind: "none" });
  });
});

describe("agentStatus with an executable that is not started", () => {
  const reason = "C:\\npm\\claude.cmd is a batch file.";
  const refuse = () => reason;

  it("reports the reason for a known agent and for a custom command", () => {
    const known = agentStatus({ kind: "agent", agent: claude }, () => "C:\\npm\\claude.cmd", probed("unknown"), refuse);
    assert.deepEqual(known, { kind: "missing", agent: claude, reason });
    assert.equal(statusError(known), reason);
    const customStatus = agentStatus({ kind: "agent", agent: custom }, () => "C:\\npm\\agent.cmd", probed("unknown"), refuse);
    assert.deepEqual(customStatus, { kind: "invalid", reason });
    assert.equal(statusError(customStatus), reason);
    assert.equal(statusError({ kind: "missing", agent: claude }), "The selected agent is not installed.");
  });
});

describe("agentDescription", () => {
  it("names the agent, says when none is set and when it is not installed", () => {
    assert.equal(agentDescription({ kind: "ready", agent: claude, executable: "/bin/claude" }), "Claude Code");
    assert.equal(agentDescription({ kind: "none" }), "not set");
    assert.equal(agentDescription({ kind: "missing", agent: claude }), "Claude Code (not installed)");
    assert.equal(agentDescription({ kind: "invalid", reason: "Bad." }), "invalid setting");
    assert.equal(agentTooltip({ kind: "invalid", reason: "Bad." }), "Bad.");
    assert.equal(agentTooltip({ kind: "ready", agent: claude, executable: "/bin/claude" }), "/bin/claude");
  });
});

describe("agentPickItems", () => {
  const detected = new Map([
    ["copilot", "/shim/copilot"],
    ["codex", "/opt/bin/codex"],
    ["claude", "/bin/claude"],
  ]);

  it("offers the agents that run in table order, then those that do not, a custom command and a refresh", () => {
    const availability = (executable: string): AgentAvailability => (executable === "/shim/copilot" ? "unavailable" : "available");
    const items = agentPickItems(detected, "codex", availability);
    assert.deepEqual(items.map((item) => [item.label, item.description, item.choice.kind, item.current]), [
      ["Claude Code", "/bin/claude", "agent", false],
      ["Codex CLI", "/opt/bin/codex", "agent", true],
      ["GitHub Copilot CLI", "found on the PATH but does not run", "unavailable", false],
      ["Custom command…", "outskirts.agentCommand", "custom", false],
      ["Refresh", "look for installed agents again", "refresh", false],
    ]);
    assert.deepEqual(items[1].choice, { kind: "agent", id: "codex" });
    assert.deepEqual(items[2].choice, { kind: "unavailable", id: "copilot", executable: "/shim/copilot" });
    assert.equal(agentPickItems(new Map(), "custom", availability)[0].current, true);
  });

  it("offers an agent not probed yet as usable", () => {
    assert.equal(agentPickItems(detected, undefined, probed("unknown")).filter((item) => item.choice.kind === "agent").length, 3);
  });

  it("says when no known agent runs", () => {
    assert.match(agentPickPlaceholder(new Map(), probed("available")), /^No known agent found/);
    assert.match(agentPickPlaceholder(new Map([["copilot", "/shim/copilot"]]), probed("unavailable")), /^No known agent found/);
    assert.equal(agentPickPlaceholder(new Map([["claude", "/bin/claude"]]), probed("unknown")), "Coding agent to start with Fix with Agent");
  });
});
