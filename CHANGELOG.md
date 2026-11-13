# Changelog

## 0.1.0 (2026-11-13)

First release.

- **Scan**: `outskirts: Scan` runs the installed outskirts on a project as a cancellable background task and shows the unused code in the Problems panel and in the editor. A message gives the number of results when the scan ends.
- **Side bar**: an outskirts view in the activity bar lists the results grouped by file or by kind, with buttons to scan, cancel, clear and regroup, and a status bar item with the total.
- **Several projects**: each project keeps its own results, with a node per project and an "All projects" scan. A project is a workspace folder, or a directory one level below it, that holds a Swift package, an Xcode project or an outskirts configuration.
- **Scan Options**: a collapsible view shows the options of a project with their values: reuse the existing index, severity, extra arguments, grouping, the outskirts executable and its version, and the agent.
- **Fix with Agent**: hands the results of a project, a file or a single result to a coding agent started in a terminal (Claude Code, GitHub Copilot CLI, Codex CLI, Gemini CLI, Cursor Agent, or a custom command). The agent edits and you review; it does not build the project unless `outskirts.agentVerify` is set.
- **Stale results**: the results of a file changed after the scan are marked stale and their diagnostics removed until the next scan.
- **Safety**: nothing runs in an untrusted workspace; the outskirts executable and the agent are never taken from workspace settings; processes are started without a shell.
