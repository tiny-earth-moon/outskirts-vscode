import { pendingChanges } from "./configForm";
import type { WireValue } from "./configMessages";
import { ConfigOption, OptionValue } from "./configSchema";

export interface Draft {
  changes: Record<string, WireValue>;
  base: string;
}

export interface RestoredDraft {
  changes: Record<string, WireValue>;
  changedOnDisk: boolean;
}

export function textHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16).padStart(8, "0")}:${String(text.length)}`;
}

export function makeDraft(changes: Record<string, WireValue> | null, baseText: string): Draft | undefined {
  return changes === null || Object.keys(changes).length === 0 ? undefined : { changes, base: textHash(baseText) };
}

function isWireValue(value: unknown): value is WireValue {
  return (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    typeof value === "number" ||
    (Array.isArray(value) && value.every((entry) => typeof entry === "string"))
  );
}

export function restoreDraft(
  draft: unknown,
  text: string,
  options: readonly ConfigOption[],
  saved: Readonly<Record<string, OptionValue>>,
  complex: ReadonlySet<string>,
): RestoredDraft | undefined {
  if (typeof draft !== "object" || draft === null || !("changes" in draft) || !("base" in draft)) {
    return undefined;
  }
  const { changes, base } = draft;
  if (typeof changes !== "object" || changes === null || typeof base !== "string") {
    return undefined;
  }
  const known = new Set(options.map((option) => option.key));
  const form: Record<string, OptionValue | undefined> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (known.has(key) && !complex.has(key) && isWireValue(value)) {
      form[key] = value ?? undefined;
    }
  }
  const kept = pendingChanges(options, form, saved, complex);
  const keys = Object.keys(kept);
  if (keys.length === 0) {
    return undefined;
  }
  const restored: Record<string, WireValue> = {};
  for (const key of keys) {
    restored[key] = kept[key] ?? null;
  }
  return { changes: restored, changedOnDisk: textHash(text) !== base };
}

export function draftBannerText(draft: RestoredDraft, fileName: string): string {
  const count = Object.keys(draft.changes).length;
  const restored = `Unsaved changes restored (${String(count)} option${count === 1 ? "" : "s"}).`;
  return draft.changedOnDisk ? `${restored} ${fileName} changed on disk since they were made: check them before saving.` : restored;
}
