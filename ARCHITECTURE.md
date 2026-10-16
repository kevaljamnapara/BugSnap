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
- **Default state:** Cleanup is disabled (OFF) by default for new installations and remains off unless explicitly enabled by the user.
- **Retention options:** Configurable retention periods of 7, 30, and 90 days. Settings are persisted in IndexedDB `settings` store (`key: 'retention'`).
- **Timestamp eligibility policy:** Evaluates `updatedAt` first, falling back to `createdAt` and `metadata.capturedAt`. A report is eligible for cleanup if and only if `effectiveTimestamp < cutoffTimestamp` (where `cutoffTimestamp = now - retentionDays * 86,400,000`). Reports at or newer than the cutoff, or records with invalid/missing timestamps, are safely preserved.
- **Active edit protection:** Multi-tab persistent session lock store (`locks` table in IndexedDB, schema version 2). Active editor instances acquire a session lock on mount, send periodic heartbeats every 15 seconds, and release locks on unmount or tab closure. Locks expire after 120 seconds of inactivity to protect against crashed sessions while comfortably tolerating Chromium 60-second background tab timer throttling. Active tabs immediately refresh their lock upon tab focus (`window.focus`), visibility restoration (`visibilitychange`), and user autosaves. In extension environments, cleanup additionally cross-checks open browser tabs via `chrome.tabs.query` to protect reports open in suspended or frozen tabs. Reports with an active unexpired lock or an open editor tab are strictly excluded from cleanup. *(Documented limitation: If the entire browser process terminates abruptly without firing beforeunload, orphaned locks require 2 minutes to expire before that report becomes eligible for retention cleanup).*
- **Deletion completeness:** Eligible records are completely purged, including the metadata record, original screenshot data, vector annotations, and annotated composite screenshot. Applies consistently to both saved reports and abandoned drafts.
- **Resilient error handling:** Cleanup iterates through eligible reports, catching and logging errors per report without halting the remaining cleanup batch. Returns a structured `CleanupResult` (`evaluatedCount`, `deletedCount`, `skippedLockedCount`, `errors`).
- **Execution triggers:** Runs in the background on extension startup (`chrome.runtime.onStartup`) and install/update (`chrome.runtime.onInstalled`). Also invokable on-demand via the Report Management settings UI.

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
- Cleanup failure (resilient per-item error handling with status feedback)

## 10. Open architecture decisions
1. Exact Vite/Manifest V3 build tooling plugin. (Resolved: `@crxjs/vite-plugin` v3.0.0 per D-017)
2. Local storage schema details and migration helper. (Resolved: IndexedDB `bugsnap_db` v2 with `reports`, `settings`, and `locks` stores per D-019, D-022, D-025)
3. Annotation implementation choice. (Resolved: lightweight SVG overlay & Canvas 2D per D-020)
4. Reliable browser/OS metadata properties available without extra permissions. (Resolved per D-018)
5. Automatic cleanup default and retention period options. (Resolved by D-022, D-023, D-024, D-025: OFF by default, 7/30/90 days retention, complete report & screenshot deletion, multi-tab session locks)
6. Browser version support matrix and minimum supported Chromium versions (O-004, O-010).

## 11. Architecture approval gate
Before Phase 1 implementation begins, confirm:
- Scaffold build tooling and configuration.
- Local storage schema and IndexedDB helper.
- Annotation approach and rendering fidelity.
- Final permission declaration in `manifest.json`.

## 12. Design System & Core UI Components

BugSnap follows Apple-inspired interface guidelines, strict design tokens, and privacy-first local-only design principles. All controls use tokens from `src/shared/design-tokens.css` with no hardcoded hex/rgba values.

### 12.1 Header Button (`.header-pill-btn`)
- **Purpose:** Primary and secondary actions in the full-page editor header toolbar.
- **Variants:**
  - `btn-primary`: Filled accent (`--bs-accent`, text `--bs-text-on-accent`, shadow `--bs-shadow-sm`). Established as the single primary call-to-action in the header ("Copy Report").
  - `btn-secondary`: Neutral pill button (`--bs-bg-input`, border `--bs-border-subtle`, text `--bs-text-primary`). Used for secondary actions ("Copy Image", "Copy AI Prompt", "Page Context", "More").
  - `btn-danger-pill`: Destructive action pill used in confirmation contexts and overflow menus.
