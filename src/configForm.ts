import { ConfigOption, FormValues, isDefault, OptionValue, sameValue, sections } from "./configSchema";

export interface SectionView {
  name: string;
  options: readonly ConfigOption[];
}

export interface FormFilter {
  query: string;
  modifiedOnly: boolean;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s_\-.]+/)
    .filter((word) => word !== "");
}

export function matchesQuery(option: ConfigOption, query: string): boolean {
  const wanted = words(query);
  if (wanted.length === 0) {
    return true;
  }
  const haystack = `${option.key.replace(/_/g, " ")} ${option.key} ${option.description}`.toLowerCase();
  return wanted.every((word) => haystack.includes(word));
}

export function effectiveValue(option: ConfigOption, values: FormValues): OptionValue | undefined {
  return option.key in values ? values[option.key] : option.defaultValue;
}

export function isModified(option: ConfigOption, values: FormValues): boolean {
  return option.key in values && !isDefault(option, values[option.key]);
}

export function visibleSections(
  options: readonly ConfigOption[],
  values: FormValues,
  filter: FormFilter,
  hidden: ReadonlySet<string> = new Set(),
): SectionView[] {
  const shown = options.filter(
    (option) =>
      !hidden.has(option.key) && matchesQuery(option, filter.query) && (!filter.modifiedOnly || isModified(option, values)),
  );
  const names = [...sections, ...new Set(shown.map((option) => option.section).filter((name) => !(sections as readonly string[]).includes(name)))];
  return names
    .map((name) => ({ name, options: shown.filter((option) => option.section === name) }))
    .filter((section) => section.options.length > 0);
}

export function pendingChanges(
  options: readonly ConfigOption[],
  form: FormValues,
  saved: FormValues,
  complex: ReadonlySet<string> = new Set(),
): Record<string, OptionValue | undefined> {
  const changes: Record<string, OptionValue | undefined> = {};
  for (const option of options) {
    if (complex.has(option.key) || !(option.key in form)) {
      continue;
    }
    const wanted = form[option.key];
    const current = effectiveValue(option, saved);
    const unchanged = sameValue(wanted, current) || (isDefault(option, wanted) && !(option.key in saved));
    if (!unchanged) {
      changes[option.key] = wanted;
    }
  }
  return changes;
}

export type IntegerInput = { value: number | undefined } | { error: string };

export function parseInteger(text: string): IntegerInput {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { value: undefined };
  }
  if (!/^-?\d+$/.test(trimmed)) {
    return { error: "Enter a whole number." };
  }
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? { value } : { error: "This number is too large." };
}

export function addListItems(list: readonly string[], text: string): string[] {
  const added = text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  return [...list, ...added.filter((entry, index) => !list.includes(entry) && added.indexOf(entry) === index)];
}

export function describeValue(value: OptionValue | undefined): string {
  if (value === undefined || value === "") {
    return "not set";
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "empty" : value.join(", ");
  }
  return String(value);
}
