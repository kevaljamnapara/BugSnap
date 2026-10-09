# BugSnap Test Plan

**Status:** Planned tests. Results must be filled in only after tests are actually run.

## 1. Build and load
- [ ] Install dependencies using documented instructions.
- [ ] Run type checking (`tsc --noEmit`).
- [ ] Run linting (`eslint`).
- [ ] Run automated unit/component tests (`vitest run`).
- [ ] Run the production build.
- [ ] Load the output directory through `chrome://extensions` with Developer mode enabled.
- [ ] Confirm the extension loads without manifest errors.
- [ ] Confirm popup and full-page editor open.

## 2. Capture
- [ ] Capture a normal HTTPS webpage.
- [ ] Confirm screenshot matches the visible viewport.
- [ ] Confirm URL, title, and timestamp are accurate.
- [ ] Confirm unavailable metadata is omitted or marked unavailable without fabricating values.
- [ ] Attempt capture on a restricted browser page and verify a helpful error.
- [ ] Test active-tab changes and capture retries.
- [ ] Confirm capture is always user-triggered.

## 3. Report editor
- [ ] Create a report with all fields populated.
- [ ] Test each severity: Low, Medium, High, Critical.
- [ ] Test empty title and empty optional fields.
- [ ] Test long reproduction steps and notes.
- [ ] Test debounced autosave preserves input across typing pauses.
- [ ] Test editor reload (`F5`) restores draft state without creating duplicate drafts.
- [ ] Test accidental tab closure and verify draft remains recoverable in the reports list.
- [ ] Test "Discard Draft" action with confirmation dialog, verifying draft and screenshot are deleted from local storage.
- [ ] Confirm unsaved changes are not silently discarded.

## 4. Annotations
- [ ] Add, position, and remove a rectangle.
- [ ] Add, position, and remove an arrow.
- [ ] Add and edit text labels.
- [ ] Test screenshots at different dimensions and browser zoom levels.
- [ ] Compare the editor preview with the exported annotated image.

## 5. Persistence and management
- [ ] Save a report and reopen it.
- [ ] Restart Chrome and reopen the report.
- [ ] Update a report and verify changes persist.
- [ ] Delete a report after confirmation.
- [ ] Verify associated evidence is removed from BugSnap-managed storage.
- [ ] List both saved reports and recoverable abandoned drafts.
- [ ] Test missing/corrupt screenshot data.
- [ ] Test storage quota or write failure where practical.

## 6. Export
- [ ] Export Markdown report and verify it matches the canonical template.
- [ ] Verify matching, sanitized filename stems for Markdown (`.md`) and screenshot (`.png`).
- [ ] Verify separate downloadable files generated via browser-native Blob URLs (`<a download>`).
- [ ] Verify relative screenshot reference (`./<filename>-screenshot.png`) matches downloaded image.
- [ ] Verify screenshot file opens correctly and preserves annotations.
- [ ] Verify user Markdown input is safely formatted and escaped.
- [ ] Verify unavailable metadata is omitted rather than fabricated.
- [ ] Test browser multi-download permission prompt behavior.
- [ ] Test repeated exports and filename collisions.
- [ ] Test download failure handling.

## 7. Automatic cleanup
- [ ] Confirm cleanup is off by default, unless a different approved decision is documented.
- [ ] Verify enabling cleanup requires clear disclosure.
- [ ] Verify retention applies consistently to eligible saved reports and abandoned drafts.
- [ ] Verify reports currently being edited are strictly protected from cleanup.
- [ ] Verify associated evidence is handled consistently.
- [ ] Verify users are informed of cleanup failures.

## 8. Privacy and permissions
- [ ] Review every declared permission and its justification.
- [ ] Confirm the Chrome `downloads` permission is absent from `manifest.json`.
- [ ] Inspect the project for external network calls.
- [ ] Confirm no screenshot or report data is transmitted externally by default.
- [ ] Confirm no cookies, passwords, form values, or hidden page content are collected.
- [ ] Confirm restricted browser pages are not bypassed.
- [ ] Review screenshot-sharing privacy notice.

## 9. Quality
- [ ] Run TypeScript type checks (`tsc --noEmit`).
- [ ] Run ESLint with TypeScript support.
- [ ] Run Vitest test suite (unit tests for Markdown export, metadata sanitization, retention logic; RTL + jsdom component tests).
- [ ] Run the production build.
- [ ] Check browser console and extension service worker errors.
- [ ] Verify keyboard navigation and focus states.
- [ ] Verify responsive popup and editor layouts.
- [ ] Confirm every visible control works.
- [ ] Perform manual testing of real extension APIs in Chrome.

## 10. Browser matrix

| Browser | Version | Install/load | Capture | Save/reopen | Export | Result |
|---|---|---|---|---|---|---|
| Chrome desktop | To record | Not tested | Not tested | Not tested | Not tested | Pending |
| Microsoft Edge | To record | Not tested | Not tested | Not tested | Not tested | Pending |
| Brave | To record | Not tested | Not tested | Not tested | Not tested | Pending |

Do not claim a browser is supported until its relevant tests have passed.

## Test report template
- Build command and result:
- Browser/version:
- Test cases run:
- Passed:
- Failed:
- Not tested:
- Known defects:
- Privacy/permission findings:
- Evidence/logs:
- Release recommendation:
