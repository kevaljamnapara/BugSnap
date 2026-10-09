# BugSnap Architecture — Proposed, Not Yet Approved

**Status:** Draft for architecture review. This is not permission to implement yet.

## 1. Goals
- Deliver the PRD's capture-to-export workflow.
- Run without a backend or paid service.
- Keep screenshots and report data local by default.
- Use minimal permissions and clear separation of responsibilities.

## 2. Proposed components

### Extension popup
- Provides the primary user-triggered capture action.
- Shows capture errors and entry points to saved reports/settings.
- Remains small and focused.

### Capture/background coordination
- Uses the relevant supported extension APIs to capture the active tab.
- Collects only approved metadata.
- Passes a capture result to the editor without silently duplicating or losing it.
- Handles restricted tabs and permission failures.

### Full-page report editor
- Displays screenshot and captured metadata.
- Edits title, severity, reproduction steps, expected behavior, actual behavior, and notes.
- Supports screenshot annotation.
- Saves and exports reports.

### Local report repository
- Persists report records and screenshot evidence locally.
- Supports list, read, update, delete, and export.
- Handles storage errors and quota limitations.

### Export module
- Generates Markdown from actual report data.
- Exports the corresponding screenshot as a separate image.
- Uses stable matching filenames and does not invent metadata.

## 3. Proposed technology direction
- React + TypeScript.
- Vite with a compatible Manifest V3 extension build setup.
- Chrome/Chromium extension APIs, subject to compatibility validation.
- IndexedDB is a candidate for report records and binary screenshot data; Chrome storage may be suitable for small settings/preferences.
- A maintained annotation library or a small custom implementation may be considered after evaluating size, licensing, accessibility, and export fidelity.

No exact dependency is approved yet.

## 4. Data model — conceptual only
A report may contain:
- Stable report ID
- Title
- Severity enum: Low, Medium, High, Critical
- Page URL and title
- Capture timestamp
- Available browser/OS metadata
- Reproduction steps
- Expected result
- Actual result
- Additional notes
- Original screenshot data/reference
- Annotated screenshot data/reference, if generated
- Created and updated timestamps

Do not store sensitive page contents or form values.

## 5. Capture-to-editor handoff
The architecture must decide how the capture result reaches the full-page editor safely and reliably. Consider extension messaging, temporary draft storage, or another supported mechanism. Avoid relying on fragile URL query strings for screenshot data. Prevent duplicate reports when a user retries or reloads the editor.

## 6. Permissions
Permissions must be chosen only after mapping each required behavior to its API. Document:
- Permission name
- Feature requiring it
- Why a narrower option is insufficient
- User-visible privacy implication

Do not request broad host permissions without a demonstrated need. Verify current browser API behavior and restrictions during implementation planning.

## 7. Automatic cleanup
- Cleanup is optional and should be off by default unless the user approves a different default.
- Exact retention periods remain undecided.
- Cleanup should delete only eligible BugSnap-managed local records and their associated evidence.
- Explain the policy before enabling it.
- Avoid deleting a currently open or unsaved report.
- Report cleanup results and failures transparently.
- Account for the fact that browser storage may be cleared independently of BugSnap.

## 8. Browser compatibility
- Chrome desktop is the first implementation/test target.
- Edge and Brave are candidate follow-up targets.
- Do not claim support for a browser until loading, permissions, capture, persistence, export, and cleanup are tested there.

## 9. Failure handling
Design for:
- Restricted browser pages
- Active tab unavailable
- Screenshot capture failure
- Editor opening failure
- Storage quota exceeded
- Corrupt or missing screenshot data
- Export/download failure
- Invalid or empty report fields
- Annotation coordinate scaling issues
- Cleanup failure

## 10. Open architecture decisions
1. Exact Vite/Manifest V3 tooling.
2. Capture result handoff mechanism.
3. Local storage schema and migration strategy.
4. Annotation implementation and image export method.
5. Browser/OS metadata that is reliably available without extra permissions.
6. Automatic cleanup periods and scheduling behavior.
7. Browser version support matrix.
8. Testing framework and automation level.

## 11. Architecture approval gate
Before implementation, confirm:
- The component boundaries and data flow.
- Required permissions and rationale.
- Storage and recovery strategy.
- Annotation and export strategy.
- Cleanup semantics.
- Initial browser support matrix.
- Testing plan and dependencies.