- **States:**
  - Default: Subtle border, neutral background.
  - Hover (`:hover`): Elevated brightness, `--bs-bg-hover`, border highlight.
  - Active (`:active`): Physical micro-interaction (`transform: scale(0.98)`).
  - Focus (`:focus-visible`): 3px outline `--bs-focus-ring` with 1px offset.
  - Disabled (`:disabled`): Opacity 0.45, `cursor: not-allowed`, no scale transform.
- **Sizes & Geometry:** Height 32px, horizontal padding 12px, gap 6px, font size `--bs-text-xs` (11px) with weight 600, pill radius `--bs-radius-full` (9999px token).
- **Accessibility:** Minimum touch/click target 32px height; full keyboard activation (Enter / Space); `aria-haspopup="menu"` and `aria-expanded` attributes on dropdown triggers.

### 12.2 Icon Button (`ThemeSwitcher`, header/stage toggles)
- **Purpose:** Compact single-purpose controls (theme cycling, panel collapse, overflow menu).
- **Variants:**
  - `icon-only`: Compact 32×32px circular or rounded icon-only button without visible text label.
  - `labeled`: Pill button containing an inline 14px or 16px SVG icon paired with a descriptive text label.
- **States:** Default, `:hover` (`--bs-bg-hover`), `:active` (`scale(0.97)`), `:focus-visible` (3px focus ring), `:disabled`.
- **Sizes:** 32×32px hit target, 14–16px vector stroke icons (`currentColor`, `strokeWidth: 2`).
- **Accessibility:** Mandatory `aria-label` and `title` providing clear accessible name (e.g. `Theme: Dark`, `Theme: System`, `More options`); inline SVGs carry `aria-hidden="true"`.

### 12.3 Contextual Alert (`.editor-alert`)
- **Purpose:** Highlighting feedback toasts, error explanations, and status banners.
- **Variants:**
  - Error (`.editor-alert-error`): Bordered `--bs-error-border`, background `--bs-error-bg`, text `--bs-error-text`.
  - Success (`.editor-alert-success`): Bordered `--bs-success-border`, background `--bs-success-bg`, text `--bs-success-text`.
  - Info / Notice (`.editor-alert-info`): Neutral elevated card with subtle border and text `--bs-text-secondary`.
- **Copy Structure:** Adheres strictly to the UX-copy discipline: *What happened*, *Why*, and *How to fix* (e.g., "Couldn't copy the report. Your browser blocked clipboard access. Use Export Report to save it as a file.").
- **States:**
  - Toast: Transient, auto-dismissed after 3500ms.
  - Persistent: Sticky inline alert until user remediation or dismissal.
- **Sizes:** Full width within containing column, padding 10px 14px, radius `--bs-radius-md` (8px), font `--bs-text-sm` (12px).
- **Accessibility:** Uses `role="alert"` (for errors) or `role="status"` (for copy confirmations) with `aria-live="polite"`.

### 12.4 Label / Value Row (`.metadata-item`)
- **Purpose:** Presenting captured evidence and system metadata in the Page Context inspector.
- **Layout & Hierarchy:** Vertically stacked (label directly above value), left-aligned to eliminate ragged right edges on multiline values.
- **Elements:**
  - `.metadata-label`: Uppercase, tracking `--bs-tracking-caps`, font size `--bs-text-xs` (11px), color `--bs-text-secondary` ensuring WCAG AA contrast (≥ 4.5:1) in both light and dark themes.
  - `.metadata-value`: Font size `--bs-text-sm` (12px), color `--bs-text-primary`. Normal text uses `overflow-wrap: break-word` to break on natural word boundaries. URL fields use `overflow-wrap: anywhere` and `word-break: break-all` with `--bs-font-mono`.
- **Variants:**
  - Text attribute: Title, platform, viewport size.
  - URL link: Selectable and navigable monospace link.
  - Evidence-based summary (`.metadata-summary`): Derived conditionally from real diagnostics or user title; omitted when redundant.
- **Accessibility:** Semantic HTML elements (`<span>`, `<strong>`, `<a>`); screen-reader friendly structure without ambiguous tabular layouts.
