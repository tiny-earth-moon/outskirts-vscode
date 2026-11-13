# Changelog

## 0.1.0 (unreleased)

- `outskirts: Scan` runs outskirts in the project and shows its results as diagnostics.
- A message gives the number of results when the scan ends, or says that nothing is unused.
- `outskirts: Clear Results` removes them.
- Settings `outskirts.path`, `outskirts.arguments`, `outskirts.skipBuild` and `outskirts.severity`.
- An outskirts view in the activity bar lists the results grouped by file or by kind, with buttons to scan, cancel, clear, regroup and open the settings.
- A collapsible Scan Options view under the results shows the options of a project with their values: reuse the existing index (checkbox), severity, extra arguments, grouping, and the outskirts executable with its version; its title bar scans that project, selects another project and opens the settings. `outskirts: Show Scan Options` reveals it.
- `outskirts: Cancel Scan` stops a running scan; a second scan is refused while one runs.
- A status bar item shows the number of results and opens the view.
- Each project keeps its own results, with a node per project in the side bar, buttons to scan or clear one project, and an "All projects" choice that scans them in turn. A project is a workspace folder whose root holds a Swift package, an Xcode project or an outskirts configuration, or else such a direct sub-directory of a workspace folder, so a parent folder of several repositories works too; the list follows folder and project file changes and has a Refresh button.
- Results show the declaration name first, then the kind of finding and the line.
- Notifications name the scanned project ("12 results in App.") and no longer repeat "outskirts:", which VS Code already shows as their source.
- `outskirts: Fix with Agent` starts a coding agent chosen in the options (Claude Code, GitHub Copilot CLI, Codex CLI, Gemini CLI, Cursor Agent, or a custom command; a known agent counts as installed only if `--version` runs) in a terminal in the project directory, with a prompt listing the results of a project, a file or a single result; the agent edits, you review and scan again. Settings `outskirts.agent` and `outskirts.agentCommand`, read from user settings only; no shell, trusted workspaces only.
