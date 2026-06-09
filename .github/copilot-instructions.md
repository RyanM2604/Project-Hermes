# Project Hermes Repository Instructions

Project Hermes is a UWaterloo-focused campus discovery app for events, clubs,
free food, career events, hackathons, short-form event content, and personalized
recommendations.

## Working Rules

- Before creating, editing, deleting, or committing files, state the intended
  changes and wait for explicit user approval.
- Keep changes small, reviewable, and limited to the requested scope.
- Inspect existing code and follow established patterns before introducing new
  abstractions or dependencies.
- Do not make unrelated refactors.
- Explain assumptions and stop for clarification when a product, privacy, or
  authorization requirement is ambiguous.

## Technical Direction

- Write TypeScript by default.
- Use the Next.js App Router and the repository's existing conventions.
- Before changing Next.js code, read the relevant guide in
  `node_modules/next/dist/docs/` because this repository may use APIs newer than
  your training data.
- Use Supabase and PostgreSQL for authentication and application data.
- Keep server-only logic and secrets out of client components and browser
  bundles.
- Prefer simple, deterministic implementations before introducing complex
  recommendation or machine-learning systems.

## Privacy And Security

- Never log raw email addresses, authentication tokens, OTPs, secrets, or raw
  user interaction payloads.
- Minimize personal-data collection and do not assume access to official
  university student records.
- Enforce authorization on the server and in database policies where
  applicable. Never rely on hidden UI controls for authorization.
- Treat third-party event data and URLs as untrusted input.
- Do not expose service-role credentials or other privileged secrets to the
  browser.

## APIs And Data

- Every API route must validate all external input before using it.
- Return explicit, stable error responses without leaking sensitive details.
- Preserve database integrity and make ingestion or background jobs idempotent
  where retries are possible.
- Use source-specific adapters for ingestion rather than a single monolithic
  scraper.

## Testing And Verification

- Every feature must include tests or a documented manual test plan.
- Tests must verify observable behavior and should fail when that behavior is
  broken.
- Cover validation failures, authorization failures, empty states, and expected
  success paths when relevant.
- Run the repository's applicable lint, typecheck, test, and build commands
  before claiming work is complete. Clearly report any command that could not
  be run.

