# outskirts for VS Code

Shows the unused Swift code found by [outskirts](https://github.com/tiny-earth-moon/outskirts) in a side bar, in the editor and in the Problems panel, for each project of the workspace, and can hand the results to a coding agent.

The extension does not analyze Swift itself: it runs the installed `outskirts` executable with `scan --format json --quiet` in the project directory and shows each result at its location.

## Requirements

outskirts installed, e.g. `brew install tiny-earth-moon/tap/outskirts`, and a project it can scan (a Swift package or an Xcode project, configured with `.outskirts.yml` if needed).

## Commands

- **outskirts: Scan** scans the project and replaces its previous results; with several projects it asks which one, or all of them. The scan can be cancelled from its notification; when it ends, a message gives the number of results and names the project.
- **outskirts: Cancel Scan** stops the running scan. Only one scan runs at a time.
- **outskirts: Clear Results** removes the results of every project.
- **outskirts: Refresh Projects** looks for projects again; the list also follows added or removed folders and project files.
- **outskirts: Show Scan Options** opens the Scan Options view of the side bar; with several projects it first asks which project to show.
- **outskirts: Group by File** / **Group by Kind** change how the side bar groups the results.
- **outskirts: Open Settings** shows the settings of the extension.
- **outskirts: Fix with Agent** hands the results to a coding agent; see [Fix with an agent](#fix-with-an-agent).
- **outskirts: Select Agent** chooses that agent.

The output of outskirts is written to the "outskirts" output channel.

## Side bar

The outskirts icon in the activity bar opens the results, grouped by file or by kind of finding with their counts; clicking a result opens its location. The title bar of the view has buttons to scan, cancel, show the options, switch the grouping, clear the results, refresh the projects and open the settings. After a scan, the status bar shows the number of results; clicking it shows the view.

When a file with results changes after the scan, in the editor or on disk (for example by an agent), its results are stale: their diagnostics leave the Problems panel since they may point at the wrong lines, the file is marked "changed since scan" and its results "stale" in the tree, and the project and the status bar tell how many files are to rescan. Stale results are left out of Fix with Agent. Nothing is rescanned automatically, since a scan builds the project: scan again to refresh them.

Below the results, the collapsible **Scan Options** section shows the options of a project with their current values:

- **Reuse existing index**: a checkbox that scans without building, on the index of the last build (`--skip-build`).
- **Severity**: click to pick the severity of the diagnostics.
- **Extra arguments**: click to edit them, quoted like in a shell; no shell is used.
- **Group results**: click to switch between grouping by file and by kind.
- **Executable**: the executable and its version, or "not found"; click to open the settings.
- **Agent**: the coding agent that Fix with Agent starts, "not set", or "(not installed)"; click to choose it.
- **Agent verifies by building**: a checkbox (user setting `outskirts.agentVerify`, off by default) that lets the agent build the project or run its tests after its changes; off, it only searches the code for remaining uses and ends with the command to run to verify.

Its title bar has buttons to scan the project with these options and to open the settings. With several projects, the view names the project it shows, follows the project last scanned or selected in the results, and has a button to select another project.

## Fix with an agent

**Fix with Agent** starts a coding agent of your choice in a terminal, in the project directory, with a prompt that asks it to remove the unused code that outskirts found. The button is on each project, file and result of the Results view (it sends the results of that project, that file, or that single result), and in the title bar of the view and the command palette, where it takes the project with results, or asks which one.

The prompt is built from the results of the last scan, without scanning again. It tells the agent to change nothing else, to keep and report a declaration that turns out to be used (dynamically, from another target, by Interface Builder…), to apply the minimal change that a hint such as redundant accessibility names, not to edit generated files, and not to build or run the tests but to check each removal by searching the code, ending with a summary of what it removed and kept and the command to run to verify; with `outskirts.agentVerify` on, it builds or runs the tests instead if there is a quick way to. Then it lists the results by file, with paths relative to the project directory, one line per result: `line:column  kind name — hint`. At most 200 results are listed, fewer if the prompt would exceed 100 000 bytes; the prompt says how many were left out.

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

## Several projects

A project is a directory that holds `Package.swift`, an Xcode project or workspace, `.outskirts.yml` or `.periphery.yml`. An XcodeGen `project.yml` alone is not one, since outskirts scans the generated Xcode project: run `xcodegen`, then **outskirts: Refresh Projects**. Each workspace folder whose root is a project is scanned as one project. Otherwise, each direct sub-directory of the folder that is a project is scanned on its own, so opening a parent folder of several repositories works like opening each of them; deeper directories, hidden ones, `node_modules`, `build`, `DerivedData` and symbolic links are not searched. This works in a single folder as in a multi-root workspace.

In a directory without `Package.swift`, the scan names the Xcode workspace with `--project`, or the Xcode project when there is no workspace, unless the Extra arguments hold `--project`, `--config` or `--generic-project-config`, or the configuration file sets `project:` or `generic_project_config:`. With several workspaces, or several projects and no workspace, it does not guess: the scan stops and asks to choose one with `--project` in Extra arguments or `project:` in `.outskirts.yml`. An Xcode project also needs the schemes to build, which the extension does not guess either: set them with `--schemes` in Extra arguments or `schemes:` in `.outskirts.yml`; without them, the error of outskirts is shown with this hint.

Each project keeps its own results: scanning or clearing one leaves the others untouched. With several projects, the side bar lists one node per project with its number of results and the time of its last scan, and buttons to scan or clear that project. **outskirts: Scan** offers each project, preselecting the project of the active editor, plus **All projects**, which scans them one after another; cancelling stops the rest. The status bar shows the total, and its tooltip the count of each project.

Settings are stored per workspace folder, so the projects found in the same folder share them; the Scan Options view then reads "Library · shared by Repos". Options specific to one project belong in its own `.outskirts.yml`.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `outskirts.path` | `outskirts` | Path of the executable, or its name on the PATH. |
| `outskirts.arguments` | `[]` | Extra arguments for `outskirts scan`, e.g. `["--schemes", "App"]`, after the ones the extension passes (`--project`: see [Several projects](#several-projects)). |
| `outskirts.skipBuild` | `false` | Reuse the existing index instead of building the project (`--skip-build`). |
| `outskirts.severity` | `warning` | `error`, `warning`, `information` or `hint`. |
| `outskirts.agent` | empty | Agent started by Fix with Agent: `claude`, `copilot`, `codex`, `gemini`, `cursor`, or `custom`; empty asks. |
| `outskirts.agentCommand` | `[]` | Command of the custom agent, with `${prompt}` as one whole argument. |
| `outskirts.agentVerify` | `false` | Lets the agent build the project or run its tests after its changes. |

A scan builds the project and an agent edits it, so both only run in a trusted workspace, and `outskirts.path`, `outskirts.agent`, `outskirts.agentCommand` and `outskirts.agentVerify` are read from user or machine settings only, never from a workspace.

## Known limits

- A scan builds the project, so it is started by hand, not on save.
- macOS first: scanning Xcode projects requires macOS; Swift packages can also be scanned where outskirts runs on Linux.
