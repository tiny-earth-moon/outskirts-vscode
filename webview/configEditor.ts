import {
  addListItems,
  describeValue,
  effectiveValue,
  isModified,
  parseInteger,
  pendingChanges,
  visibleSections,
} from "../src/configForm";
import type { CheckResult, EditorState, HostMessage, ViewMessage, WireValue } from "../src/configMessages";
import type { Recommendation } from "../src/configRecommendations";
import type { ConfigOption, OptionValue } from "../src/configSchema";

interface VsCodeApi {
  postMessage: (message: ViewMessage) => void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();
const app = document.getElementById("app") as HTMLElement;

type Banner = { kind: "error" | "warning" | "info"; text: string; actions?: { label: string; run: () => void; primary?: boolean }[] };
type Check = { kind: "none" } | { kind: "checking" } | { kind: "done"; result: CheckResult };

let state: EditorState | undefined;
let form: Record<string, OptionValue | undefined> = {};
let recommendations: Recommendation[] = [];
let scanning = false;
const applied = new Set<string>();
const invalid = new Map<string, string>();
let check: Check = { kind: "none" };
let banner: Banner | undefined;
let filter = { query: "", modifiedOnly: false };
let saving = false;
let lastDirty = false;
let failure: string | undefined;

const parts: {
  status?: HTMLElement;
  save?: HTMLButtonElement;
  openYaml?: HTMLButtonElement;
  subtitle?: HTMLElement;
  banner?: HTMLElement;
  check?: HTMLElement;
  recommendations?: HTMLElement;
  sections?: HTMLElement;
  count?: HTMLElement;
  other?: HTMLElement;
  fieldset?: HTMLFieldSetElement;
} = {};

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | boolean | undefined> = {},
  ...children: (Node | string | undefined)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === true) {
      element.setAttribute(name, "");
    } else if (typeof value === "string") {
      element.setAttribute(name, value);
    }
  }
  for (const child of children) {
    if (child !== undefined) {
      element.append(child);
    }
  }
  return element;
}

function button(label: string, run: () => void, attributes: Record<string, string | boolean | undefined> = {}): HTMLButtonElement {
  const element = h("button", { type: "button", ...attributes }, label);
  element.addEventListener("click", run);
  return element;
}

function options(): readonly ConfigOption[] {
  return state?.options ?? [];
}

function complexKeys(): Set<string> {
  return new Set(Object.keys(state?.complex ?? {}));
}

function changes(): Record<string, OptionValue | undefined> {
  return state === undefined ? {} : pendingChanges(options(), form, state.saved, complexKeys());
}

function dirty(): boolean {
  return Object.keys(changes()).length > 0 || invalid.size > 0;
}

function canSave(): boolean {
  return state !== undefined && state.error === undefined && !saving && invalid.size === 0 && (dirty() || !state.fileExists);
}

function updateStatus(): void {
  const count = Object.keys(changes()).length;
  const isDirty = dirty();
  if (parts.status !== undefined) {
    parts.status.textContent = saving
      ? "Saving…"
      : invalid.size > 0
        ? `${String(invalid.size)} invalid value${invalid.size === 1 ? "" : "s"}`
        : count > 0
          ? `${String(count)} unsaved change${count === 1 ? "" : "s"}`
          : state?.fileExists === false
            ? "Not created yet"
            : "Saved";
    parts.status.className = `status${isDirty ? " dirty" : ""}`;
  }
  if (parts.save !== undefined) {
    parts.save.disabled = !canSave();
    parts.save.textContent = state?.fileExists === false ? `Create ${state.file}` : "Save";
  }
  if (parts.openYaml !== undefined) {
    parts.openYaml.disabled = state?.fileExists !== true;
  }
  if (isDirty !== lastDirty) {
    lastDirty = isDirty;
    vscode.postMessage({ type: "dirty", dirty: isDirty });
  }
}

