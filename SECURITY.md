# Security Policy

## Supported versions

Only the latest release of the extension receives security fixes.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub Security Advisories:
<https://github.com/tiny-earth-moon/outskirts-vscode/security/advisories/new>

Do not open a public issue for a security problem. This is a volunteer-maintained project: expect an initial response within about 7 days. There is no bug bounty.

## Scanning untrusted projects

A scan runs the installed `outskirts`, which builds the project with `xcodebuild` or `swift build` and can execute arbitrary code from it (build scripts, plugins, macros). Fix with Agent starts a coding agent that edits the project. Both only run in a trusted workspace: only trust workspaces whose code you trust.
