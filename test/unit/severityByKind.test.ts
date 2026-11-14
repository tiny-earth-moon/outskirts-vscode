import * as assert from "node:assert/strict";
import { Finding } from "../../src/findings";
import {
  parseSeverityByKind,
  resolveSeverity,
  severityDescription,
  severityKind,
} from "../../src/severityByKind";

const finding = (code?: string): Finding => ({
  file: "/a.swift",
  line: 0,
  column: 0,
  message: "m",
  kind: "function",
  name: "f",
  code,
});

describe("severityByKind", () => {
  it("keys a result by its hint, unused when it has none", () => {
    assert.equal(severityKind(finding("missingFinal")), "missingFinal");
    assert.equal(severityKind(finding()), "unused");
  });

  it("overrides the severity of a kind, off included, and falls back otherwise", () => {
    const overrides = parseSeverityByKind({
      missingFinal: "hint",
      unused: "off",
    });
    assert.equal(
      resolveSeverity(finding("missingFinal"), "warning", overrides),
      "hint",
    );
    assert.equal(resolveSeverity(finding(), "warning", overrides), "off");
    assert.equal(
      resolveSeverity(finding("redundantProtocol"), "error", overrides),
      "error",
    );
  });

  it("drops invalid values and reports them without throwing", () => {
    const overrides = parseSeverityByKind({
      missingFinal: "loud",
      unused: 3,
      emptyExtension: "error",
    });
    assert.deepEqual([...overrides.byKind], [["emptyExtension", "error"]]);
    assert.deepEqual(overrides.invalid, ['missingFinal: "loud"', "unused: 3"]);
    assert.equal(
      resolveSeverity(finding("missingFinal"), "warning", overrides),
      "warning",
    );
    assert.deepEqual(parseSeverityByKind("x").invalid, ['"x"']);
    assert.equal(parseSeverityByKind(undefined).byKind.size, 0);
  });

  it("describes the severity with the number of overrides", () => {
    assert.equal(
      severityDescription("warning", parseSeverityByKind({})),
      "warning",
    );
    assert.equal(
      severityDescription("warning", parseSeverityByKind({ unused: "error" })),
      "warning · 1 override",
    );
    assert.equal(
      severityDescription(
        "hint",
        parseSeverityByKind({ unused: "error", missingFinal: "off" }),
      ),
      "hint · 2 overrides",
    );
  });
});
