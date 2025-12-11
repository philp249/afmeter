Purpose
-------

This file gives focused, actionable guidance for AI coding agents working in this repository. Keep changes minimal and self-contained: this repo currently contains a single `index.html` (a static, single-file web page). There is no build system, tests, or CI visible in the repo root.

Quick repo snapshot
- **Type:** Static single-file website
- **Key file:** `index.html` (root)
- **Build:** none detected — open in browser or serve with a minimal HTTP server

How to run locally (Windows PowerShell)
- **Open file directly:**

```powershell
ii .\index.html
```

- **Serve from a simple HTTP server (optional):**

```powershell
# Python 3 simple server (if Python is installed)
python -m http.server 8000; ii http://localhost:8000/index.html
```

Agent editing rules (project-specific)
- **Scope edits to `index.html` only unless instructed otherwise.** This repo has no package manifests; do not introduce toolchains or package managers without explicit user approval.
- **Small, reversible changes:** Prefer minimal diffs (single logical change per PR). If you add new files, put them in a top-level folder and update `index.html` references.
- **Preserve existing formatting and whitespace** unless the user asks for a reformat; this repo is small and manual edits are expected.
- **Do not add CI/config files** (e.g., `package.json`, GitHub Actions) unless the user asks — document proposed changes first in a comment or issue.

Patterns and examples from this repo
- The only visible artifact is `index.html`. When modifying UI or behavior, update HTML, inline CSS, or inline JS in `index.html` and test in a browser.
- If you need to add assets (images, scripts, stylesheets), create a clear folder (e.g., `assets/`) and reference it from `index.html`. Mention the new files in the PR description.

Developer workflow notes
- There are no test scripts or build steps to run. Validate change by opening the page in a browser and checking the visible behavior.
- Use concise commit messages: e.g., `fix: adjust layout in index.html` or `feat: add download button to index.html`.

When to ask the user before acting
- Adding a new build system, test framework, or CI configuration
- Introducing transpilers, bundlers, or package managers
- Making large-structural changes (new directories, refactors across multiple files)

Files to inspect first
- `index.html` — primary implementation. Start here for any change.

If anything here is incomplete or you need additional context (expected runtime behavior, target browsers, or data sources), ask the repo owner before making larger changes.

End
