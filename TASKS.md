# BugSnap Implementation Plan

**Status:** Planning only. Do not start a phase until the user explicitly approves it.

## Phase 0 — Documentation and decisions
- [ ] Review and approve PRD (transition from draft v0.3 to approved v1.0 upon explicit approval).
- [ ] Resolve open decisions in `DECISIONS.md`.
- [ ] Review `AGENTS.md` and Antigravity's workspace-rule behavior.
- [ ] Approve `ARCHITECTURE.md`.
- [ ] Approve dependency and permission plan.

**Exit criteria:** No high-impact product or architecture decision is left to the coding agent to guess.

## Phase 1 — Extension scaffold
- [x] Create React + TypeScript + Vite + Manifest V3 scaffold.
- [x] Set up testing toolchain: TypeScript checks (`tsc --noEmit`), ESLint, Vitest, React Testing Library, and jsdom.
- [x] Build a valid unpacked extension.
- [x] Add basic popup and full-page editor navigation.
- [x] Document local setup.
- [ ] Load in Chrome and verify basic navigation.

**Exit criteria:** Extension loads, popup opens, editor tab opens, test runner passes, build passes.

## Phase 2 — Capture workflow
- [ ] Capture the visible active tab after user action.
- [ ] Record approved metadata (omit unavailable metadata without inventing values).
- [ ] Assign stable draft ID and persist initial draft and screenshot to local storage.
- [ ] Pass draft ID to editor via URL query parameter (`editor.html?id=<draftId>`).
- [ ] Handle restricted pages and capture failures with clear errors and retry.
- [ ] Verify no duplicate draft/report on retry or reload.

**Exit criteria:** Capture-to-editor flow works and errors are understandable.

## Phase 3 — Report editor and persistence
- [ ] Implement required report fields and severity options.
- [ ] Implement debounced autosave to persist edits locally.
- [ ] Restore drafts cleanly after editor reloads (`F5`) or accidental tab closure.
- [ ] Provide explicit "Discard Draft" action with confirmation dialog to purge unexported drafts.
- [ ] List, reopen, update, and delete reports; keep abandoned drafts recoverable.
- [ ] Protect reports currently being edited from automatic cleanup.
- [ ] Handle storage quota and missing evidence gracefully.

**Exit criteria:** Report data survives normal browser restarts, draft recovery functions reliably, and management flows pass.

## Phase 4 — Screenshot annotation and export
- [ ] Add rectangle, arrow, and text annotations.
- [ ] Verify annotation scaling and export fidelity.
- [ ] Generate Markdown following the canonical report template with matching, sanitized filename stems.
- [ ] Safely format and escape user-entered Markdown content where necessary.
- [ ] Download Markdown and screenshot as separate files via browser-native Blob URLs (`<a download>`) without requiring the Chrome `downloads` permission.
- [ ] Handle and document browser multiple-download permission prompts.
- [ ] Handle export errors.

**Exit criteria:** Exported Markdown and screenshot are usable together with matching filenames and zero extra permissions.

## Phase 5 — Automatic cleanup and privacy
- [ ] Implement only the approved cleanup policy.
- [ ] Apply retention policy consistently to eligible saved reports and abandoned drafts.
- [ ] Protect reports currently being edited from automatic cleanup.
- [ ] Ensure cleanup is optional and clearly disclosed.
- [ ] Audit permissions to confirm the Chrome `downloads` permission and broad host permissions are absent.
- [ ] Verify no report data is sent externally by default.

**Exit criteria:** Cleanup and privacy tests pass.

## Phase 6 — Polish and QA
- [ ] Refine popup and editor UI.
- [ ] Verify accessibility and keyboard behavior.
- [ ] Test all core flows and error states.
- [ ] Run type checks (`tsc --noEmit`), linting (`eslint`), Vitest test suite, and production build.
- [ ] Test approved Chromium browsers.
- [ ] Update `TESTING.md` with actual results.
- [ ] Review release checklist.

**Exit criteria:** P0 acceptance criteria pass, known critical defects are resolved, and remaining limitations are documented.

## Working agreement
After each phase, report files changed, commands run, tests and results, known limitations, and the next proposed phase. Wait for user approval before proceeding.
