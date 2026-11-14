import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import {
  libraryProducts,
  ProjectSummary,
  recommend,
  RecommendationInput,
  sharedSchemes,
  sourceSignals,
} from "../../src/configRecommendations";
import { parseSchema } from "../../src/configSchema";

const keys = new Set(
  parseSchema(readFileSync(path.join(__dirname, "../../../test/fixtures/config-schema.json"), "utf8")).options.map((option) => option.key),
);

const summary = (overrides: Partial<ProjectSummary>): ProjectSummary => ({
  files: [],
  truncated: false,
  signals: {},
  manifest: undefined,
  ...overrides,
});

const input = (overrides: Partial<RecommendationInput>): RecommendationInput => ({
  summary: summary({}),
  keys,
  configured: new Set(),
  fileExists: true,
  fileName: ".outskirts.yml",
  dismissed: new Set(),
  ...overrides,
});

const ids = (recommendations: readonly { id: string }[]): string[] => recommendations.map((recommendation) => recommendation.id);

const library = `
let package = Package(
  name: "Kit",
  products: [
    .library(name: "Kit", targets: ["Kit"]),
    .library(name: "KitUI", targets: ["KitUI"]),
  ]
)`;

describe("sourceSignals", () => {
  it("finds Codable, Objective-C and JavaScriptCore", () => {
    assert.deepEqual(sourceSignals("struct A: Codable {}"), ["codable"]);
    assert.deepEqual(sourceSignals("struct A: Encodable {}"), ["encodable"]);
    assert.deepEqual(sourceSignals("@objcMembers final class A: NSObject {}"), ["objc"]);
    assert.deepEqual(sourceSignals("@objc protocol E: JSExport {}"), ["objc", "jsExport"]);
    assert.deepEqual(sourceSignals("@testable import App\nimport XCTest\n"), []);
    assert.deepEqual(sourceSignals("let encoder = JSONEncoder()"), []);
  });

  it("tells a localized literal from a key built at runtime", () => {
    assert.deepEqual(sourceSignals('Text(String(localized: "title"))'), []);
    assert.deepEqual(sourceSignals('NSLocalizedString("title", comment: "")'), []);
    assert.deepEqual(sourceSignals("String(localized: String.LocalizationValue(key))"), ["dynamicLocalizedKey"]);
    assert.deepEqual(sourceSignals("NSLocalizedString(key, comment: \"\")"), ["dynamicLocalizedKey"]);
  });
});

describe("libraryProducts and sharedSchemes", () => {
  it("lists the library products of a manifest", () => {
    assert.deepEqual(libraryProducts(library), ["Kit", "KitUI"]);
  });

  it("lists the shared schemes of the root projects, not the user ones", () => {
    const files = [
      "App.xcodeproj/xcshareddata/xcschemes/App.xcscheme",
      "App.xcodeproj/xcshareddata/xcschemes/AppTests.xcscheme",
      "App.xcodeproj/xcuserdata/me.xcuserdatad/xcschemes/Mine.xcscheme",
      "Sub/Other.xcodeproj/xcshareddata/xcschemes/Other.xcscheme",
    ];
    assert.deepEqual(sharedSchemes(files), ["App", "AppTests"]);
  });
});

describe("recommend", () => {
  it("recommends the project and its shared schemes for an Xcode project", () => {
    const files = ["App.xcodeproj/project.pbxproj", "App.xcodeproj/xcshareddata/xcschemes/App.xcscheme", "App.xcodeproj/xcshareddata/xcschemes/AppTests.xcscheme"];
    const found = recommend(input({ summary: summary({ files }) }));
    assert.deepEqual(ids(found), ["project", "schemes"]);
    assert.deepEqual(found[0].changes, { project: "App.xcodeproj" });
    assert.deepEqual(found[1].changes, { schemes: ["App"] });
  });

  it("prefers the workspace, guesses the scheme without shared ones and skips a choice it cannot make", () => {
    const files = ["App.xcodeproj/project.pbxproj", "App.xcworkspace/contents.xcworkspacedata"];
    const found = recommend(input({ summary: summary({ files }) }));
    assert.deepEqual(found.map((recommendation) => recommendation.changes), [{ project: "App.xcworkspace" }, { schemes: ["App"] }]);
    const two = recommend(input({ summary: summary({ files: ["A.xcodeproj/project.pbxproj", "B.xcodeproj/project.pbxproj"] }) }));
    assert.deepEqual(ids(two), ["schemes"]);
  });

  it("keeps the public API of a library package, or of its libraries when it also builds executables", () => {
    const files = ["Package.swift"];
    assert.deepEqual(recommend(input({ summary: summary({ files, manifest: library }) }))[0].changes, { retain_public: true });
    const mixed = `${library}\n.executable(name: "kit", targets: ["CLI"])`;
    assert.deepEqual(recommend(input({ summary: summary({ files, manifest: mixed }) }))[0].changes, { retain_public_modules: ["Kit", "KitUI"] });
    assert.deepEqual(recommend(input({ summary: summary({ files, manifest: "let package = Package(name: \"App\")" }) })), []);
  });

  it("recommends retention options from the signals of the sources", () => {
    const found = recommend(
      input({
        summary: summary({
          files: ["Legacy/Bridge.m", "Resources/Localizable.xcstrings"],
          signals: { codable: 2, encodable: 1, objc: 3, jsExport: 1, dynamicLocalizedKey: 1 },
        }),
      }),
    );
    assert.deepEqual(ids(found), [
      "retain_codable_properties",
      "retain_objc_accessible",
      "retain_js_accessible",
      "localized_string_key_literal_match",
    ]);
    assert.equal(found[0].reason, "2 Swift files use Codable or Decodable, whose synthesized coding reads properties that outskirts cannot see.");
    const swiftOnly = recommend(input({ summary: summary({ signals: { encodable: 1, objc: 1, dynamicLocalizedKey: 1 } }) }));
    assert.deepEqual(ids(swiftOnly), ["retain_encodable_properties", "retain_objc_annotated"]);
  });

  it("never recommends an option already set, dismissed or missing from the installed outskirts", () => {
    const signals = { codable: 1, objc: 1, jsExport: 1 };
    const found = recommend(
      input({
        summary: summary({ signals }),
        configured: new Set(["retain_js_accessible"]),
        dismissed: new Set(["retain_objc_annotated"]),
        keys: new Set([...keys].filter((key) => key !== "retain_codable_properties")),
      }),
    );
    assert.deepEqual(ids(found), []);
  });

  it("offers to create the file with the other recommendations when there is none", () => {
    const found = recommend(input({ fileExists: false, summary: summary({ signals: { codable: 1, jsExport: 1 } }) }));
    assert.deepEqual(ids(found), ["create", "retain_codable_properties", "retain_js_accessible"]);
    assert.deepEqual(found[0].changes, { retain_codable_properties: true, retain_js_accessible: true });
    assert.equal(found[0].title, "Create .outskirts.yml");
    assert.deepEqual(ids(recommend(input({ fileExists: false, dismissed: new Set(["create"]) }))), []);
    assert.deepEqual(recommend(input({ fileExists: false }))[0].changes, {});
  });
});
