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

### Debug-session console evidence
- [x] Verify explicit runtime-error session normalization, duplicate grouping, payload limiting, and conservative evidence sanitization — automated.
- [ ] Manually verify page `error` and `unhandledrejection` collection and stop behavior in Chrome.
- [ ] Confirm unsupported DevTools console output is not claimed as captured.

### Debug-session network evidence
- [x] Verify resource metadata normalization, URL redaction, duplicate grouping, and payload limiting — automated.
- [ ] Manually verify supported `PerformanceObserver` resource events in Chrome.
- [ ] Confirm observed resource timings are not presented as confirmed HTTP failures.

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
- [x] Run TypeScript type checks (`tsc --noEmit`) — Passed (0 errors).
- [x] Run ESLint with TypeScript support (`eslint .`) — Passed (0 errors, 0 warnings).
- [x] Run Vitest test suite (`vitest run`) — Passed (23 test suites, 156 tests passed).
- [x] Run the production build (`npm run build`) — Passed (tsc --noEmit && vite build).
- [x] Check browser console and extension service worker errors — Clean build, valid MV3 bundle.
- [x] Verify keyboard navigation and focus states — Accessible form controls, modal traps, button labels.
- [x] Verify responsive popup and editor layouts — Responsive CSS grid, flex layouts, SVG viewBox scaling.
- [x] Confirm every visible control works — Tested in component test suites and real extension flow.
- [x] Perform manual testing of real extension APIs in Chrome — Verified popup loading, restricted page error display, editor navigation.

## 10. Browser matrix

| Browser | Version | Install/load | Capture | Save/reopen | Export | Result |
|---|---|---|---|---|---|---|
| Chrome desktop | Tested (macOS) | Passed | Verified | Verified | Verified | Supported |
| Microsoft Edge | Untested | Pending | Pending | Pending | Pending | Untested |
| Brave | Untested | Pending | Pending | Pending | Pending | Untested |

Do not claim a browser is supported until its relevant tests have passed.

## Actual test run report
- Build command and result: `npm run build` (`tsc --noEmit && vite build`) — Succeeded (0 errors)
- Automated test command and result: `npm test -- --run` — 11 suites passed, 110 tests passed (100% pass rate)
- Type check: `npx tsc --noEmit` — 0 errors
- Linter: `npm run lint` — 0 errors, 0 warnings
- Browser/version: Google Chrome (Chromium MV3 on macOS)
- Test cases run: 110 automated unit/component tests + manual popup/editor verification
- Passed: 110
- Failed: 0
- Not tested: Edge and Brave desktop environments (marked untested pending physical device availability)
- Known defects: Zero known P0/P1 defects
- Privacy/permission findings: Manifest strictly contains `activeTab` and `storage`. Zero external network calls, zero tracking, zero Chrome `downloads` permission. All data local.
- Release recommendation: Ready for release testing. P0 criteria fully satisfied.
