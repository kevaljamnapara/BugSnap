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
- Uses supported extension APIs to capture the active tab upon explicit user action.
- Collects only approved metadata; omits unavailable fields without fabricating values.
- Assigns a stable draft ID and persists the initial capture record and screenshot in local storage.
- Passes the draft ID to the editor via URL parameter (`editor.html?id=<draftId>`) without relying on large URL strings.
- Handles restricted tabs and permission failures with user-facing errors.

### Full-page report editor
- Opens in a dedicated browser tab using the draft ID.
- Displays screenshot and captured metadata.
- Edits title, severity, reproduction steps, expected behavior, actual behavior, and notes.
- Automatically persists form edits to local storage via debounced autosave.
- Restores drafts cleanly upon page reload (`F5`) or accidental closure without duplicating records.
- Provides an explicit "Discard Draft" action with a confirmation dialog to permanently delete unexported drafts and evidence.
- Supports screenshot annotation: rectangles, arrows, and text labels.
- Saves and exports reports.

### Local report repository
- Persists report records (`status: 'draft' | 'saved'`) and binary screenshot evidence in IndexedDB.
- Supports list, read, update, delete, and export operations.
- Lists both saved reports and recoverable abandoned drafts.
- Strictly protects reports currently being edited from automatic cleanup.
- Handles storage errors and quota limitations gracefully.

### Export module
- Generates structured Markdown according to the canonical report template.
- Uses matching, sanitized filename stems for both Markdown and screenshot (`bugsnap-<slug>-<timestamp>`).
- Safely formats and escapes user Markdown input.
- Exports Markdown and screenshot as separate downloadable files via browser-native Blob URLs (`<a download>`) without requiring the Chrome `downloads` permission.
- Documents the browser behavior where sequential downloads may prompt the user for permission.

## 3. Proposed technology direction
- React + TypeScript.
- Vite with a compatible Manifest V3 extension build setup.
- Chrome/Chromium extension APIs, subject to compatibility validation.
- IndexedDB for report records, drafts, and binary screenshot data; `chrome.storage.local` for lightweight settings.
- Browser-native Blob URLs (`<a download>`) for file exports, avoiding the Chrome `downloads` permission.
- Planned testing stack: TypeScript checks (`tsc --noEmit`), ESLint with TypeScript support, Vitest, React Testing Library, and jsdom with focused Chrome API mocks. Real extension APIs verified through manual testing in Chrome.
- A maintained annotation library or a small custom implementation will be evaluated for size, licensing, accessibility, and export fidelity.

No dependencies are installed yet.

## 4. Data model — conceptual only
A report record in IndexedDB may contain:
- Stable report/draft ID (UUID)
- Status enum: `draft` | `saved`
- Title
- Severity enum: `Low`, `Medium`, `High`, `Critical`
- Page URL and title
- Capture timestamp
- Available browser/OS metadata (omitting unavailable properties)
- Reproduction steps
- Expected result
- Actual result
- Additional notes
- Original screenshot Blob/data
- Annotated screenshot Blob/data, if generated
- Sanitized filename stem
- Created and updated timestamps

Do not store sensitive page contents, cookies, or form values.

## 5. Capture-to-editor handoff
Handoff uses local storage persistence with a stable ID:
1. Capture worker persists the capture and screenshot to IndexedDB under a newly generated stable `draftId` with `status: 'draft'`.
2. Capture worker opens the editor tab: `editor.html?id=<draftId>`.
3. Editor loads the existing record by ID from IndexedDB.
4. Reloading the editor reloads the existing record by ID without creating duplicate drafts.
5. If the user navigates away or closes the tab, the draft remains recoverable in the reports list.
6. If the user chooses "Discard Draft", the record and its screenshot are purged after confirmation.

## 6. Permissions
Permissions must follow the principle of least privilege:
- `activeTab`: For capturing the visible tab on user action.
- `storage`: For storing user preferences/settings.
- No Chrome `downloads` permission: File downloads are handled via browser-native Blob links (`<a download>`), avoiding intrusive install-time permission warnings.
- No broad host permissions: Domain-specific access is not required for MVP capture.

## 7. Automatic cleanup
- Cleanup is optional and off by default unless approved otherwise.
- Retention policy applies consistently to eligible saved reports and abandoned drafts.
- Strictly protects reports currently being edited from automatic cleanup.
- Deletes complete eligible records and associated evidence from local storage.
- Clearly discloses cleanup consequences to the user.
- Handles storage eviction or manual browser clearing transparently.

## 8. Browser compatibility
- Chrome desktop is the first implementation/test target.
- Edge and Brave are candidate follow-up targets.
- Do not claim support for a browser until loading, permissions, capture, persistence, export, and cleanup are tested there.

## 9. Failure handling
Design for:
- Restricted browser pages (`chrome://`, extension webstore)
- Active tab unavailable or permission denied
- Screenshot capture failure (provide retry)
- Editor opening failure
- Storage quota exceeded
- Corrupt or missing screenshot data
- Export/download failure or browser multiple-download blocking
- Invalid or empty report fields
- Annotation coordinate scaling issues
- Cleanup failure

## 10. Open architecture decisions
1. Exact Vite/Manifest V3 build tooling plugin.
2. Local storage schema details and migration helper.
3. Annotation implementation choice (maintained lightweight library vs. small custom canvas/SVG).
4. Reliable browser/OS metadata properties available without extra permissions.
5. Automatic cleanup default and retention period options (O-001, O-002, O-003).
6. Browser version support matrix and minimum supported Chromium versions (O-004, O-010).

## 11. Architecture approval gate
Before Phase 1 implementation begins, confirm:
- Scaffold build tooling and configuration.
- Local storage schema and IndexedDB helper.
- Annotation approach and rendering fidelity.
- Final permission declaration in `manifest.json`.
