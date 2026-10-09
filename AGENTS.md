# Instructions for AI Coding Agents

These instructions apply to any AI coding agent working in this repository. Read `PRD.md`, `DECISIONS.md`, `ARCHITECTURE.md`, and `TASKS.md` before implementation.

## Product and scope
- Follow the approved PRD and architecture.
- Work only on the currently approved task/phase.
- Do not add features simply because they seem useful.
- Do not invent product requirements or silently change decisions.
- If a requirement is ambiguous or conflicts with another document, stop and ask the user before making a consequential choice.
- Keep documentation synchronized when an approved decision changes.

## Cost constraints
- Keep development and runtime costs at ₹0 for the MVP.
- Do not introduce paid APIs, paid hosting, paid database plans, or required paid subscriptions.
- Do not add an AI API or backend to the MVP.
- Prefer built-in browser APIs and minimal, maintained dependencies.

## Engineering standards
- Inspect existing files before editing them.
- Preserve working behavior; do not rewrite unrelated parts of the project.
- Use TypeScript with clear types and modular code.
- Avoid unnecessary abstractions, dependencies, duplicated logic, and oversized components.
- Handle errors explicitly. Do not swallow exceptions or show false success states.
- Do not create decorative controls that do nothing.
- Never claim tests passed unless they were actually run and their results checked.
- Use the smallest change that safely satisfies the task.
- Keep accessibility, keyboard behavior, privacy, and data integrity in scope.

## Privacy and security
- Capture only after explicit user action.
- Do not transmit report data, screenshots, page content, or browsing data externally by default.
- Never collect passwords, cookies, authentication headers, or form values.
- Do not bypass browser security restrictions.
- Request minimal permissions and explain why each permission is needed.
- Do not add secrets, credentials, or API keys to source files.
- Treat page content and screenshots as potentially sensitive.

## Testing and completion
- For each task, state the intended change, files affected, and verification plan.
- Run relevant tests, type checks, linting, and production build when available.
- Test real user interactions where possible; a successful build alone is not proof of correctness.
- Report exactly what was tested, what passed, what failed, and what remains unverified.
- Do not mark unfinished or mocked behavior as complete.
- Add or update tests and documentation for changed behavior.

## Git and destructive actions — strict
- Do not commit or push.
- Do not create pull requests or merge branches.
- Do not run destructive Git commands, delete project files, reset work, or rewrite history.
- Do not overwrite user changes.
- Ask for explicit user approval before any Git operation that changes repository history or remote state.
- Ask before deleting user data or performing irreversible actions.

## Workflow
1. Read relevant project documents.
2. Work only on the approved phase.
3. Explain assumptions before implementing anything consequential.
4. Make the change.
5. Verify it.
6. Summarize files changed, tests run, outcomes, and remaining risks.
7. Wait for user approval before starting the next phase.