function save(): void {
  if (!canSave()) {
    const first = invalid.keys().next();
    if (first.done !== true) {
      document.querySelector<HTMLElement>(`[data-key="${CSS.escape(first.value)}"] input`)?.focus();
    }
    return;
  }
  const wire: Record<string, WireValue> = {};
  for (const [key, value] of Object.entries(changes())) {
    wire[key] = value ?? null;
  }
  saving = true;
  banner = undefined;
  renderBanner();
  updateStatus();
  vscode.postMessage({ type: "save", changes: wire });
}

function setValue(option: ConfigOption, value: OptionValue | undefined): void {
  form[option.key] = value;
  updateRow(option);
  updateStatus();
}

function updateRow(option: ConfigOption): void {
  const row = document.querySelector<HTMLElement>(`.row[data-key="${CSS.escape(option.key)}"]`);
  if (row === null) {
    return;
  }
  const modified = isModified(option, form);
  const unsaved = option.key in changes();
  row.classList.toggle("modified", modified);
  row.classList.toggle("unsaved", unsaved);
  const reset = row.querySelector<HTMLButtonElement>(".reset");
  if (reset !== null) {
    reset.hidden = !modified;
  }
  const error = row.querySelector<HTMLElement>(".error");
  if (error !== null) {
    error.textContent = invalid.get(option.key) ?? "";
  }
}

function toggleControl(option: ConfigOption): HTMLElement {
  const input = h("input", { type: "checkbox", role: "switch", "aria-label": option.key });
  input.checked = effectiveValue(option, form) === true;
  input.addEventListener("change", () => {
    setValue(option, input.checked);
  });
  return h("label", { class: "switch" }, input, h("span", { class: "slider", "aria-hidden": "true" }));
}

function selectControl(option: ConfigOption): HTMLElement {
  const select = h("select", { "aria-label": option.key });
  const current = effectiveValue(option, form);
  if (option.defaultValue === undefined) {
    select.append(h("option", { value: "" }, "not set"));
  }
  for (const choice of option.choices ?? []) {
    select.append(h("option", { value: choice }, choice === option.defaultValue ? `${choice} (default)` : choice));
  }
  select.value = typeof current === "string" ? current : "";
  select.addEventListener("change", () => {
    setValue(option, select.value === "" ? undefined : select.value);
  });
  return select;
}

function textControl(option: ConfigOption): HTMLElement {
  const current = effectiveValue(option, form);
  const input = h("input", {
    type: "text",
    spellcheck: "false",
    "aria-label": option.key,
    placeholder: option.defaultValue === undefined ? "not set" : String(option.defaultValue),
    inputmode: option.kind === "integer" ? "numeric" : undefined,
  });
  input.value = current === undefined || (option.kind === "integer" && current === option.defaultValue && !(option.key in form)) ? "" : String(current);
  input.addEventListener("input", () => {
    if (option.kind !== "integer") {
      setValue(option, input.value === "" ? undefined : input.value);
      return;
    }
    const parsed = parseInteger(input.value);
    if ("error" in parsed) {
      invalid.set(option.key, parsed.error);
      input.setAttribute("aria-invalid", "true");
      updateRow(option);
      updateStatus();
      return;
    }
    invalid.delete(option.key);
    input.removeAttribute("aria-invalid");
    setValue(option, parsed.value);
  });
  return input;
}

