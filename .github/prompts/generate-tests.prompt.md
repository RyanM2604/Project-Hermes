---
description: Generate focused behavioral tests for Project Hermes.
---

Generate tests for the Project Hermes behavior identified by the user.

Process:

1. Read `.github/copilot-instructions.md` and inspect the target code.
2. Identify the observable behavior, important invariants, and likely failure
   modes before writing tests.
3. Use the repository's existing test framework and conventions.
4. State the intended test files and wait for explicit user approval before
   creating or editing them.

Test requirements:

- Test behavior rather than implementation details.
- Include the expected success path and relevant validation, authorization,
  empty-state, and error paths.
- Add regression coverage for any reported bug.
- Use deterministic fixtures and avoid live external services.
- Do not include raw emails, auth tokens, OTPs, secrets, or real user
  interaction payloads in fixtures or snapshots.
- Do not add a test dependency or framework without approval.

Verification:

- Run the narrowest relevant test command first, then broader applicable checks.
- Confirm that new tests would fail if the intended behavior were broken.
- Report commands run, results, coverage gaps, and any required manual checks.
- Wait for explicit approval before committing.

