# Live Event Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch, normalize, validate, deduplicate, and output live UW and WUSA event data without database writes.

**Architecture:** Source-specific parsers implement a shared ingestion source contract. A safe fetcher and source-agnostic coordinator produce a structured run result that can later be passed to a Prisma persistence sink.

**Tech Stack:** TypeScript, Zod, Cheerio, Vitest, Node Fetch, tsx

---

### Task 1: Runtime Contracts And Deduplication

**Files:**
- Create: `src/ingestion/schema.ts`
- Create: `src/ingestion/types.ts`
- Create: `src/ingestion/dedupe-events.ts`
- Test: `src/ingestion/__tests__/schema.test.ts`
- Test: `src/ingestion/__tests__/dedupe-events.test.ts`

- [ ] Write failing tests proving valid candidates pass, invalid candidates are rejected, and exact/cross-source duplicates retain the first source.
- [ ] Run `npm test -- src/ingestion/__tests__/schema.test.ts src/ingestion/__tests__/dedupe-events.test.ts` and confirm missing-module failures.
- [ ] Implement Zod schemas, run-result types, and deterministic deduplication.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: Safe Source Fetching

**Files:**
- Create: `src/ingestion/fetch-source.ts`
- Test: `src/ingestion/__tests__/fetch-source.test.ts`

- [ ] Write failing tests for successful text retrieval, HTTP errors, unexpected content types, oversized responses, and timeouts.
- [ ] Run `npm test -- src/ingestion/__tests__/fetch-source.test.ts` and confirm the missing-module failure.
- [ ] Implement a dependency-injected fetcher with constrained error codes and no raw-payload logging.
- [ ] Re-run the focused test and confirm it passes.

### Task 3: Public Source Parsers

**Files:**
- Create: `src/ingestion/sources/wusa-ics.ts`
- Create: `src/ingestion/sources/uwaterloo-html.ts`
- Create: `src/ingestion/sources/registry.ts`
- Create: `src/ingestion/__fixtures__/wusa-events.ics`
- Create: `src/ingestion/__fixtures__/uwaterloo-events.html`
- Test: `src/ingestion/__tests__/sources.test.ts`

- [ ] Write focused fixtures and failing tests for normalized events, fallbacks, tags, timezone conversion, folded ICS lines, and malformed UW dates.
- [ ] Run `npm test -- src/ingestion/__tests__/sources.test.ts` and confirm the missing-module failure.
- [ ] Implement both source parsers and register their live public URLs.
- [ ] Re-run the focused test and confirm it passes.

### Task 4: Pipeline And CLI

**Files:**
- Create: `src/ingestion/run-ingestion.ts`
- Create: `src/ingestion/index.ts`
- Create: `src/ingestion/cli.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `src/ingestion/__tests__/run-ingestion.test.ts`

- [ ] Write a failing test proving source failures are isolated and valid events are validated and deduplicated.
- [ ] Run `npm test -- src/ingestion/__tests__/run-ingestion.test.ts` and confirm the missing-module failure.
- [ ] Implement the coordinator, public exports, CLI, and `ingest:events` script.
- [ ] Install `tsx` as a development dependency.
- [ ] Re-run the focused test and confirm it passes.

### Task 5: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npx tsc --noEmit --pretty false`.
- [ ] Run `npm run build`.
- [ ] Run `npm run ingest:events` against the live public sources and inspect the structured result without writing to the database.
- [ ] Review `git diff` to ensure existing landing-page work and local artifacts are not included in ingestion changes.
