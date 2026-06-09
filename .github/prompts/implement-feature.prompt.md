---
description: Implement a small, well-scoped Project Hermes feature.
---

Implement the Project Hermes feature described by the user.

Before editing:

1. Read `.github/copilot-instructions.md` and applicable repository guidance.
2. Inspect the relevant existing code and tests.
3. State the intended files and behavior changes.
4. Wait for explicit user approval before creating, editing, or deleting files.

Implementation requirements:

- Keep the change small and limited to the requested feature.
- Use TypeScript and existing Next.js App Router conventions.
- Validate all external input at the API boundary.
- Enforce authorization on the server and in database policies where needed.
- Never log raw emails, auth tokens, OTPs, secrets, or raw interaction payloads.
- Avoid new dependencies unless they are necessary and approved.
- Add focused tests for the feature, or document a concrete manual test plan
  when automated testing is not currently possible.

Before completion:

1. Review the diff for unrelated changes and privacy or security risks.
2. Run the applicable lint, typecheck, test, and build commands.
3. Report changed files, verification results, and any remaining risks.
4. Wait for explicit approval before committing.

