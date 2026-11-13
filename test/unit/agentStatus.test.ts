import * as assert from "node:assert/strict";
import { knownAgents } from "../../src/agents";
import { agentDescription, agentPickItems, agentPickPlaceholder, agentStatus, agentTooltip } from "../../src/agentStatus";

const claude = knownAgents[0];

describe("agentStatus", () => {
  it("is ready when the executable of the selected agent resolves, missing otherwise", () => {
    assert.deepEqual(agentStatus({ kind: "agent", agent: claude }, () => "/bin/claude"), {
      kind: "ready",
      agent: claude,
      executable: "/bin/claude",
    });
    assert.deepEqual(agentStatus({ kind: "agent", agent: claude }, () => undefined), { kind: "missing", agent: claude });
    assert.deepEqual(agentStatus({ kind: "none" }, () => "/bin/claude"), { kind: "none" });
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
  it("offers the detected agents in table order, then a custom command and a refresh", () => {
    const detected = new Map([
      ["codex", "/opt/bin/codex"],
      ["claude", "/bin/claude"],
    ]);
    const items = agentPickItems(detected, "codex");
    assert.deepEqual(items.map((item) => [item.label, item.description, item.current]), [
      ["Claude Code", "/bin/claude", false],
      ["Codex CLI", "/opt/bin/codex", true],
      ["Custom command…", "outskirts.agentCommand", false],
      ["Refresh", "look for installed agents again", false],
    ]);
    assert.deepEqual(items[1].choice, { kind: "agent", id: "codex" });
    assert.equal(agentPickItems(new Map(), "custom")[0].current, true);
  });

  it("says when no known agent is installed", () => {
    assert.match(agentPickPlaceholder(new Map()), /^No known agent found/);
    assert.equal(agentPickPlaceholder(new Map([["claude", "/bin/claude"]])), "Coding agent to start with Fix with Agent");
  });
});