function listControl(option: ConfigOption): HTMLElement {
  const container = h("div", { class: "tags" });
  const entries = (): string[] => {
    const value = effectiveValue(option, form);
    return typeof value === "object" ? [...value] : [];
  };
  const input = h("input", { type: "text", class: "add", spellcheck: "false", placeholder: "Add…", "aria-label": `Add to ${option.key}` });
  const render = (): void => {
    container.replaceChildren(
      ...entries().map((entry, index) => {
        const remove = button("×", () => {
          const next = entries();
          next.splice(index, 1);
          setValue(option, next);
          render();
          input.focus();
        }, { class: "remove", "aria-label": `Remove ${entry}`, title: `Remove ${entry}` });
        return h("span", { class: "tag" }, h("span", { class: "tag-text" }, entry), remove);
      }),
      input,
    );
  };
  const add = (text: string): void => {
    const next = addListItems(entries(), text);
    if (next.length !== entries().length) {
      setValue(option, next);
    }
    input.value = "";
    render();
    input.focus();
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      add(input.value);
    } else if (event.key === "Backspace" && input.value === "" && entries().length > 0) {
      setValue(option, entries().slice(0, -1));
      render();
      input.focus();
    }
  });
  input.addEventListener("paste", (event) => {
    const text = event.clipboardData?.getData("text") ?? "";
    if (text.includes("\n")) {
      event.preventDefault();
      add(text);
    }
  });
  input.addEventListener("blur", () => {
    if (input.value.trim() !== "") {
      add(input.value);
    }
  });
  container.addEventListener("click", (event) => {
    if (event.target === container) {
      input.focus();
    }
  });
  render();
  return container;
}

function control(option: ConfigOption): HTMLElement {
  switch (option.kind) {
    case "boolean":
      return toggleControl(option);
    case "enum":
      return selectControl(option);
    case "list":
      return listControl(option);
    case "string":
    case "integer":
      return textControl(option);
  }
}

function row(option: ConfigOption): HTMLElement {
  const complex = state?.complex[option.key];
  const head = h("div", { class: "head" }, h("code", { class: "key" }, option.key), h("span", { class: "unsaved-mark", title: "Not saved yet" }, "unsaved"));
  const meta = h(
    "div",
    { class: "meta" },
    head,
    h("p", { class: "description" }, option.description),
    h("p", { class: "default" }, "Default: ", h("code", {}, describeValue(option.defaultValue))),
    h("p", { class: "error", role: "alert" }),
  );
  let editor: HTMLElement;
  if (complex === undefined) {
    const reset = button("Reset", () => {
      invalid.delete(option.key);
      form[option.key] = option.defaultValue;
      const fresh = row(option);
      element.replaceWith(fresh);
      updateRow(option);
      updateStatus();
    }, { class: "reset secondary", title: "Reset to default" });
    editor = h("div", { class: "control" }, control(option), reset);
  } else {
    editor = h(
      "div",
      { class: "control complex" },
      h("pre", {}, complex),
      h("p", { class: "note" }, "This value can only be edited in the YAML file."),
      button("Open as YAML", openYaml, { class: "secondary" }),
    );
  }
  const element = h("div", { class: "row", "data-key": option.key, id: `option-${option.key}` }, meta, editor);
  return element;
}

function openYaml(): void {
  vscode.postMessage({ type: "openYaml" });
}

function renderSections(): void {
  if (parts.sections === undefined || state === undefined) {
    return;
  }
  const shown = visibleSections(options(), form, filter);
  const total = shown.reduce((sum, section) => sum + section.options.length, 0);
  if (parts.count !== undefined) {
    parts.count.textContent = `${String(total)} of ${String(options().length)} options`;
  }
  if (shown.length === 0) {
    parts.sections.replaceChildren(h("p", { class: "empty" }, "No option matches the search."));
    return;
  }
  parts.sections.replaceChildren(
    ...shown.map((section) =>
      h(
        "section",
        { class: "group", "aria-label": section.name },
        h("h2", {}, section.name, h("span", { class: "group-count" }, String(section.options.length))),
        ...section.options.map(row),
      ),
    ),
  );
  for (const option of options()) {
    updateRow(option);
  }
}

function renderOther(): void {
  if (parts.other === undefined || state === undefined) {
    return;
  }
  if (state.other.length === 0) {
    parts.other.replaceChildren();
    return;
  }
  parts.other.replaceChildren(
    h("h2", {}, "Other keys", h("span", { class: "group-count" }, String(state.other.length))),
    h("p", { class: "note" }, `Keys that are not options of this outskirts${state.version === undefined ? "" : ` ${state.version}`}. They are kept as they are.`),
    ...state.other.map((entry) => h("pre", { class: "other-key" }, entry.text)),
  );
}

