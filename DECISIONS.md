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

## Open decisions

| ID | Question | Current recommendation | Status |
|---|---|---|---|
| O-001 | Should automatic cleanup be enabled by default? | Off by default | Awaiting approval |
| O-002 | Which retention periods should be offered? | 7, 30, and 90 days | Awaiting approval |
| O-003 | What should cleanup delete? | Complete eligible BugSnap report and associated evidence | Awaiting approval |
| O-004 | Which browsers are release targets? | Chrome first; test Edge and Brave separately | Needs version/test matrix |
| O-005 | Which screenshot format is required? | PNG initially | Proposed |
| O-006 | How should capture data reach the editor? | Evaluate supported messaging and temporary local draft options | Architecture review |
| O-007 | Which local storage design should be used? | Evaluate IndexedDB for screenshot data and appropriate storage for settings | Architecture review |
| O-008 | How should annotation be implemented? | Compare maintained library versus small custom implementation | Architecture review |
| O-009 | Which metadata is reliably available? | Collect only metadata supported without unnecessary permissions | Verify APIs |
| O-010 | Which minimum browser versions are supported? | Decide after API and compatibility review | Open |

## Change procedure
When a decision changes, record the date, old decision, new decision, reason, affected documents, and migration/testing impact. Update the PRD and architecture as needed.
