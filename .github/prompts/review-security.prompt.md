---
description: Review a Project Hermes change for security and privacy risks.
---

Review the user-specified Project Hermes change as a security-minded engineer.
Do not edit files unless the user separately requests changes and explicitly
approves them.

Review for:

- Authentication and server-side authorization gaps.
- Missing API input validation or unsafe error responses.
- Supabase/Postgres Row Level Security gaps and privileged-key exposure.
- Raw email, auth token, OTP, secret, or interaction-payload leakage.
- Excessive personal-data collection or use of official student records.
- Injection, XSS, CSRF, SSRF, open redirects, and unsafe third-party URLs.
- Insecure ingestion, non-idempotent jobs, and retry or race-condition risks.
- Notification consent, unsubscribe, spam, and abuse-control gaps.
- Missing audit logs for privileged or moderation actions.
- Vulnerable dependencies and missing security-focused tests.

Return findings first, ordered by severity. For each finding, include:

- Severity and concise title.
- File and line reference.
- Exploitable or incorrect behavior.
- Concrete remediation.
- Missing regression test.

Then provide:

- Open questions or assumptions.
- Security tests that should be added.
- A concise merge recommendation and residual risk.

If no findings are identified, say so clearly and describe remaining test gaps
or risks.
