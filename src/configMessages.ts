import type { OtherKey } from "./configDocument";
import type { RestoredDraft } from "./configDraft";
import type { Recommendation } from "./configRecommendations";
import type { ConfigOption, OptionValue } from "./configSchema";

export interface CheckResult {
  state: "valid" | "problems" | "unavailable";
  messages: string[];
}

export interface EditorState {
  project: string;
  file: string;
  fileExists: boolean;
  version: string | undefined;
  options: ConfigOption[];
  saved: Record<string, OptionValue>;
  complex: Record<string, string>;
  other: OtherKey[];
  error: string | undefined;
  draft?: RestoredDraft;
}

export type StateReason = "open" | "saved" | "external" | "reload";

export type HostMessage =
  | { type: "state"; state: EditorState; reason: StateReason }
  | { type: "failed"; message: string }
  | { type: "recommendations"; recommendations: Recommendation[]; scanning: boolean }
  | { type: "checking" }
  | { type: "check"; result: CheckResult }
  | { type: "saveFailed"; message: string };

export type WireValue = OptionValue | null;

export type ViewMessage =
  | { type: "ready" }
  | { type: "save"; changes: Record<string, WireValue> }
  | { type: "openYaml" }
  | { type: "dismiss"; id: string }
  | { type: "reload" }
  | { type: "draft"; changes: Record<string, WireValue> | null };
