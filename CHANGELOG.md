# Changelog

## Unreleased

- **Update without reload**: when VS Code runs the new version before reloading the window, a missing Projects view no longer stops the whole extension: scans and results keep working, and a message offers to reload the window.

## 0.2.0 (2026-11-14)

- **Ignore quick fixes**: on an outskirts diagnostic in a Swift file, the lightbulb offers to add `// outskirts:ignore` above the declaration (above its attributes, below its doc comment), `// outskirts:ignore:parameters <name>` above the function of an unused parameter, appended to an existing list, or `// outskirts:ignore:all` after the header comment of the file; an existing comment is never duplicated, and the results of the file become stale.
- **Projects view**: a Projects view lists every project the extension can scan with its state, and scans, cancels, clears or configures each one from its row.
- **Configuration editor**: **outskirts: Edit Configuration**, also a Configuration row of Scan Options, edits `.outskirts.yml` in a form built from `outskirts config schema`, keeping comments and unknown keys, checks it with `outskirts config check` after saving, and recommends options from the files of the project.

## 0.1.2 (2026-11-14)

- Same extension as 0.1.1, published again so that it is available on Open VSX.

## 0.1.1 (2026-11-13)

- **Xcode projects**: a folder that holds only an Xcode workspace or project is scanned with `--project`, the workspace first; with several, the scan asks to choose one. A missing `--project` or `--schemes` is shown with the error of outskirts and the setting that fixes it. An XcodeGen `project.yml` alone is no longer listed as a project.
- **Results sent elsewhere**: a scan that prints nothing on stdout, as with `--skip-stdout-results`, is an error that says why, instead of "No unused code found". With an outskirts newer than 3.24.0, the scan passes `--no-skip-stdout-results` so that `skip_stdout_results` in the configuration file does not hide the results.
- **All projects**: the scan stays running from one project to the next, so the Cancel button and the status bar no longer flicker between them; an outskirts stopped by a signal is reported as "stopped by signal SIGKILL", not "exited with status null".
- **Fix with Agent**: names and paths in the prompt have their invisible characters (controls, line and paragraph separators, tag characters, bidirectional controls, zero-width characters) replaced with a visible "�", so that a name can no longer hide text or a line break from the reader of the prompt; ordinary names, emoji included, are unchanged.
- **Fix with Agent on Windows**: the prompt is shortened, with the number of results left out, so that the command line of the agent stays under the 32 767 characters that Windows accepts, instead of failing to start; the other platforms keep their 100 000-byte limit.
- **Agent lookup on Windows**: an agent is looked up with the extensions of `PATHEXT`, in their order, and a file without an extension is no longer taken: for an agent installed by npm, the `.cmd` file is found instead of the shell script next to it, which Windows cannot run. The lookup of `outskirts.path` follows the same rule.
- **Agents started on Windows**: a `.cmd` or `.bat` agent, which Windows runs through `cmd.exe`, is never started, since `cmd.exe` would read the names and paths of the prompt as commands; the `.cmd` that npm writes for an agent is resolved to its script, started and checked with `node.exe` directly, and any other batch file is refused with a message that says how to set `outskirts.agentCommand`. Its `--version` check no longer fails on every `.cmd` agent.
- **Error messages**: a project folder that no longer exists is reported as such, not as "executable not found".
- **Output channel**: shows the messages of outskirts and the size of the results, no longer the whole JSON of the results.
- **outskirts.path**: a leading `~` stands for the home folder. The version check runs in the project folder, and an outskirts that does not answer in time shows "no answer to version" instead of "not found".
- **Executable lookup**: a name in `outskirts.path` is looked up on the PATH before the scan, never in the project folder (Windows searched it first), and only absolute PATH entries count. A relative path is no longer accepted: give an absolute path or a name.
- **Overlapping workspace folders**: a project reached both as a workspace folder and as a sub-directory of its parent folder is listed and scanned once, as its own workspace folder, instead of twice under the same name.
- **Removed projects**: a scan whose project leaves the list while it runs, its folder removed from the workspace or deleted, is stopped and its results dropped, instead of being counted in the status bar and the Problems panel for a project the side bar no longer shows.
- **Project list**: an Xcode project or workspace added or removed, at the root of a workspace folder or one level below, and a sub-directory added or deleted as a whole, now update the list of projects, as `Package.swift` and the configuration files already did.
- **Activation**: the extension starts with a workspace that holds an Xcode project or workspace by looking for the file inside it (`project.pbxproj`, `contents.xcworkspacedata`), since `workspaceContains` matches its glob patterns against files only and an Xcode project or workspace is a folder.
- **Dependency directories**: `Pods`, `Carthage`, `vendor`, `Vendor` and `SourcePackages` are no longer offered as projects, like `node_modules`, `build` and `DerivedData` already.
- **Symbolic links**: a project opened through a symbolic link, or under `/tmp` which macOS resolves to `/private/tmp`, has its diagnostics on the files open in the editor, and editing them marks their results stale: the real paths that outskirts prints are shown under the path the project is opened at.
- **Relative result paths**: with outskirts 3.13.3 or newer, the scan passes `--no-relative-results`, so that `relative_results` in the configuration file no longer sends the results to wrong locations. `--relative-results` in Extra arguments still works: its paths are resolved against `--relative-to` and `--project-root` when they are given there, and a path that does not exist under that base is reported as an error instead of a result in a missing file.
- **Columns**: outskirts counts the column of a result in UTF-8 bytes, which the editor read as characters, so a result on a line with accented letters or emoji before the name opened past it. The column is now converted from the line of the file when the scan ends; the Problems panel, the side bar and Fix with Agent use the converted column.
- **Severity**: changing `outskirts.severity`, in the settings or from the Scan Options view, updates the diagnostics already shown, instead of waiting for the next scan.
- **Changes on disk**: one watcher per project replaces one per file with results, which were all recreated at each change; a file whose name holds `[`, `{`, `*` or `?`, read as a glob pattern until now, is followed too.
- **Changes during a scan**: a file edited or changed on disk while its project is scanned has its results stale as soon as they arrive, instead of looking fresh.
- **Changes just before a scan**: a file written just before a scan starts, whose change the file watcher reports only once the scan runs or has ended, no longer marks the new results stale: a change on disk counts only when the file was modified after the scan started.
- **Large projects**: the side bar tells stale results apart in linear time, instead of searching every result of the project for each one shown (about a second for 100 000 results). The time of the last scan of a project ("just now", "5 min ago") now follows the clock instead of staying as it was when the view was last redrawn.

## 0.1.0 (2026-11-13)

First release.

- **Scan**: `outskirts: Scan` runs the installed outskirts on a project as a cancellable background task and shows the unused code in the Problems panel and in the editor. A message gives the number of results when the scan ends.
- **Side bar**: an outskirts view in the activity bar lists the results grouped by file or by kind, with buttons to scan, cancel, clear and regroup, and a status bar item with the total.
- **Several projects**: each project keeps its own results, with a node per project and an "All projects" scan. A project is a workspace folder, or a directory one level below it, that holds a Swift package, an Xcode project or an outskirts configuration.
- **Scan Options**: a collapsible view shows the options of a project with their values: reuse the existing index, severity, extra arguments, grouping, the outskirts executable and its version, and the agent.
- **Fix with Agent**: hands the results of a project, a file or a single result to a coding agent started in a terminal (Claude Code, GitHub Copilot CLI, Codex CLI, Gemini CLI, Cursor Agent, or a custom command). The agent edits and you review; it does not build the project unless `outskirts.agentVerify` is set.
- **Stale results**: the results of a file changed after the scan are marked stale and their diagnostics removed until the next scan.
- **Safety**: nothing runs in an untrusted workspace; the outskirts executable and the agent are never taken from workspace settings; processes are started without a shell.
