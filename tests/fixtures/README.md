# BugSnap End-to-End Real-Browser Testing Fixture

This directory contains a lightweight, zero-dependency local test server and HTML playground designed to verify full error and network evidence capture inside a real Chromium browser.

## Files

- `error-server.mjs`: Zero-dependency Node.js HTTP server. Serves the playground and provides mock API endpoints (`/api/ok`, `/api/not-found`, `/api/error`).
- `error-playground.html`: Interactive web page with triggers for all 17 categories of runtime and network failures.

## Step-by-Step Manual Verification Checklist

### 1. Build the Extension
In your terminal, build the production extension bundle:
```bash
npm run build
```
Verify that the `dist/` folder is generated with `manifest.json`, `service-worker-loader.js`, and popup/editor assets.

### 2. Start the Local Error Server
Run the local HTTP test server:
```bash
node tests/fixtures/error-server.mjs
```
The server will start on `http://127.0.0.1:3000`.

### 3. Load the Unpacked Extension in Chrome
1. Open Google Chrome or Chromium.
2. Navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the `dist/` directory from this repository.
5. Confirm that **BugSnap** appears in your extension list with permissions: `activeTab`, `storage`, `scripting`.

### 4. Start the Error Debug Session
1. Navigate to: `http://127.0.0.1:3000/error-playground.html`
2. Open Chrome DevTools (`Cmd + Option + I` or `F12`) to the Console tab.
3. Click the **BugSnap** icon in the Chrome toolbar.
4. Verify the popup button text: **Start Error Session** with description:
   *"Record console errors and failed network calls on this tab until you stop."*
5. Click **Start Error Session**. A new Editor tab opens in the background while BugSnap captures the tab.

### 5. Trigger Test Actions
Return to the `error-playground.html` tab and click each test button:
- [ ] **1. Uncaught Exception**: `ReferenceError: PaymentProvider is not defined`
- [ ] **2. Unhandled Rejection**: `Error: Auth token renewal failed: 401 Unauthorized`
- [ ] **3. console.error(string)**: Formatted printf string with placeholders `%d` and `%s`
- [ ] **4. console.error(Error)**: `TypeError: Cannot read properties of null` with stack trace
- [ ] **5. console.error(Nested Object)**: Object with `user`, `state`, and circular reference `self`
- [ ] **6. console.warn()**: Deprecation warning
- [ ] **7. fetch() 200 OK**: Successful resource call (`/api/ok`)
- [ ] **8. fetch() 404 Not Found**: Failed fetch with status 404 (`/api/not-found`)
- [ ] **9. fetch() 500 with Error JSON**: Failed fetch with status 500 and response body snippet (`{"code": 500, ...}`)
- [ ] **10. fetch() Rejected**: Thrown network error (`TypeError: Failed to fetch`) to closed port `59999`
- [ ] **11. XHR 500 Error**: XMLHttpRequest failing with status 500
- [ ] **12. XHR Network Error**: XMLHttpRequest failing to connect to closed port `59999`
- [ ] **13. Missing Image**: `<img src="/static/images/missing-avatar-404.png">` triggering capturing window error
- [ ] **14. Missing Script**: `<script src="/static/js/non-existent-chunk.js">` triggering capturing window error
- [ ] **15. CSP Violation**: Dispatched `securitypolicyviolation` event for blocked URI
- [ ] **16. Burst of 200 Errors in 100ms**: Rapid burst of 200 `console.error` calls
- [ ] **17. 10,000 Char Error Message**: Long message demonstrating explicit `[truncated N chars]` formatting

### 6. Stop and Verify in Editor
1. Switch to the BugSnap Editor tab.
2. In the top toolbar, click **Stop Session**.
3. Under **Diagnostics & Session Data** in the right sidebar:
   - Check the counts: verify that all errors and warnings were recorded.
   - Expand **Not Captured & Limitations**: verify the honest boundary disclosures.
4. Click **Copy Report** and paste into a Markdown viewer or text editor:
   - Confirm EVERY error from steps 1–17 is present with its full message and details.
   - Confirm the 500 fetch includes the response body snippet `Database connection failed`.
   - Confirm the 10,000 char message ends with `[truncated 6000 chars]` (capped at 4000).
   - Confirm the burst of 200 errors contains all 200 entries (or an exact dropped notice if buffer cap was exceeded).
5. Click **Copy AI Prompt** and paste into a text editor:
   - Confirm that the AI prompt contains the exact same error entries and counts as the report.
   - Confirm all messages and stacks are rendered within fenced code blocks.
   - Confirm the **Untrusted Data Notice** is present at the top of the prompt evidence.
