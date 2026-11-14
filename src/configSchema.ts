export type OptionKind = "boolean" | "string" | "integer" | "list" | "enum";

export type OptionValue = boolean | string | number | readonly string[];

export interface ConfigOption {
  key: string;
  section: string;
  description: string;
  kind: OptionKind;
  defaultValue: OptionValue | undefined;
  choices?: readonly string[];
  acceptsList?: boolean;
}

export interface ConfigSchema {
  id: string | undefined;
  options: readonly ConfigOption[];
}

export const sections = [
  "Project & build",
  "Targets & files",
  "Retention",
  "Analysis",
  "String Catalogs",
  "Reporting & output",
  "Advanced",
] as const;

const sectionKeys: Readonly<Record<string, readonly string[]>> = {
  "Project & build": [
    "project",
    "schemes",
    "build_arguments",
    "xcode_list_arguments",
    "skip_build",
    "skip_schemes_validation",
    "clean_build",
    "index_store_path",
    "derived_data_path",
    "strict_index",
    "strict_index_coverage",
    "index_built_from",
    "cache_max_age_days",
    "cache_max_size_gb",
    "json_package_manifest_path",
    "generic_project_config",
  ],
  "Targets & files": [
    "exclude_targets",
    "exclude_tests",
    "index_exclude",
    "report_exclude",
    "report_include",
    "retain_files",
    "external_test_case_classes",
    "changed_since",
    "changed_lines",
  ],
  "String Catalogs": ["disable_unused_localized_string_analysis", "retain_runtime_localized_keys"],
  "Reporting & output": [
    "format",
    "color",
    "quiet",
    "verbose",
    "strict",
    "relative_results",
    "relative_results_base",
    "baseline",
    "write_baseline",
    "prune_baseline",
    "strict_baseline",
    "write_results",
    "skip_stdout_results",
  ],
  Retention: ["no_retain_spi", "external_encodable_protocols", "external_codable_protocols", "disable_platform_conditional_retention"],
  Advanced: ["disable_update_check"],
};

const sectionPrefixes: readonly (readonly [string, string])[] = [
  ["localized_string_", "String Catalogs"],
  ["retain_", "Retention"],
  ["enable_", "Analysis"],
  ["disable_", "Analysis"],
  ["detect_", "Analysis"],
  ["report_", "Analysis"],
  ["superfluous_", "Analysis"],
];

export function sectionOf(key: string): string {
  for (const [section, keys] of Object.entries(sectionKeys)) {
    if (keys.includes(key)) {
      return section;
    }
  }
  return sectionPrefixes.find(([prefix]) => key.startsWith(prefix))?.[1] ?? "Advanced";
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function types(property: Json): string[] {
  const type = property.type;
  if (typeof type === "string") {
    return [type];
  }
  return Array.isArray(type) ? type.filter((entry): entry is string => typeof entry === "string") : [];
}

function hasArrayAlternative(property: Json): boolean {
  const alternatives = property.oneOf ?? property.anyOf;
  return Array.isArray(alternatives) && alternatives.some((alternative) => isObject(alternative) && types(alternative).includes("array"));
}

function kindOf(property: Json): OptionKind | undefined {
  const declared = types(property);
  if (Array.isArray(property.enum) && property.enum.every((choice) => typeof choice === "string")) {
    return "enum";
  }
  if (declared.includes("boolean")) {
    return "boolean";
  }
  if (declared.includes("array") || hasArrayAlternative(property)) {
    return "list";
  }
  if (declared.includes("integer") || declared.includes("number")) {
    return "integer";
  }
  if (declared.includes("string")) {
    return "string";
  }
  return undefined;
}

function defaultOf(kind: OptionKind, value: unknown): OptionValue | undefined {
  switch (kind) {
    case "boolean":
      return typeof value === "boolean" ? value : false;
    case "integer":
      return typeof value === "number" && Number.isInteger(value) ? value : undefined;
    case "list":
      return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
    case "string":
    case "enum":
      return typeof value === "string" ? value : undefined;
  }
}

export function parseSchema(text: string): ConfigSchema {
  const parsed: unknown = JSON.parse(text);
  if (!isObject(parsed) || !isObject(parsed.properties)) {
    throw new Error("The configuration schema has no properties.");
  }
  const options: ConfigOption[] = [];
  for (const [key, property] of Object.entries(parsed.properties)) {
    if (!isObject(property)) {
      continue;
    }
    const kind = kindOf(property);
    if (kind === undefined) {
      continue;
    }
    const option: ConfigOption = {
      key,
      section: sectionOf(key),
      description: typeof property.description === "string" ? property.description : "",
      kind,
      defaultValue: defaultOf(kind, property.default),
    };
    if (kind === "enum") {
      option.choices = (property.enum as string[]).slice();
    }
    if (kind === "boolean" && types(property).includes("array")) {
      option.acceptsList = true;
    }
    options.push(option);
  }
  return { id: typeof parsed.$id === "string" ? parsed.$id : undefined, options };
}
