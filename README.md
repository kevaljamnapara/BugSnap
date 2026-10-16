# BugSnap

BugSnap is a privacy-first Chromium-based browser extension for developers and QA testers. It helps users manually capture a website bug, document it with structured fields and visual evidence, save it locally, and export a Markdown report plus screenshot.

BugSnap can also start an explicit, user-initiated debug session for a captured report. It records console errors and warnings, uncaught exceptions, unhandled rejections, CSP violations, failed network requests (fetch and XHR), and subresource failures, with separate stream ring buffers, exact loss accounting, and local privacy sanitization.

## Project status

**Foundation implementation is available on `dev`; formal product and architecture approval remains governed by the project decision records.**

- PRD: v0.3 — draft incorporating draft recovery, canonical export, download mechanism, and testing strategy; v1.0 remains unapproved pending explicit user approval
- Development budget: ₹0
- Primary implementation tool: Antigravity
- Planning/review tool: Claude free chat
- Initial target browser: Chrome desktop; Chromium compatibility must be tested separately

## Start here

1. Read `PRD.md`.
2. Read `AGENTS.md` before asking an AI coding agent to change files.
3. Review `DECISIONS.md` and resolve the remaining product decisions.
4. Review `ARCHITECTURE.md`.
5. Follow `TASKS.md` one phase at a time.
6. Verify work using `TESTING.md`.

Do not begin implementation until the PRD and architecture are approved.

## Core product promise

Capture a bug, document what happened, attach visual evidence, and export a professional report in minutes.

## Non-negotiable constraints

- No paid tools, APIs, hosting, or database plans are required for the MVP.
- No backend, account, cloud sync, or AI inference in the MVP.
- No automatic/background capture. Capture is user-triggered.
- Report data and screenshots remain local unless the user explicitly exports them.
- Do not claim a feature works unless it has been tested.
- No Git commits, pushes, pull requests, merges, or destructive Git operations without explicit user approval.
