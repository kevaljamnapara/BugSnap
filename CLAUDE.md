# Claude Project Context — BugSnap

Use this file as a short orientation guide when reviewing BugSnap in Claude chat. The canonical product requirements are in `PRD.md` (v0.3 Draft); agent behavior rules are in `AGENTS.md`.

## What we're building
BugSnap is a privacy-first Chromium-based browser extension for developers and QA testers. Users explicitly capture the visible area of a tab, complete a full-page report editor, annotate the screenshot, save the report locally, and export Markdown plus screenshot evidence.

## Confirmed decisions
- Target users: developers and QA testers.
- Capture model: user-triggered; no automatic/background capture.
- Editor: full-page editor in a browser tab using stable draft ID (`editor.html?id=<draftId>`).
- Draft lifecycle: debounced autosave; clean restoration on reload/closure without duplicates; explicit Discard Draft confirmation; abandoned drafts recoverable; actively edited reports protected from cleanup.
- Severity: Low, Medium, High, Critical.
- Intended browser family: Chromium-based desktop browsers; Chrome is the first test target.
- Export: canonical Markdown report template with matching sanitized filename stems; separate file downloads via browser-native Blob URLs (`<a download>`) without Chrome `downloads` permission.
- Testing stack: TypeScript checks (`tsc --noEmit`), ESLint, Vitest, React Testing Library, jsdom, and focused Chrome API mocks.
- Retention: optional automatic cleanup; default and exact periods still need approval.
- Budget: ₹0.
- Tools: Antigravity for implementation; Claude free chat for planning and review.
- MVP has no backend, accounts, cloud sync, paid APIs, or AI inference.
- Reports and screenshots remain local unless the user explicitly exports them.
- No commits, pushes, pull requests, merges, or destructive Git operations without explicit user approval.

## How to review
- Treat PRD and approved decisions as the source of truth.
- Identify contradictions, missing acceptance criteria, technical risks, and scope creep.
- Do not invent facts about browser APIs; flag details that require verification.
- Do not generate code or implementation prompts unless the user explicitly asks for that next step.
- Prefer concrete, incremental recommendations.