function renderBanner(): void {
  if (parts.banner === undefined) {
    return;
  }
  const shown: Banner | undefined =
    state?.error !== undefined ? { kind: "error", text: state.error, actions: [{ label: "Open as YAML", run: openYaml, primary: true }] } : banner;
  if (shown === undefined) {
    parts.banner.replaceChildren();
    return;
  }
  parts.banner.replaceChildren(
    h(
      "div",
      { class: `banner ${shown.kind}`, role: shown.kind === "error" ? "alert" : "status" },
      h("span", { class: "banner-text" }, shown.text),
      h("span", { class: "banner-actions" }, ...(shown.actions ?? []).map((action) => button(action.label, action.run, { class: action.primary === true ? "" : "secondary" }))),
    ),
  );
}

function renderCheck(): void {
  if (parts.check === undefined) {
    return;
  }
  if (check.kind === "none" || state?.fileExists !== true) {
    parts.check.replaceChildren();
    return;
  }
  if (check.kind === "checking") {
    parts.check.replaceChildren(h("div", { class: "check checking" }, "Checking the configuration…"));
    return;
  }
  const { result } = check;
  const title =
    result.state === "valid" ? "Configuration is valid" : result.state === "problems" ? "outskirts config check found problems" : "The configuration could not be checked";
  parts.check.replaceChildren(
    h(
      "div",
      { class: `check ${result.state}`, role: result.state === "valid" ? "status" : "alert" },
      h("strong", {}, title),
      result.messages.length === 0 ? undefined : h("ul", {}, ...result.messages.map((line) => h("li", {}, line))),
    ),
  );
}

function applyRecommendation(recommendation: Recommendation): void {
  for (const [key, value] of Object.entries(recommendation.changes)) {
    form[key] = value;
  }
  applied.add(recommendation.id);
  if (recommendation.id === "create") {
    for (const other of recommendations) {
      if (Object.keys(other.changes).every((key) => key in recommendation.changes)) {
        applied.add(other.id);
      }
    }
  }
  renderRecommendations();
  renderSections();
  updateStatus();
}

function renderRecommendations(): void {
  if (parts.recommendations === undefined) {
    return;
  }
  if (recommendations.length === 0) {
    parts.recommendations.replaceChildren(scanning ? h("p", { class: "note scanning" }, "Looking at the project for recommendations…") : "");
    return;
  }
  parts.recommendations.replaceChildren(
    h("h2", {}, "Recommendations", h("span", { class: "group-count" }, String(recommendations.length))),
    h(
      "ul",
      { class: "cards" },
      ...recommendations.map((recommendation) => {
        const done = applied.has(recommendation.id);
        const keys = Object.keys(recommendation.changes);
        return h(
          "li",
          { class: `card${done ? " applied" : ""}` },
          h(
            "div",
            { class: "card-text" },
            h("strong", {}, recommendation.title),
            h("p", {}, recommendation.reason),
            keys.length === 0 ? undefined : h("p", { class: "card-keys" }, ...keys.map((key) => h("code", {}, key))),
          ),
          done
            ? h("span", { class: "card-done" }, "Applied · save to keep")
            : h(
                "span",
                { class: "card-actions" },
                button("Apply", () => { applyRecommendation(recommendation); }),
                button("Dismiss", () => { vscode.postMessage({ type: "dismiss", id: recommendation.id }); }, { class: "secondary" }),
              ),
        );
      }),
    ),
  );
}

