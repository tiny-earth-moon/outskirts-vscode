import { OptionValue } from "./configSchema";

export type Signal = "codable" | "encodable" | "objc" | "jsExport" | "tests" | "dynamicLocalizedKey";

export interface ProjectSummary {
  files: readonly string[];
  truncated: boolean;
  signals: Readonly<Partial<Record<Signal, number>>>;
  manifest: string | undefined;
}

export interface Recommendation {
  id: string;
  title: string;
  reason: string;
  changes: Readonly<Record<string, OptionValue>>;
}

export interface RecommendationInput {
  summary: ProjectSummary;
  keys: ReadonlySet<string>;
  configured: ReadonlySet<string>;
  fileExists: boolean;
  fileName: string;
  dismissed: ReadonlySet<string>;
}

const signalPatterns: readonly (readonly [Signal, RegExp])[] = [
  ["codable", /\b(?:Codable|Decodable)\b/],
  ["encodable", /\bEncodable\b/],
  ["objc", /@objc(?:Members)?\b/],
  ["jsExport", /\bJSExport\b/],
  ["tests", /^[ \t]*(?:@testable[ \t]+)?import[ \t]+(?:XCTest|Testing)\b/m],
  ["dynamicLocalizedKey", /(?:\bNSLocalizedString\(|\bString\(localized:|\bLocalizedStringKey\(|\bLocalizedStringResource\()[ \t]*(?![ \t"])/],
];

export function sourceSignals(text: string): Signal[] {
  return signalPatterns.filter(([, pattern]) => pattern.test(text)).map(([signal]) => signal);
}

function extension(file: string): string {
  const name = file.slice(file.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot).toLowerCase();
}

function count(summary: ProjectSummary, signal: Signal): number {
  return summary.signals[signal] ?? 0;
}

function plural(amount: number, noun: string): string {
  return `${String(amount)} ${noun}${amount === 1 ? "" : "s"}`;
}

function uses(amount: number): string {
  return amount === 1 ? "uses" : "use";
}

function sample(names: readonly string[], limit = 3): string {
  const shown = names.slice(0, limit).join(", ");
  return names.length > limit ? `${shown}, …` : shown;
}

export function libraryProducts(manifest: string): string[] {
  const names = [...manifest.matchAll(/\.library\(\s*name:\s*"([^"]+)"/g)].map((match) => match[1]);
  return [...new Set(names)];
}

function hasExecutableProduct(manifest: string): boolean {
  return /\.executable\(\s*name:/.test(manifest);
}

function rootBundles(files: readonly string[], suffix: string): string[] {
  const names = new Set<string>();
  for (const file of files) {
    const first = file.split("/")[0];
    if (first.endsWith(suffix) && file.includes("/")) {
      names.add(first);
    }
  }
  return [...names].sort();
}

export function sharedSchemes(files: readonly string[]): string[] {
  const names = files
    .filter((file) => /^[^/]+\.(?:xcodeproj|xcworkspace)\/xcshareddata\/xcschemes\/[^/]+\.xcscheme$/.test(file))
    .map((file) => file.slice(file.lastIndexOf("/") + 1, -".xcscheme".length));
  return [...new Set(names)].sort();
}

function isTestScheme(name: string): boolean {
  return /Tests$/.test(name);
}

type Rule = (summary: ProjectSummary) => Recommendation | undefined;

const rules: readonly Rule[] = [
  (summary): Recommendation | undefined => {
    if (summary.files.includes("Package.swift")) {
      return undefined;
    }
    const workspaces = rootBundles(summary.files, ".xcworkspace");
    const candidates = workspaces.length > 0 ? workspaces : rootBundles(summary.files, ".xcodeproj");
    if (candidates.length !== 1) {
      return undefined;
    }
    return {
      id: "project",
      title: `Set project to ${candidates[0]}`,
      reason: "Lets outskirts scan, from a terminal or in CI, find the Xcode project without --project.",
      changes: { project: candidates[0] },
    };
  },
  (summary): Recommendation | undefined => {
    if (summary.files.includes("Package.swift")) {
      return undefined;
    }
    const projects = [...rootBundles(summary.files, ".xcworkspace"), ...rootBundles(summary.files, ".xcodeproj")];
    if (projects.length === 0) {
      return undefined;
    }
    const shared = sharedSchemes(summary.files).filter((name) => !isTestScheme(name));
    if (shared.length > 0) {
      return {
        id: "schemes",
        title: `Build the scheme${shared.length === 1 ? "" : "s"} ${sample(shared)}`,
        reason: `An Xcode project is scanned through its schemes; shared ${shared.length === 1 ? "scheme" : "schemes"} found: ${sample(shared)}.`,
        changes: { schemes: shared },
      };
    }
    const guess = projects.find((name) => name.endsWith(".xcodeproj"))?.replace(/\.xcodeproj$/, "");
    if (guess === undefined) {
      return undefined;
    }
    return {
      id: "schemes",
      title: `Build the scheme ${guess}`,
      reason: `An Xcode project is scanned through its schemes; no shared scheme was found, and Xcode names the default one ${guess}.`,
      changes: { schemes: [guess] },
    };
  },
  (summary): Recommendation | undefined => {
    const manifest = summary.manifest;
    if (manifest === undefined || rootBundles(summary.files, ".xcodeproj").length > 0) {
      return undefined;
    }
    const libraries = libraryProducts(manifest);
    if (libraries.length === 0) {
      return undefined;
    }
    if (hasExecutableProduct(manifest)) {
      return {
        id: "retain_public_modules",
        title: `Keep the public API of ${sample(libraries)}`,
        reason: "Package.swift declares library and executable products: the public API of the libraries is used by clients outside the scan.",
        changes: { retain_public_modules: libraries },
      };
    }
    return {
      id: "retain_public",
      title: "Keep the public API",
      reason: `Package.swift declares library products (${sample(libraries)}): their public declarations are used by clients outside the scan.`,
      changes: { retain_public: true },
    };
  },
  (summary): Recommendation | undefined => {
    const codable = count(summary, "codable");
    if (codable > 0) {
      return {
        id: "retain_codable_properties",
        title: "Keep the properties of Codable types",
        reason: `${plural(codable, "Swift file")} ${uses(codable)} Codable or Decodable, whose synthesized coding reads properties that outskirts cannot see.`,
        changes: { retain_codable_properties: true },
      };
    }
    const encodable = count(summary, "encodable");
    if (encodable === 0) {
      return undefined;
    }
    return {
      id: "retain_encodable_properties",
      title: "Keep the properties of Encodable types",
      reason: `${plural(encodable, "Swift file")} ${uses(encodable)} Encodable, whose synthesized encoding reads properties that outskirts cannot see.`,
      changes: { retain_encodable_properties: true },
    };
  },
  (summary): Recommendation | undefined => {
    const sources = summary.files.filter((file) => [".m", ".mm"].includes(extension(file))).length;
    if (sources > 0) {
      return {
        id: "retain_objc_accessible",
        title: "Keep the declarations Objective-C can reach",
        reason: `${plural(sources, "Objective-C source")} found: outskirts cannot see the Swift declarations they use.`,
        changes: { retain_objc_accessible: true },
      };
    }
    const annotated = count(summary, "objc");
    if (annotated === 0) {
      return undefined;
    }
    return {
      id: "retain_objc_annotated",
      title: "Keep the @objc declarations",
      reason: `${plural(annotated, "Swift file")} ${uses(annotated)} @objc, whose declarations the Objective-C runtime may call through selectors.`,
      changes: { retain_objc_annotated: true },
    };
  },
  (summary): Recommendation | undefined => {
    const exported = count(summary, "jsExport");
    if (exported === 0) {
      return undefined;
    }
    return {
      id: "retain_js_accessible",
      title: "Keep the JavaScript-exported protocols",
      reason: `${plural(exported, "Swift file")} ${uses(exported)} JSExport: JavaScript calls their members.`,
      changes: { retain_js_accessible: true },
    };
  },
  (summary): Recommendation | undefined => {
    const catalogs = summary.files.filter((file) => extension(file) === ".xcstrings").length;
    const dynamic = count(summary, "dynamicLocalizedKey");
    if (catalogs === 0 || dynamic === 0) {
      return undefined;
    }
    return {
      id: "localized_string_key_literal_match",
      title: "Keep String Catalog keys used through variables",
      reason: `${plural(catalogs, "String Catalog")} and ${plural(dynamic, "Swift file")} that localize a non-literal key: keys equal to a string literal are then kept.`,
      changes: { localized_string_key_literal_match: true },
    };
  },
  (summary): Recommendation | undefined => {
    const tests = count(summary, "tests");
    if (tests === 0) {
      return undefined;
    }
    return {
      id: "exclude_tests",
      title: "Leave the test targets out",
      reason: `${plural(tests, "test file")} found: without the tests, the scan builds less and reports code only the tests use.`,
      changes: { exclude_tests: true },
    };
  },
];

export function recommend(input: RecommendationInput): Recommendation[] {
  const found = rules
    .map((rule) => rule(input.summary))
    .filter((recommendation): recommendation is Recommendation => recommendation !== undefined)
    .filter((recommendation) =>
      Object.keys(recommendation.changes).every((key) => input.keys.has(key) && !input.configured.has(key)),
    )
    .filter((recommendation) => !input.dismissed.has(recommendation.id));
  if (input.fileExists || input.dismissed.has("create")) {
    return found;
  }
  const changes = Object.assign({}, ...found.map((recommendation) => recommendation.changes)) as Record<string, OptionValue>;
  const create: Recommendation = {
    id: "create",
    title: `Create ${input.fileName}`,
    reason:
      found.length === 0
        ? "A configuration file lets outskirts scan run the same scan in a terminal, in Xcode and in CI."
        : "A configuration file lets outskirts scan run the same scan everywhere; it starts with the recommendations below.",
    changes,
  };
  return [create, ...found];
}
