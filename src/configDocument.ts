import { Document, isMap, isNode, isScalar, Pair, parseDocument, YAMLMap } from "yaml";
import { ConfigOption, OptionValue } from "./configSchema";

const format = { lineWidth: 0, flowCollectionPadding: false } as const;

export const configFileNames = [".outskirts.yml", ".outskirts.yaml", ".periphery.yml", ".periphery.yaml"] as const;

export interface OtherKey {
  key: string;
  text: string;
}

export interface ConfigContents {
  values: Record<string, OptionValue>;
  complex: Record<string, string>;
  other: OtherKey[];
}

export type FormValues = Readonly<Record<string, OptionValue | undefined>>;

export function configFileName(existing: readonly string[]): string {
  return configFileNames.find((name) => existing.includes(name)) ?? configFileNames[0];
}

export function schemaComment(schemaId: string | undefined): string | undefined {
  return schemaId === undefined ? undefined : ` yaml-language-server: $schema=${schemaId}`;
}

export function normalizeValue(option: ConfigOption, raw: unknown): OptionValue | undefined {
  switch (option.kind) {
    case "boolean":
      if (typeof raw === "boolean") {
        return raw;
      }
      return raw === "true" ? true : raw === "false" ? false : undefined;
    case "integer":
      return typeof raw === "number" && Number.isInteger(raw) ? raw : undefined;
    case "string":
      return typeof raw === "string" || typeof raw === "number" ? String(raw) : undefined;
    case "enum":
      return typeof raw === "string" && option.choices?.includes(raw) === true ? raw : undefined;
    case "list":
      if (typeof raw === "string" || typeof raw === "number") {
        return [String(raw)];
      }
      if (Array.isArray(raw) && raw.every((entry) => typeof entry === "string" || typeof entry === "number")) {
        return raw.map(String);
      }
      return undefined;
  }
}

export function sameValue(a: OptionValue | undefined, b: OptionValue | undefined): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((entry, index) => entry === b[index]);
  }
  return a === b;
}

export function isDefault(option: ConfigOption, value: OptionValue | undefined): boolean {
  if (value === undefined || value === "") {
    return true;
  }
  if (option.defaultValue === undefined) {
    return Array.isArray(value) && value.length === 0;
  }
  return sameValue(value, option.defaultValue);
}

function parse(text: string): Document {
  const document = parseDocument(text);
  const error = document.errors.at(0);
  if (error !== undefined) {
    throw new Error(`The configuration file is not valid YAML: ${error.message}`);
  }
  if (document.contents !== null && !isMap(document.contents)) {
    throw new Error("The configuration file is not a mapping of options.");
  }
  return document;
}

export function readConfig(text: string, options: readonly ConfigOption[]): ConfigContents {
  const document = parse(text);
  const byKey = new Map(options.map((option) => [option.key, option]));
  const contents: ConfigContents = { values: {}, complex: {}, other: [] };
  if (!isMap(document.contents)) {
    return contents;
  }
  for (const pair of document.contents.items) {
    const key = keyOf(pair);
    const raw = toJson(pair.value);
    const text = pairText(key, raw);
    const option = byKey.get(key);
    if (option === undefined) {
      contents.other.push({ key, text });
      continue;
    }
    const value = normalizeValue(option, raw);
    if (value === undefined) {
      contents.complex[key] = text;
    } else {
      contents.values[key] = value;
    }
  }
  return contents;
}

function pairText(key: string, raw: unknown): string {
  const document = new Document({ [key]: raw });
  return document.toString(format).trimEnd();
}

export function updateConfig(
  text: string,
  options: readonly ConfigOption[],
  values: FormValues,
  header?: string,
): string {
  const document = parse(text);
  if (!isMap(document.contents)) {
    document.contents = document.createNode({});
    if (text.trim() === "" && header !== undefined) {
      document.commentBefore = header;
    }
  }
  const map = document.contents;
  if (!isMap(map)) {
    throw new Error("The configuration file is not a mapping of options.");
  }
  let changed = false;
  for (const option of options) {
    if (!(option.key in values)) {
      continue;
    }
    const wanted = values[option.key];
    if (isDefault(option, wanted)) {
      if (removePair(map, option.key)) {
        changed = true;
      }
      continue;
    }
    const current = map.has(option.key) ? normalizeValue(option, toJson(map.get(option.key, true))) : undefined;
    if (!sameValue(current, wanted)) {
      map.set(option.key, Array.isArray(wanted) ? document.createNode(wanted) : wanted);
      changed = true;
    }
  }
  if (!changed && text.trim() !== "") {
    return text;
  }
  const output = document.toString(format);
  return map.items.length === 0 ? output.replace(/^\{\}\n?$/m, "").replace(/\n+$/, "\n").replace(/^\n$/, "") : output;
}

function keyOf(pair: Pair): string {
  return isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
}

function removePair(map: YAMLMap, key: string): boolean {
  const index = map.items.findIndex((pair) => keyOf(pair) === key);
  const pair = map.items.at(index);
  if (index === -1 || pair === undefined) {
    return false;
  }
  map.items.splice(index, 1);
  const comment = isNode(pair.key) ? pair.key.commentBefore : undefined;
  if (comment !== undefined && comment !== null) {
    const next = map.items.at(index)?.key;
    if (isNode(next)) {
      const separator = next.spaceBefore === true ? "\n\n" : "\n";
      next.commentBefore = next.commentBefore === undefined || next.commentBefore === null ? comment : `${comment}${separator}${next.commentBefore}`;
      next.spaceBefore = isNode(pair.key) ? pair.key.spaceBefore : undefined;
    } else {
      map.comment = map.comment === undefined || map.comment === null ? comment : `${map.comment}\n${comment}`;
    }
  }
  return true;
}

function toJson(node: unknown): unknown {
  return (node as { toJSON?: () => unknown } | undefined)?.toJSON?.() ?? null;
}