function renderPage(): void {
  if (state === undefined) {
    app.replaceChildren(h("p", { class: "loading" }, failure ?? "Loading the configuration…"));
    return;
  }
  parts.subtitle = h("span", { class: "subtitle" });
  parts.status = h("span", { class: "status", "aria-live": "polite" });
  parts.openYaml = button("Open as YAML", openYaml, { class: "secondary" });
  parts.save = button("Save", save, { title: "Save (⌘S / Ctrl+S)" });
  parts.banner = h("div", { class: "banners" });
  parts.check = h("div", { class: "checks" });
  parts.recommendations = h("section", { class: "recommendations", "aria-label": "Recommendations" });
  parts.sections = h("div", { class: "groups" });
  parts.other = h("section", { class: "group other" });
  parts.count = h("span", { class: "count" });
  const search = h("input", { type: "search", class: "search", placeholder: "Search options by key or description", "aria-label": "Search options" });
  search.value = filter.query;
  search.addEventListener("input", () => {
    filter = { ...filter, query: search.value };
    renderSections();
  });
  const modifiedOnly = h("input", { type: "checkbox" });
  modifiedOnly.checked = filter.modifiedOnly;
  modifiedOnly.addEventListener("change", () => {
    filter = { ...filter, modifiedOnly: modifiedOnly.checked };
    renderSections();
  });
  parts.fieldset = h("fieldset", {}, parts.sections, parts.other);
  app.replaceChildren(
    h(
      "header",
      { class: "top" },
      h("div", { class: "title" }, h("h1", {}, "outskirts configuration"), parts.subtitle),
      h("div", { class: "actions" }, parts.status, parts.openYaml, parts.save),
    ),
    parts.banner,
    parts.check,
    parts.recommendations,
    h("div", { class: "toolbar" }, search, h("label", { class: "filter" }, modifiedOnly, " Modified only"), parts.count),
    parts.fieldset,
  );
  refresh();
}

function refresh(): void {
  if (state === undefined) {
    return;
  }
  if (parts.subtitle !== undefined) {
    const details = [state.project, state.fileExists ? state.file : `${state.file} (not created yet)`];
    if (state.version !== undefined) {
      details.push(`outskirts ${state.version}`);
    }
    parts.subtitle.textContent = details.join(" · ");
  }
  if (parts.fieldset !== undefined) {
    parts.fieldset.disabled = state.error !== undefined;
  }
  renderBanner();
  renderCheck();
  renderRecommendations();
  renderSections();
  renderOther();
  updateStatus();
}

function adopt(next: EditorState, keepEdits: boolean): void {
  const first = state === undefined;
  const kept = keepEdits ? form : undefined;
  state = next;
  form = kept ?? { ...next.saved };
  if (!keepEdits) {
    invalid.clear();
  }
  if (first || parts.sections === undefined) {
    renderPage();
  } else {
    refresh();
  }
}

function receive(message: HostMessage): void {
  switch (message.type) {
    case "state": {
      failure = undefined;
      saving = false;
      if (message.reason === "external" && dirty() && state !== undefined) {
        const next = message.state;
        banner = {
          kind: "warning",
          text: `${next.file} changed on disk while the form has unsaved changes.`,
          actions: [
            { label: "Reload", primary: true, run: () => { banner = undefined; applied.clear(); adopt(next, false); } },
            { label: "Keep my changes", run: () => { banner = undefined; adopt(next, true); } },
          ],
        };
        renderBanner();
        return;
      }
      banner =
        message.reason === "external"
          ? { kind: "info", text: `${message.state.file} changed on disk and was reloaded.` }
          : message.reason === "saved"
            ? { kind: "info", text: `Saved ${message.state.file}.` }
            : undefined;
      applied.clear();
      check = { kind: "none" };
      adopt(message.state, false);
      return;
    }
    case "failed":
      failure = message.message;
      saving = false;
      if (state === undefined) {
        renderPage();
      } else {
        banner = { kind: "error", text: message.message };
        renderBanner();
        updateStatus();
      }
      return;
    case "recommendations":
      recommendations = message.recommendations;
      scanning = message.scanning;
      renderRecommendations();
      return;
    case "checking":
      check = { kind: "checking" };
      renderCheck();
      return;
    case "check":
      check = { kind: "done", result: message.result };
      renderCheck();
      return;
    case "saveFailed":
      saving = false;
      banner = { kind: "error", text: message.message };
      renderBanner();
      updateStatus();
      return;
  }
}

window.addEventListener("message", (event: MessageEvent<HostMessage>) => {
  receive(event.data);
});

window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "s") {
    event.preventDefault();
    save();
  }
});

vscode.postMessage({ type: "ready" });
