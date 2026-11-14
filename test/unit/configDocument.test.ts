import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { configFileName, readConfig, schemaComment, updateConfig } from "../../src/configDocument";
import { isDefault, parseSchema } from "../../src/configSchema";

const { options, id } = parseSchema(readFileSync(path.join(__dirname, "../../../test/fixtures/config-schema.json"), "utf8"));
const option = (key: string) => {
  const found = options.find((entry) => entry.key === key);
  assert.ok(found, key);
  return found;
};

describe("configFileName", () => {
  it("takes the file outskirts reads first, or .outskirts.yml", () => {
    assert.equal(configFileName([".periphery.yml", ".outskirts.yaml"]), ".outskirts.yaml");
    assert.equal(configFileName(["Package.swift"]), ".outskirts.yml");
  });
});

describe("readConfig", () => {
  it("reads the known keys, accepting a single value for a list and quoted booleans", () => {
    const contents = readConfig('schemes: App\nstrict: "true"\ncache_max_age_days: 3\nformat: json\n', options);
    assert.deepEqual(contents.values, { schemes: ["App"], strict: true, cache_max_age_days: 3, format: "json" });
    assert.deepEqual(contents.other, []);
  });

  it("keeps the values the form cannot edit and the unknown keys apart", () => {
    const contents = readConfig("retain_public: [Core]\nformat: xml\nreport_exclude:\n  - path: a/**\n    kinds: [unused]\nmy_key: 1\n", options);
    assert.deepEqual(Object.keys(contents.complex), ["retain_public", "format", "report_exclude"]);
    assert.equal(contents.complex.retain_public, "retain_public:\n  - Core");
    assert.deepEqual(contents.other, [{ key: "my_key", text: "my_key: 1" }]);
  });

  it("reads an empty or comment-only file as no option and refuses what is not a mapping", () => {
    assert.deepEqual(readConfig("", options).values, {});
    assert.deepEqual(readConfig("# nothing\n", options).values, {});
    assert.throws(() => readConfig("- a\n", options), /not a mapping/);
    assert.throws(() => readConfig("a: [\n", options), /not valid YAML/);
  });
});

describe("isDefault", () => {
  it("treats empty strings and empty lists as unset", () => {
    assert.equal(isDefault(option("project"), ""), true);
    assert.equal(isDefault(option("schemes"), []), true);
    assert.equal(isDefault(option("index_exclude"), ["**/*?.build/**/*", "**/SourcePackages/checkouts/**"]), true);
    assert.equal(isDefault(option("index_exclude"), []), false);
    assert.equal(isDefault(option("cache_max_age_days"), 14), true);
    assert.equal(isDefault(option("strict"), true), false);
  });
});

describe("updateConfig", () => {
  const original = [
    "# Configuration of the app",
    "project: App.xcodeproj # the project",
    "",
    "# Schemes to build",
    "schemes:",
    "  - App",
    "custom_key: kept # not an option",
    "strict: true",
    "",
  ].join("\n");

  it("returns the text unchanged when the form matches the file", () => {
    const values = { project: "App.xcodeproj", schemes: ["App"], strict: true, quiet: false };
    assert.equal(updateConfig(original, options, values), original);
  });

  it("changes values in place, keeping comments, key order and unknown keys", () => {
    const updated = updateConfig(original, options, { project: "App.xcworkspace", schemes: ["App", "Widget"] });
    assert.equal(
      updated,
      [
        "# Configuration of the app",
        "project: App.xcworkspace # the project",
        "",
        "# Schemes to build",
        "schemes:",
        "  - App",
        "  - Widget",
        "custom_key: kept # not an option",
        "strict: true",
        "",
      ].join("\n"),
    );
  });

  it("removes the keys set back to their default and appends new ones at the end", () => {
    const updated = updateConfig(original, options, { project: "", strict: false, format: "json", retain_codable_properties: true });
    assert.equal(
      updated,
      [
        "# Configuration of the app",
        "",
        "# Schemes to build",
        "schemes:",
        "  - App",
        "custom_key: kept # not an option",
        "format: json",
        "retain_codable_properties: true",
        "",
      ].join("\n"),
    );
  });

  it("never writes a default value", () => {
    assert.equal(updateConfig("", options, { strict: false, cache_max_age_days: 14, schemes: [], project: "" }), "");
  });

  it("starts a new file with the schema comment", () => {
    const header = schemaComment(id);
    assert.equal(
      updateConfig("", options, { schemes: ["App"] }, header),
      `# yaml-language-server: $schema=${String(id)}\n\nschemes:\n  - App\n`,
    );
  });

  it("keeps the comment of the first key and the file comments when every key is removed", () => {
    assert.equal(updateConfig("# top\nstrict: true\nquiet: true\n", options, { strict: false }), "# top\nquiet: true\n");
    const emptied = updateConfig("# top\nstrict: true\n", options, { strict: false });
    assert.ok(emptied.includes("# top"), emptied);
    assert.ok(!emptied.includes("{}"), emptied);
  });

  it("leaves the keys the form did not send untouched", () => {
    const text = "report_exclude:\n  - path: a/**\n    kinds: [unused]\nstrict: true\n";
    assert.equal(updateConfig(text, options, { strict: false }), "report_exclude:\n  - path: a/**\n    kinds: [unused]\n");
  });

  it("refuses to rewrite a file that is not valid YAML", () => {
    assert.throws(() => updateConfig("a: [\n", options, { strict: true }), /not valid YAML/);
  });
});
