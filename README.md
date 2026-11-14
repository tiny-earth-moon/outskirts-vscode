# outskirts for VS Code

Shows the unused Swift code found by [outskirts](https://github.com/tiny-earth-moon/outskirts) in a side bar, in the editor and in the Problems panel, for each project of the workspace, and can hand the results to a coding agent.

The extension does not analyze Swift itself: it runs the installed `outskirts` executable with `scan --format json --quiet` in the project directory and shows each result at its location. With an outskirts newer than 3.24.0, it also passes `--no-skip-stdout-results`, so that `skip_stdout_results` in the configuration file does not keep the results from it. A scan that prints nothing, not even `[]`, is reported as an error, never as "no unused code". With outskirts 3.13.3 or newer, it passes `--no-relative-results` so that the result paths are absolute; with `--relative-results` in Extra arguments, they are resolved against the `--relative-to` and `--project-root` given there, and a scan whose paths do not exist under that base is reported as an error. outskirts counts columns in UTF-8 bytes; the extension converts them from the line of the file when the scan ends. outskirts prints real paths; when the project is reached through a symbolic link, they are shown under the path it is opened at.

## Requirements

outskirts installed, e.g. `brew install tiny-earth-moon/tap/outskirts`, and a project it can scan (a Swift package or an Xcode project, configured with `.outskirts.yml` if needed).

## Commands

- **outskirts: Scan** scans the project and replaces its previous results; with several projects it asks which one, or all of them. The scan can be cancelled from its notification; when it ends, a message gives the number of results and names the project.
- **outskirts: Cancel Scan** stops the running scan. Only one scan runs at a time.
- **outskirts: Clear Results** removes the results of every project.
- **outskirts: Refresh Projects** looks for projects again; the list also follows added or removed workspace folders, sub-directories and project files: `Package.swift`, Xcode projects and workspaces, `.outskirts.yml` and `.periphery.yml`.
- **outskirts: Show Scan Options** opens the Scan Options view of the side bar; with several projects it first asks which project to show.
- **outskirts: Group by File** / **Group by Kind** change how the side bar groups the results.
- **Filter…** in the title bar of Results shows only the kinds of results picked (with their counts) and those whose name or path contains a text; the view tells "Filtered: 12 of 40", the filter is kept per workspace across scans, and **Clear Filter** removes it. The Problems panel keeps every diagnostic.
- **outskirts: Open Settings** shows the settings of the extension.
- **outskirts: Fix with Agent** hands the results to a coding agent; see [Fix with an agent](#fix-with-an-agent).
- **outskirts: Select Agent** chooses that agent.
- **outskirts: Edit Configuration** opens the configuration file of a project in a form; see [Configuration editor](#configuration-editor).
- **outskirts: Open Getting Started** opens the walkthrough *Find unused Swift code with outskirts* (install, first scan, review, configuration, baseline, CI); it also opens once after the extension is installed, and the empty Results view links to it, or to the install command when the executable is not found.

The output of outskirts is written to the "outskirts" output channel.

## Side bar

The Projects view, first in the outskirts side bar, lists every project the extension can scan: the workspace folders and the Swift packages and Xcode projects found one level below them. Each row shows the project's name, its path and its state (scanning…, N results, no unused code, stale, not scanned or error), with an icon for a Swift package, an Xcode project or workspace, or another folder. Clicking a row shows its results in the Results view. Its inline buttons scan the project, cancel its scan, clear its results and open its `.outskirts.yml`, created with a link to the configuration documentation when it does not exist yet. The title bar scans all the projects and refreshes the list.

The outskirts icon in the activity bar opens the results, grouped by file or by kind of finding with their counts; clicking a result opens its location. The title bar of the view has buttons to scan, cancel, show the options, switch the grouping, clear the results, refresh the projects and open the settings. After a scan, the status bar shows the number of results; clicking it shows the view.

When a file with results changes after the scan starts, in the editor or on disk (for example by an agent; each project is watched as a whole), its results are stale: their diagnostics leave the Problems panel since they may point at the wrong lines, the file is marked "changed since scan" and its results "stale" in the tree, and the project and the status bar tell how many files are to rescan. Stale results are left out of Fix with Agent. Nothing is rescanned automatically, since a scan builds the project: scan again to refresh them.

On an outskirts diagnostic in a Swift file, the Quick Fix menu (the lightbulb, Cmd+.) adds the comment command that keeps the code: `// outskirts:ignore` above the declaration and its attributes, `// outskirts:ignore:parameters <name>` above the function of an unused parameter, or `// outskirts:ignore:all` at the top of the file, after its header comment. The results of the file then become stale until the next scan.

Below the results, the collapsible **Scan Options** section shows the options of a project with their current values:

- **Reuse existing index**: a checkbox that scans without building, on the index of the last build (`--skip-build`).
- **Severity**: click to pick the severity of the diagnostics; the diagnostics already shown follow it.
- **Extra arguments**: click to edit them, quoted like in a shell; no shell is used.
- **Group results**: click to switch between grouping by file and by kind.
- **Executable**: the executable and its version, or "not found"; click to open the settings.
- **Agent**: the coding agent that Fix with Agent starts, "not set", or "(not installed)"; click to choose it.
- **Agent verifies by building**: a checkbox (user setting `outskirts.agentVerify`, off by default) that lets the agent build the project or run its tests after its changes; off, it only searches the code for remaining uses and ends with the command to run to verify.
- **Configuration…**: opens the [configuration editor](#configuration-editor) of the project.

Its title bar has buttons to scan the project with these options and to open the settings. With several projects, the view names the project it shows, follows the project last scanned or selected in the results, and has a button to select another project.

## Baseline

To adopt outskirts in a project that already has results, record them as a [baseline](https://github.com/tiny-earth-moon/outskirts/blob/master/docs/baselines.md) and see only the new ones:

- **Accept Current Results as Baseline** (right-click a row of the Projects view, or **outskirts: Accept Current Results as Baseline** from the Command Palette) scans the project with `--write-baseline`, reusing the index (`--skip-build`) once the project has been scanned. The file is the `baseline` of `.outskirts.yml`, whose entries are kept, or `.outskirts-baseline.json` at the project root; an existing file that the configuration does not name is only replaced after a confirmation. When the configuration does not name it, a notification offers to add `baseline: <file>` to `.outskirts.yml`, keeping its comments; the project is then scanned again, without the accepted results.
- **Clear Baseline** deletes that file after a confirmation. The `baseline` key stays in `.outskirts.yml` unless you choose to remove it too; while it stays, scans fail until the file exists again.

A project whose scan uses a baseline (`baseline` in its configuration or `--baseline` in the extra arguments) shows "baseline" in the Projects view, and the Results view says "N new since baseline".

## Configuration editor

**outskirts: Edit Configuration**, or the **Configuration…** row of Scan Options, opens the `.outskirts.yml` of a project in a form (the file outskirts reads: `.outskirts.yml`, `.outskirts.yaml`, `.periphery.yml` or `.periphery.yaml`, in that order); with several projects it asks which one. The form is built from `outskirts config schema`, so it lists every option of the installed outskirts, with its description and default, and needs an outskirts that prints its schema.

- The options are grouped in sections (Project & build, Targets & files, Retention, Analysis, String Catalogs, Reporting & output, Advanced), with a search on the key and the description and a filter for the modified options.
- A boolean is a switch, an option with fixed values a list, a text or a number a field (whole numbers only), and a list of values a list of tags: type and press Enter to add one, one per line when pasting. Each option shows its default, a marker when its value differs from the default, and a button to reset it. For `index_exclude`, whose values are added to built-in patterns that outskirts always keeps, those patterns are shown read-only and never written: the tags are the file's own patterns.
- **Save** (or Cmd+S / Ctrl+S in the form) writes only the options that changed; an option set back to its default is removed from the file. The comments, the order of the keys and the keys outskirts does not know are kept; the latter are listed under **Other keys**, and a value the form cannot show, such as a `report_exclude` entry with `kinds`, is shown as YAML, to edit in the file. A new file starts with the `yaml-language-server` comment that enables completion in the YAML extension.
- After saving, the form runs `outskirts config check` and shows "Configuration is valid" or the problems it reports.
- When the file changes on disk, the form reloads it, or, when it has unsaved changes, asks whether to reload or keep them. **Open as YAML** opens the file itself.
- Unsaved changes survive closing the editor: they are kept per project and restored when it opens again, with a banner that offers to discard them and says when the file changed on disk in the meantime.

At the top, **Recommendations** are computed from the project when the form opens: a look at its files, capped in number and size, that skips build and dependency directories. Each one gives its reason; **Apply** sets the option in the form, to save, and **Dismiss** hides it for that project. Only options that exist in the installed outskirts and are not set in the file are recommended:

- `project`, for a folder that holds one Xcode workspace or project and no `Package.swift`, and `schemes`, from the shared schemes of the Xcode project (the test schemes left out), or the scheme named after the project.
- `retain_public` for a package of library products, or `retain_public_modules` with its libraries when it also has executables.
- `retain_codable_properties` when Swift files use `Codable` or `Decodable`, `retain_encodable_properties` when they only use `Encodable`.
- `retain_objc_accessible` with Objective-C sources, `retain_objc_annotated` with `@objc` alone, `retain_js_accessible` with `JSExport`.
- `localized_string_key_literal_match` with String Catalogs and localized strings built from a variable.
- Without a configuration file, **Create .outskirts.yml** applies all of them at once.

## Fix with an agent

**Fix with Agent** starts a coding agent of your choice in a terminal, in the project directory, with a prompt that asks it to remove the unused code that outskirts found. The button is on each project, file and result of the Results view (it sends the results of that project, that file, or that single result), and in the title bar of the view and the command palette, where it takes the project with results, or asks which one.

The prompt is built from the results of the last scan, without scanning again. It tells the agent to change nothing else, to keep and report a declaration that turns out to be used (dynamically, from another target, by Interface Builder…), to apply the minimal change that a hint such as redundant accessibility names, not to edit generated files, and not to build or run the tests but to check each removal by searching the code, ending with a summary of what it removed and kept and the command to run to verify; with `outskirts.agentVerify` on, it builds or runs the tests instead if there is a quick way to. Then it lists the results by file, with paths relative to the project directory, one line per result: `line:column  kind name — hint`. At most 200 results are listed, fewer if the prompt would exceed 100 000 bytes or, on Windows, if the command line (the agent, its arguments and the prompt) would exceed the 32 767 characters that Windows accepts; the prompt says how many were left out.

The agent edits the files; review its changes as you would any other. Nothing reads the agent's output: when it is done, scan again by hand to see what is left.

The agent is chosen once, from the **Agent** row of Scan Options or **outskirts: Select Agent**, among the known agents found on the PATH:

| Agent | Command started |
|-------|-----------------|
| Claude Code | `claude <prompt>` |
| GitHub Copilot CLI | `copilot -i <prompt>` |
| Codex CLI | `codex <prompt>` |
| Gemini CLI | `gemini -i <prompt>` |
| Cursor Agent | `cursor-agent <prompt>` |

An agent found on the PATH is checked with `<agent> --version` when the list opens and before it starts, once per session (again after **Refresh**); one that does not run, such as a launcher left by another tool, is listed as not available and reads "(not installed)".

**Custom command…** uses `outskirts.agentCommand` instead, e.g. `["my-agent", "--interactive", "${prompt}"]`: the executable first, an absolute path or a name on the PATH, and `${prompt}` once, as a whole argument. If no agent is set, or the one set is not installed, Fix with Agent asks first.

The executable is started directly as the process of the terminal, with the prompt as one argument: no shell reads the command or the prompt, and control characters are stripped from the names and paths it holds. The agent settings are read from user settings only, never from a workspace, and an agent only starts in a trusted workspace.

On Windows, an agent is looked up with the extensions of `PATHEXT`; a file without an extension, such as the shell script that npm installs next to an agent's `.cmd`, is skipped. Windows runs a `.cmd` or `.bat` file through `cmd.exe`, which would read the prompt as commands, so a batch file is never started: the `.cmd` that npm writes for an agent is read to start the agent's script with `node.exe` directly, and any other batch file, or a file that is not an `.exe` or a `.com`, is refused with a message. For such an agent, set `outskirts.agent` to `custom` and `outskirts.agentCommand` to its `.exe`, or to `["node", "C:\\path\\to\\agent.js", "${prompt}"]`.

## Several projects

A project is a directory that holds `Package.swift`, an Xcode project or workspace, `.outskirts.yml` or `.periphery.yml`. An XcodeGen `project.yml` alone is not one, since outskirts scans the generated Xcode project: run `xcodegen`, then **outskirts: Refresh Projects**. Each workspace folder whose root is a project is scanned as one project. Otherwise, each direct sub-directory of the folder that is a project is scanned on its own, so opening a parent folder of several repositories works like opening each of them; deeper directories, hidden ones, build and dependency directories (`node_modules`, `build`, `DerivedData`, `Pods`, `Carthage`, `vendor`, `Vendor`, `SourcePackages`) and symbolic links are not searched. This works in a single folder as in a multi-root workspace. A project reached from two workspace folders, such as a folder added along with its parent, is listed once, as its own workspace folder, whose settings it then uses.

In a directory without `Package.swift`, the scan names the Xcode workspace with `--project`, or the Xcode project when there is no workspace, unless the Extra arguments hold `--project`, `--config` or `--generic-project-config`, or the configuration file sets `project:` or `generic_project_config:`. With several workspaces, or several projects and no workspace, it does not guess: the scan stops and asks to choose one with `--project` in Extra arguments or `project:` in `.outskirts.yml`. An Xcode project also needs the schemes to build, which the extension does not guess either: set them with `--schemes` in Extra arguments or `schemes:` in `.outskirts.yml`; without them, the error of outskirts is shown with this hint.

Each project keeps its own results: scanning or clearing one leaves the others untouched. With several projects, the side bar lists one node per project with its number of results and the time of its last scan, and buttons to scan or clear that project. **outskirts: Scan** offers each project, preselecting the project of the active editor, plus **All projects**, which scans them one after another; cancelling stops the rest. The status bar shows the total, and its tooltip the count of each project. A project that leaves the list, because its folder is removed from the workspace or deleted, loses its results; its running scan is stopped and its results are dropped, and All projects goes on with the next project.

Settings are stored per workspace folder, so the projects found in the same folder share them; the Scan Options view then reads "Library · shared by Repos". Options specific to one project belong in its own `.outskirts.yml`.

## Scan on save

With `outskirts.scanOnSave` set to `project`, saving a Swift file rescans its project once the saves stop for `outskirts.scanOnSaveDelay` ms. Saves across files of one project make one scan; a save during a scan queues a single rerun. A project never scanned in this session is not scanned on save. The status bar shows "outskirts: scanning on save…"; click it or run **Cancel Scan** to stop.

The scan uses the project's normal mode. With `outskirts.skipBuild`, outskirts reads the index of the last build, which saving does not update: the results follow the last build, the saved files stay marked stale until a scan that builds, and a message says so once per session.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `outskirts.path` | `outskirts` | Absolute path of the executable (a leading `~` is the home folder), or its name, looked up on the PATH and never in the project folder. |
| `outskirts.arguments` | `[]` | Extra arguments for `outskirts scan`, e.g. `["--schemes", "App"]`, after the ones the extension passes (`--project`: see [Several projects](#several-projects)). |
| `outskirts.skipBuild` | `false` | Reuse the existing index instead of building the project (`--skip-build`). |
| `outskirts.scanOnSave` | `off` | `project` rescans the project of a saved Swift file (see [Scan on save](#scan-on-save)). |
| `outskirts.scanOnSaveDelay` | `1500` | Milliseconds after the last save before that scan (at least 500). |
| `outskirts.severity` | `warning` | `error`, `warning`, `information` or `hint`. |
| `outskirts.agent` | empty | Agent started by Fix with Agent: `claude`, `copilot`, `codex`, `gemini`, `cursor`, or `custom`; empty asks. |
| `outskirts.agentCommand` | `[]` | Command of the custom agent, with `${prompt}` as one whole argument. |
| `outskirts.agentVerify` | `false` | Lets the agent build the project or run its tests after its changes. |

A scan builds the project and an agent edits it, so both only run in a trusted workspace, and `outskirts.path`, `outskirts.agent`, `outskirts.agentCommand` and `outskirts.agentVerify` are read from user or machine settings only, never from a workspace.

## Known limits

- A scan builds the project, so it is started by hand, not on save.
- macOS first: scanning Xcode projects requires macOS; Swift packages can also be scanned where outskirts runs on Linux.
