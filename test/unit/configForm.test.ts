import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import {
  addListItems,
  describeValue,
  isModified,
  matchesQuery,
  parseInteger,
  pendingChanges,
  visibleSections,
} from "../../src/configForm";
import { parseSchema } from "../../src/configSchema";

const { options } = parseSchema(readFileSync(path.join(__dirname, "../../../test/fixtures/config-schema.json"), "utf8"));
const option = (key: string) => {
  const found = options.find((entry) => entry.key === key);
  assert.ok(found, key);
  return found;
};

describe("matchesQuery", () => {
  it("matches every word against the key and the description", () => {
    assert.equal(matchesQuery(option("retain_codable_properties"), "codable"), true);
    assert.equal(matchesQuery(option("retain_codable_properties"), "retain codable"), true);
    assert.equal(matchesQuery(option("retain_codable_properties"), "RETAIN_CODABLE"), true);
    assert.equal(matchesQuery(option("schemes"), "build every target"), true);
    assert.equal(matchesQuery(option("schemes"), "codable"), false);
    assert.equal(matchesQuery(option("schemes"), "  "), true);
  });
});

describe("visibleSections", () => {
  it("groups the options by section in a fixed order and drops empty sections", () => {
    const all = visibleSections(options, {}, { query: "", modifiedOnly: false });
    assert.deepEqual(all.map((section) => section.name), [
      "Project & build",
      "Targets & files",
      "Retention",
      "Analysis",
      "String Catalogs",
      "Reporting & output",
      "Advanced",
    ]);
    assert.equal(all.reduce((total, section) => total + section.options.length, 0), options.length);
    const found = visibleSections(options, {}, { query: "codable", modifiedOnly: false });
    assert.deepEqual(found.map((section) => section.name), ["Retention"]);
  });

  it("shows only the options set away from their default when asked, and hides the given keys", () => {
    const values = { strict: true, quiet: false, schemes: ["App"] };
    const modified = visibleSections(options, values, { query: "", modifiedOnly: true });
    assert.deepEqual(modified.flatMap((section) => section.options.map((entry) => entry.key)), ["schemes", "strict"]);
    const hidden = visibleSections(options, values, { query: "", modifiedOnly: true }, new Set(["strict"]));
    assert.deepEqual(hidden.flatMap((section) => section.options.map((entry) => entry.key)), ["schemes"]);
    assert.equal(isModified(option("quiet"), values), false);
  });
});

describe("pendingChanges", () => {
  it("lists only the options whose value differs from the file", () => {
    const saved = { strict: true, schemes: ["App"] };
    assert.deepEqual(pendingChanges(options, { strict: true, schemes: ["App"] }, saved), {});
    assert.deepEqual(pendingChanges(options, { strict: false, schemes: ["App", "Kit"] }, saved), { strict: false, schemes: ["App", "Kit"] });
    assert.deepEqual(pendingChanges(options, { quiet: false, project: "" }, saved), {});
    assert.deepEqual(pendingChanges(options, { project: undefined }, { project: "App.xcodeproj" }), { project: undefined });
  });

  it("never sends the values the form cannot edit", () => {
    assert.deepEqual(pendingChanges(options, { retain_public: true }, {}, new Set(["retain_public"])), {});
  });
});

describe("parseInteger", () => {
  it("accepts whole numbers and empty text, and explains anything else", () => {
    assert.deepEqual(parseInteger(" 7 "), { value: 7 });
    assert.deepEqual(parseInteger(""), { value: undefined });
    assert.deepEqual(parseInteger("-1"), { value: -1 });
    assert.deepEqual(parseInteger("1.5"), { error: "Enter a whole number." });
    assert.deepEqual(parseInteger("ten"), { error: "Enter a whole number." });
    assert.deepEqual(parseInteger("99999999999999999999"), { error: "This number is too large." });
  });
});

describe("addListItems", () => {
  it("adds one item per pasted line, without duplicates", () => {
    assert.deepEqual(addListItems(["A"], "B\n A \n\nC\nB"), ["A", "B", "C"]);
    assert.deepEqual(addListItems([], "  "), []);
  });
});

describe("describeValue", () => {
  it("names unset, empty and list values", () => {
    assert.deepEqual([describeValue(undefined), describeValue([]), describeValue(["a", "b"]), describeValue(false), describeValue(14)], ["not set", "empty", "a, b", "false", "14"]);
  });
});
