# BugSnap Decision Log

Record approved product and technical decisions here. Do not treat recommendations as approved until the user confirms them.

## Confirmed product decisions

| ID | Decision | Status |
|---|---|---|
| D-001 | Product is a browser extension called BugSnap for reproducible bug reports. | Confirmed |
| D-002 | Target users are developers and QA testers. | Confirmed |
| D-003 | Capture is initiated explicitly by the user; no automatic/background capture. | Confirmed |
| D-004 | Report editor opens as a full-page browser tab. | Confirmed |
| D-005 | Severity levels are Low, Medium, High, Critical. | Confirmed |
| D-006 | Intended browser family is Chromium-based desktop browsers. | Confirmed |
| D-007 | Chrome is the initial development/test target; other browsers require validation. | Confirmed |
| D-008 | Automatic cleanup is optional. | Confirmed |
| D-009 | Budget is ₹0; use Antigravity and Claude free chat. | Confirmed |
| D-010 | No backend, account, cloud sync, paid API, or AI inference in MVP. | Confirmed |
| D-011 | Reports/screenshots remain local unless the user explicitly exports them. | Confirmed |
| D-012 | No commits, pushes, PRs, merges, or destructive Git operations without explicit approval. | Confirmed |
| D-013 | Draft persistence and recovery: Save captured reports as local drafts with stable IDs; persist edits via debounced autosave; restore on reload or closure without duplicates; provide explicit Discard Draft confirmation; keep abandoned drafts recoverable; protect actively edited reports from cleanup. | Confirmed |
| D-014 | Canonical Markdown export: Generate reports matching the approved Markdown template with matching sanitized filename stems, relative screenshot references, and safe text formatting. Export Markdown and screenshot as separate files. | Confirmed |
| D-015 | Download mechanism: Use browser-native Blob URLs via `<a download>` links. Do not request the Chrome `downloads` permission for MVP. Document browser multi-download permission prompt limitation. | Confirmed |
| D-016 | Testing strategy: TypeScript type checking (`tsc --noEmit`), ESLint with TypeScript support, Vitest, React Testing Library, and jsdom with focused Chrome API mocks. Real extension APIs verified through manual testing in Chrome. | Confirmed |
| D-017 | Extension build tooling: Selected `@crxjs/vite-plugin` (v3.0.0). Rationale: minimal dependency footprint, robust Manifest V3 module bundling, seamless HTML entry point resolution, and direct compatibility with Vitest. | Confirmed |
| D-018 | Tab metadata collection: Collect tab URL, title, capture timestamp, and visible viewport dimensions (width × height from active tab) where accessible via activeTab; omit unavailable fields without fabricating fallback values. | Confirmed |
| D-019 | Local draft storage implementation: Native browser IndexedDB ('bugsnap_db') with object store 'reports' keyed by stable draft ID. Debounced autosave (400ms) with visible Saving/Saved/Error indicators and form preservation during storage errors. | Confirmed |

## Open decisions

| ID | Question | Current recommendation | Status |
|---|---|---|---|
| O-001 | Should automatic cleanup be enabled by default? | Off by default | Awaiting approval |
| O-002 | Which retention periods should be offered? | 7, 30, and 90 days | Awaiting approval |
| O-003 | What should cleanup delete? | Complete eligible BugSnap reports and abandoned drafts; strictly protect reports currently being edited | Awaiting approval |
| O-004 | Which browsers are release targets? | Chrome first; test Edge and Brave separately | Needs version/test matrix |
| O-005 | Which screenshot format is required? | PNG initially (exported separately via native Blob links per D-014/D-015) | Proposed |
| O-006 | How should capture data reach the editor? | Resolved by D-013: IndexedDB draft record with stable draft ID passed to editor URL (`editor.html?id=<draftId>`) | Resolved (D-013) |
| O-007 | Which local storage design should be used? | Resolved by D-019: Native browser IndexedDB ('bugsnap_db') for report records and screenshots | Resolved (D-019) |
| O-008 | How should annotation be implemented? | Compare maintained library versus small custom implementation | Architecture review |
| O-009 | Which metadata is reliably available? | Resolved by D-018: URL, title, captured timestamp, and viewport dimensions via activeTab; omit unavailable | Resolved (D-018) |
| O-010 | Which minimum browser versions are supported? | Decide after API and compatibility review | Open |

## Change procedure
When a decision changes, record the date, old decision, new decision, reason, affected documents, and migration/testing impact. Update the PRD and architecture as needed.
