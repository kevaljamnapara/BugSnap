# BugSnap Privacy Policy

*Last updated: October 17, 2026*

BugSnap ("we", "our", or "the extension") is an open-source, privacy-first Chromium browser extension designed for developers and QA engineers to document, reproduce, and report software bugs.

We believe that debugging evidence should remain under your complete control. This Privacy Policy outlines our data handling practices, explaining what information BugSnap processes, where it is stored, and how your privacy is protected.

---

## 1. Core Privacy Principles

- **100% Local Processing:** All screenshot capturing, diagnostic collection, annotation, and report generation take place entirely on your device.
- **Zero External Transmission:** BugSnap does not operate a backend server, does not include analytics or tracking scripts, and never transmits your data to any remote server or third party.
- **User-Initiated Action Only:** BugSnap never captures screenshots, console logs, or page contents in the background. Processing only occurs when you explicitly initiate an action.
- **Local AI Prompt Generation:** When you use the "Copy AI Prompt" feature, the formatted prompt is assembled entirely on your local machine using client-side JavaScript. No data is sent to OpenAI, Anthropic, Google, or any external AI API.

---

## 2. Information We Process

BugSnap processes the following data only when explicitly initiated by the user:

### A. Visual Evidence
- **Screenshots:** When you click **Capture Viewport** or **Select Region**, BugSnap captures visible image pixels of the active tab using standard browser APIs (`chrome.tabs.captureVisibleTab`).
- **Annotations:** Any drawing, text, arrows, or blur annotations you apply in the report editor are rendered locally onto the image canvas.

### B. Environment & Page Metadata
- **URL & Page Title:** Captured at the moment of screenshot creation to document the defect location.
- **Viewport Dimensions & Platform:** Browser window dimensions and OS platform are read to assist in defect reproduction.

### C. Diagnostic Error Data (Opt-In Error Sessions)
- When you explicitly click **Start Error Session**, BugSnap attaches temporary hooks to the active tab to record:
  - Console errors (`console.error`) and warnings (`console.warn`)
  - Uncaught JavaScript runtime exceptions and unhandled Promise rejections
  - Content Security Policy (CSP) violation directives
  - Failed network requests (HTTP 4xx/5xx status codes and network drops for `fetch` and `XMLHttpRequest`)
  - Subresource loading failures (failed `<script>`, `<link>`, or `<img>` elements)
- **Ring Buffer Storage:** Recorded events are stored in a bounded local ring buffer.
- **Request Bodies & Sensitive Headers:** BugSnap **never** captures network request bodies, response payloads, authentication headers, cookies, or form field passwords.

### D. User-Authored Bug Reports
- Titles, severity levels, reproduction steps, expected behavior, actual behavior, and custom notes that you type into the editor.

---

## 3. Data Redaction & Sanitization

Before bug reports or diagnostic evidence are exported or copied to your clipboard:
- BugSnap executes an automated local redaction pass.
- Known patterns for sensitive information—including Bearer tokens, JWT tokens, API keys, basic authentication credentials, and sensitive query parameters—are automatically replaced with sanitization placeholders (e.g., `[REDACTED]`).
- You are provided with a full evidence review in the editor to inspect, modify, or exclude any captured information prior to sharing.

---

## 4. Data Storage & Retention

- **Local Storage:** All drafts, completed reports, and screenshots are stored exclusively on your machine using standard browser storage mechanisms (IndexedDB for image data and `chrome.storage.local` for report metadata).
- **Retention Control:** You retain full control over data retention. You can delete any individual report or clear all drafts directly from the BugSnap editor.
- **Uninstall:** If you remove or uninstall BugSnap from your browser, all data stored in the extension's local storage is immediately and permanently purged by Chromium.

---

## 5. Chrome Permissions Justification

In accordance with Google Chrome Web Store policies, BugSnap requests the minimum permissions necessary to deliver its core functionality:

| Permission | Purpose & Justification |
| :--- | :--- |
| `activeTab` | Grants temporary access to the active tab when you click the BugSnap icon, allowing visible screenshot capture and reading the active page's URL and title without broad host permissions. |
| `storage` | Enables BugSnap to persist user drafts, bug reports, and diagnostic records locally on your device across browser restarts using `chrome.storage.local` and IndexedDB. |
| `scripting` | Allows BugSnap to inject the interactive region-selection overlay and the optional opt-in debug session hooks into the active tab upon your explicit request. |

BugSnap does **not** request broad host permissions (e.g., `<all_urls>`), does not request the `webRequest` or `debugger` permissions, and does not request background browsing permissions.

---

## 6. Third-Party Sharing and Remote Services

BugSnap **does not sell, rent, trade, or transmit** your personal data, screenshots, or browsing activity to any third parties. There are no remote tracking services, third-party CDNs, advertising networks, or analytics providers integrated into BugSnap.

When you use export options (such as "Copy Report", "Copy AI Prompt", "Download Markdown", or "Download ZIP"), the output is copied to your local clipboard or downloaded directly to your local file system via browser-native download links. Where and how you share that exported file is entirely up to you.

---

## 7. Open Source & Verifiability

BugSnap is open-source software. You can inspect the complete source code, audit the data flows, and verify our zero-transmission promise on GitHub:
[https://github.com/kevaljamnapara/BugSnap](https://github.com/kevaljamnapara/BugSnap)

---

## 8. Changes to this Policy

If we modify our privacy practices or if future features require changes, this document will be updated in the repository, and the revision date will be updated accordingly.

---

## 9. Contact Us

If you have any questions, feedback, or concerns regarding this Privacy Policy or BugSnap's data handling practices, please open an issue on our GitHub repository:
[https://github.com/kevaljamnapara/BugSnap/issues](https://github.com/kevaljamnapara/BugSnap/issues)
