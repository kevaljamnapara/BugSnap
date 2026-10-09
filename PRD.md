# BugSnap — Product Requirements Document

**Version:** 0.3  
**Status:** Draft — draft recovery, canonical export, download mechanism, and testing strategy incorporated  
**Date:** October 2026  
**Product type:** Privacy-first Chromium-based browser extension  
**Budget:** ₹0 development budget

## 1. Product overview

BugSnap helps developers and QA testers turn website bugs into structured, reproducible bug reports. Users manually initiate capture, review a screenshot and available page metadata, document the issue, annotate visual evidence, save the report locally, and export a professional Markdown report with associated screenshot evidence.

The MVP must work without a backend, account, paid API, or cloud database.

## 2. Problem

Reporting website bugs often requires manually collecting screenshots, URLs, browser details, reproduction steps, expected results, and actual results. Reports can be incomplete or inconsistent, making defects difficult to reproduce.

BugSnap centralizes this workflow.

## 3. Target users

### Web developers
- Document defects discovered during development or debugging.
- Record unexpected behavior and supporting evidence.
- Share reproducible issues with teammates.

### QA testers
- Document defects found during manual testing.
- Use consistent report fields and severity levels.
- Export evidence for existing issue-tracking workflows.

## 4. Product principles

1. Capture only after explicit user action.
2. Privacy-first and local-first data handling.
3. No paid service required for core functionality.
4. Reports must not invent missing information.
5. Professional, accessible interface design.
6. Incremental implementation with verifiable acceptance criteria.

## 5. MVP scope

### P0 — Required functionality

**Capture**
- Capture the visible area of the active tab after an explicit user action.
- Record page URL, title, capture timestamp, and available browser information. Omit unavailable metadata rather than fabricating values.
- Assign a stable draft ID and persist the initial capture record and screenshot in local storage.
- Display a useful error and retry option when capture fails.

**Report editor**
- Open a dedicated full-page report editor in a browser tab using the draft ID (`editor.html?id=<draftId>`).
- Display the captured screenshot and metadata.
- Support these fields:
  - Bug title
  - Severity
  - Reproduction steps
  - Expected behavior
  - Actual behavior
  - Additional notes
- Support screenshot annotations: rectangles, arrows, and text labels.
- Support full draft lifecycle:
  - Save changes locally using debounced autosave to prevent data loss.
  - Restore drafts cleanly upon editor reloads (`F5`) or accidental tab closure.
  - Prevent duplicate drafts when reopening or reloading the editor.
  - Provide an explicit "Discard Draft" action with a confirmation dialog to permanently delete unexported drafts and evidence.
  - Keep abandoned drafts recoverable in the report management list.
  - Protect reports and drafts currently being edited from automatic cleanup.
- Allow users to save, reopen, edit, and delete reports.

**Severity**
- Low
- Medium
- High
- Critical

**Export**
- Generate a structured Markdown report adhering to the canonical report template below.
- Keep the Markdown report and screenshot as separate downloadable files.
- Use matching, sanitized filename stems for both files:
  - Format: `bugsnap-<title-slug>-<YYYYMMDD-HHmmss>.md` and `bugsnap-<title-slug>-<YYYYMMDD-HHmmss>-screenshot.png` (fallback: `bugsnap-report-<YYYYMMDD-HHmmss>`).
- Include accurate screenshot references in Markdown (`![Annotated Screenshot](./<filename>-screenshot.png)`).
- Safely format and escape user-provided Markdown content where necessary.
- Preserve actual user-entered content and metadata; omit unavailable metadata instead of inventing values.
- Download mechanism: Use browser-native Blob URLs via `<a download>` links. Do not require the Chrome `downloads` permission for MVP.
- Document the limitation that browsers may prompt the user for permission when downloading multiple files in sequence.

#### Canonical Markdown Report Template
```markdown
# [BugSnap] <Bug Title>

| Property | Value |
| :--- | :--- |
| **Severity** | <Critical | High | Medium | Low> |
| **Captured** | <YYYY-MM-DD HH:mm:ss UTC> |
| **Page URL** | [<Page URL>](<Page URL>) |
| **Page Title** | <Page Title> |
| **Browser / OS** | <Browser Name & Version> / <OS Platform> |
| **Viewport Size** | <Width>x<Height> |

## Visual Evidence
![Annotated Screenshot](./<base-slug>-screenshot.png)

## Reproduction Steps
1. <Step 1>
2. <Step 2>
3. <Step 3>

## Expected Behavior
<Description of expected behavior>

## Actual Behavior
<Description of actual behavior>

## Additional Notes
<User-entered notes or "None">

---
*Report generated locally with BugSnap (₹0, privacy-first).*
```

**Local persistence**
- Save reports, drafts, and evidence locally in browser storage (IndexedDB).
- Retain reports and recoverable abandoned drafts across ordinary browser restarts, subject to browser storage behavior.
- Support reopening saved reports and resuming drafts.
- Protect reports currently being edited from automatic cleanup.
- Handle storage failures without silently losing work.

### P1 — Required quality
- Polished, consistent popup and full-page editor.
- Responsive layout and accessible keyboard navigation.
- Clear loading, success, empty, and error states.
- Minimal browser permissions.
- Privacy disclosure and safe handling of captured evidence.
- Documented manual testing and release checks.

## 6. Out of scope for MVP

