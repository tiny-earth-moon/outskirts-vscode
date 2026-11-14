import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { parseSchema, sectionOf, sections } from "../../src/configSchema";

const fixture = readFileSync(path.join(__dirname, "../../../test/fixtures/config-schema.json"), "utf8");

describe("parseSchema", () => {
  const schema = parseSchema(fixture);
  const option = (key: string) => {
    const found = schema.options.find((entry) => entry.key === key);
    assert.ok(found, key);
    return found;
  };

  it("reads every property of the schema of outskirts, in its order", () => {
    assert.equal(schema.options.length, 78);
    assert.equal(schema.options[0].key, "project");
    assert.equal(schema.id, "https://raw.githubusercontent.com/tiny-earth-moon/outskirts/master/outskirts.schema.json");
  });

  it("derives the control of each option from its type", () => {
    assert.deepEqual([option("strict").kind, option("strict").defaultValue], ["boolean", false]);
    assert.deepEqual([option("schemes").kind, option("schemes").defaultValue], ["list", []]);
    assert.deepEqual(option("index_exclude").defaultValue, ["**/*?.build/**/*", "**/SourcePackages/checkouts/**"]);
    assert.deepEqual([option("format").kind, option("format").choices?.[0], option("format").defaultValue], ["enum", "xcode", "xcode"]);
    assert.deepEqual([option("cache_max_age_days").kind, option("cache_max_age_days").defaultValue], ["integer", 14]);
    assert.deepEqual([option("project").kind, option("project").defaultValue], ["string", undefined]);
    assert.equal(option("report_exclude").kind, "list");
    assert.deepEqual([option("retain_public").kind, option("retain_public").acceptsList], ["boolean", true]);
    assert.equal(option("disable_platform_conditional_retention").defaultValue, true);
  });

  it("files every option under a known section", () => {
    for (const entry of schema.options) {
      assert.ok((sections as readonly string[]).includes(entry.section), entry.key);
    }
    assert.ok(schema.options.filter((entry) => entry.section === "Advanced").length < 5);
  });

  it("skips properties it cannot edit and refuses a schema without properties", () => {
    const parsed = parseSchema(JSON.stringify({ properties: { odd: { type: "object" }, flag: { type: "boolean", description: "A flag." } } }));
    assert.deepEqual(parsed.options.map((entry) => entry.key), ["flag"]);
    assert.equal(parsed.id, undefined);
    assert.throws(() => parseSchema("{}"), /no properties/);
    assert.throws(() => parseSchema("not json"));
  });
});

describe("sectionOf", () => {
  it("groups options by name, then by prefix", () => {
    assert.equal(sectionOf("schemes"), "Project & build");
    assert.equal(sectionOf("report_exclude"), "Targets & files");
    assert.equal(sectionOf("retain_codable_properties"), "Retention");
    assert.equal(sectionOf("enable_open_final_analysis"), "Analysis");
    assert.equal(sectionOf("localized_string_key_patterns"), "String Catalogs");
    assert.equal(sectionOf("format"), "Reporting & output");
    assert.equal(sectionOf("something_new"), "Advanced");
  });
});