- AI-generated reports or paid AI APIs.
- Accounts, cloud synchronization, or shared dashboards.
- Team collaboration.
- Automatic bug detection or background monitoring.
- GitHub, Jira, or Linear integrations.
- Full-page screenshot capture.
- Video recording or network HAR collection.
- Automatic console-history collection.
- Backend services or hosted database.

These may be considered after the core workflow is validated.

## 7. Primary user flow

1. User encounters a website bug.
2. User clicks the BugSnap extension.
3. User explicitly initiates screenshot capture.
4. BugSnap captures the visible tab and available metadata.
5. BugSnap opens the full-page report editor.
6. User enters title, severity, reproduction steps, expected behavior, and actual behavior.
7. User optionally annotates the screenshot.
8. User saves the report locally.
9. User exports Markdown and screenshot.
10. User shares the files through an existing workflow.

BugSnap must not silently capture browsing activity.

## 8. Report management flow

Users can list saved reports and recoverable abandoned drafts, open a report or draft, edit and save it, export it, and delete it after confirmation. Unsaved changes must not be silently discarded. Provide an explicit Discard Draft action with a confirmation dialog.

## 9. Functional acceptance criteria

- **FR-01 Capture:** A permitted active tab can be captured through explicit user action. Failures produce understandable errors and a retry option. Capture assigns a stable draft ID and persists evidence locally.
- **FR-02 Metadata:** Available page/browser metadata is recorded accurately. Unavailable information is identified or omitted rather than fabricated.
- **FR-03 Editor:** The dedicated editor supports all required fields, all four severity levels, debounced autosave, draft restoration on reload/reopen, and an explicit Discard Draft confirmation action.
- **FR-04 Annotation:** Rectangles, arrows, and text can be placed on screenshots, and the exported image preserves annotations.
- **FR-05 Export:** Markdown output adheres to the canonical template with matching, sanitized filename stems and an accurate reference to the corresponding screenshot. Files are exported as separate downloads via browser-native Blob URLs without requiring the Chrome `downloads` permission.
- **FR-06 Persistence:** Saved reports and abandoned drafts remain available after ordinary browser restarts, subject to browser storage retention. Reports currently being edited are protected from automatic cleanup.
- **FR-07 Management:** Reports and drafts can be listed, opened, updated, exported, and deleted.
- **FR-08 Cleanup:** If automatic cleanup is enabled, eligible saved reports and abandoned drafts are deleted according to the configured retention policy. Reports currently being edited are strictly protected. Behavior and consequences must be disclosed.
- **FR-09 Privacy:** Report contents and screenshots are not transmitted externally by default. The Chrome `downloads` permission is not requested for MVP.
- **FR-10 Compatibility:** The extension builds and passes its defined tests on selected Chromium-based browsers.
- **FR-11 Reliability:** Known critical data-loss and workflow failures are resolved before release.

## 10. Privacy and security

- Capture only after explicit user action.
- Do not collect passwords, cookies, authentication headers, or form values.
- Do not collect hidden page content or network request bodies.
- Do not transmit screenshots, reports, or browsing data externally by default.
- Request only permissions needed by approved features. Do not request the Chrome `downloads` permission; use browser-native download links.
- Explain that screenshots may contain sensitive information; remind users to review evidence before sharing.
- Never include credentials or API keys in source code.
- Explain local deletion and automatic cleanup behavior.
- Deleting a local report does not delete copies already exported by the user.
- Handle restricted browser pages using supported browser APIs; do not bypass browser security controls.

## 11. Browser compatibility

The intended platform is Chromium-based desktop browsers. Chrome is the initial development and verification target. Additional browsers such as Microsoft Edge and Brave require explicit compatibility checks before being declared supported.

Browser API behavior, manifest compatibility, permissions, storage, and extension lifecycle differences must be considered.

## 12. Technical constraints

- React and TypeScript for the interface.
- Vite with compatible extension build tooling.
- Manifest V3 APIs where supported.
- Local browser storage; IndexedDB may be used for screenshot-heavy records.
- Testing stack: TypeScript type checking (`tsc --noEmit`), ESLint with TypeScript support, Vitest, React Testing Library, and jsdom with focused Chrome API mocks. Real extension APIs verified through manual testing in Chrome.
- No backend, authentication, paid API, or hosted database for the MVP.
- Use Antigravity for implementation and Claude free chat for planning/review.
- No Git commits, pushes, pull requests, or merges without explicit authorization.
- Exact libraries and storage schema are architecture decisions, not assumed facts.

## 13. Success metrics

Release targets, not claimed achievements:
- All defined P0 workflows pass manual verification.
- No known reproducible silent report/evidence loss in the release test suite.
- No unintended external transmission of private report data.
- Production build succeeds.
- Extension loads and functions in the tested browser.
- All core controls perform their advertised actions.
- Exported reports are understandable without BugSnap.

## 14. Development workflow

1. Finalize PRD.
2. Approve AI engineering instructions.
3. Document architecture and technical decisions.
4. Create a phased implementation plan.
5. Implement one phase at a time.
6. Run builds and verify acceptance criteria.
7. Complete regression, privacy, and compatibility testing.
8. Approve release only after verification.

Scope changes require explicit review and documentation updates.

## 15. Release definition

The MVP is ready when a user can capture a permitted website, complete a report in the full-page editor, annotate and save evidence, reopen the report, and export usable Markdown and screenshot files without paid services, while meeting privacy, reliability, and compatibility requirements.
