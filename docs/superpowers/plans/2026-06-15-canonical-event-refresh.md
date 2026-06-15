# Canonical Event Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Hermes live ingestion through Prisma and persisted classification, then refresh stale canonical events when the browse page loads.

**Architecture:** A server-only refresh coordinator owns fetch, normalization, deduplication, Prisma persistence, and classification. It uses a five-minute process-local freshness window and coalesces concurrent refreshes. The CLI forces this coordinator to run, while `/events` performs a best-effort stale refresh before reading canonical events.

**Tech Stack:** TypeScript, Next.js App Router, Prisma/Postgres, Zod, OpenAI Responses API, Vitest

---

### Task 1: Persist Event Classifications

**Files:**
- Create: `src/lib/classification/classify-events.ts`
- Create: `src/lib/classification/__tests__/classify-events.test.ts`
- Modify: `src/lib/classification/index.ts`

- [ ] **Step 1: Write failing classification orchestration tests**

Add tests that define repository and classifier contracts and prove:

```ts
it("persists valid provider classification for pending events", async () => {
  const result = await classifyEvents({
    repository,
    classifier,
    eventIds: ["event-a"],
  });

  expect(repository.saveClassification).toHaveBeenCalledWith(
    "event-a",
    expect.objectContaining({ status: "classified" }),
  );
  expect(result.classifiedCount).toBe(1);
});

it("persists fallback classification when provider is unavailable", async () => {
  classifier.classify.mockResolvedValue({
    status: "unavailable",
    code: "missing-api-key",
  });

  const result = await classifyEvents({
    repository,
    classifier,
    eventIds: ["event-a"],
  });

  expect(repository.saveClassification).toHaveBeenCalledWith(
    "event-a",
    expect.objectContaining({ status: "fallback" }),
  );
  expect(result.fallbackCount).toBe(1);
});

it("skips events that are no longer pending", async () => {
  repository.getClassificationCandidate.mockResolvedValue(null);

  const result = await classifyEvents({
    repository,
    classifier,
    eventIds: ["event-a"],
  });

  expect(classifier.classify).not.toHaveBeenCalled();
  expect(result.skippedCount).toBe(1);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- src/lib/classification/__tests__/classify-events.test.ts
```

Expected: FAIL because `classifyEvents` and its repository contracts do not exist.

- [ ] **Step 3: Implement classification orchestration**

Create focused contracts:

```ts
export interface ClassificationCandidate {
  eventId: string;
  title: string;
  description: string;
  clubName: string;
  locationName: string;
  sourceTags: string[];
}

export interface ClassificationRepository {
  getClassificationCandidate(eventId: string): Promise<ClassificationCandidate | null>;
  saveClassification(
    eventId: string,
    input: {
      classification: Classification;
      model: string;
      promptVersion: string;
      status: "classified" | "fallback";
    },
  ): Promise<void>;
}
```

Implement a two-worker pool. For each candidate, call the classifier, persist
valid output as `classified`, and persist `createFallbackClassification(...)`
as `fallback` for unavailable or invalid output. Return constrained attempted,
classified, fallback, skipped, and failed counts.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
npm test -- src/lib/classification/__tests__/classify-events.test.ts src/lib/classification/__tests__
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/classification
git commit -m "feat: orchestrate event classification"
```

### Task 2: Add Prisma Classification Repository

**Files:**
- Create: `src/lib/classification/prisma-repository.ts`
- Create: `src/lib/classification/__tests__/prisma-repository.test.ts`
- Modify: `src/lib/classification/index.ts`

- [ ] **Step 1: Write failing Prisma repository tests**

Prove that `getClassificationCandidate` only returns `pending` and `retry`
events, and that `saveClassification` atomically upserts the classification and
updates the event status:

```ts
expect(client.event.findFirst).toHaveBeenCalledWith({
  where: {
    id: "event-a",
    classificationStatus: { in: ["pending", "retry"] },
  },
  select: expect.any(Object),
});

expect(transaction.eventClassification.upsert).toHaveBeenCalled();
expect(transaction.event.update).toHaveBeenCalledWith({
  where: { id: "event-a" },
  data: { classificationStatus: "fallback" },
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- src/lib/classification/__tests__/prisma-repository.test.ts
```

Expected: FAIL because the Prisma classification repository does not exist.

- [ ] **Step 3: Implement Prisma repository**

Create `createPrismaClassificationRepository(client)` using Prisma
`findFirst` and a transaction containing `eventClassification.upsert` plus
`event.update`. Persist `CLASSIFICATION_PROMPT_VERSION`, model, classification
fields, and classification status.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
npm test -- src/lib/classification/__tests__/prisma-repository.test.ts src/lib/classification/__tests__/classify-events.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/classification
git commit -m "feat: persist event classifications"
```

### Task 3: Build Canonical Refresh Coordinator

**Files:**
- Create: `src/ingestion/refresh-canonical-events.ts`
- Create: `src/ingestion/__tests__/refresh-canonical-events.test.ts`
- Modify: `src/ingestion/index.ts`
- Modify: `src/ingestion/types.ts`

- [ ] **Step 1: Write failing refresh coordinator tests**

Prove:

```ts
it("refreshes stale data through persistence and classification", async () => {
  const result = await coordinator.refresh();

  expect(runIngestion).toHaveBeenCalledWith(
    expect.objectContaining({ persistence }),
  );
  expect(classifyEvents).toHaveBeenCalledWith(
    expect.objectContaining({ eventIds: result.persistedEventIds }),
  );
});

it("skips refresh while canonical data is fresh", async () => {
  await coordinator.refresh();
  await coordinator.refresh();
  expect(runIngestion).toHaveBeenCalledTimes(1);
});

it("coalesces concurrent refresh calls", async () => {
  await Promise.all([coordinator.refresh(), coordinator.refresh()]);
  expect(runIngestion).toHaveBeenCalledTimes(1);
});

it("does not mark failed persistence as fresh", async () => {
  runIngestion.mockResolvedValue(failedPersistenceRun);
  await coordinator.refresh();
  await coordinator.refresh();
  expect(runIngestion).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- src/ingestion/__tests__/refresh-canonical-events.test.ts
```

Expected: FAIL because the refresh coordinator does not exist and persistence
does not expose persisted event IDs.

- [ ] **Step 3: Expose persisted event IDs**

Extend `EventPersistenceResult` with `persistedEventIds: string[]` and append
each successful `eventId` returned by the persistence repository. Update
existing persistence expectations and CLI output tests.

- [ ] **Step 4: Implement refresh coordinator**

Create a dependency-injected `createCanonicalEventRefreshCoordinator` and one
server-only default coordinator using:

```ts
const FRESHNESS_WINDOW_MS = 5 * 60 * 1000;
```

The coordinator must:

- Skip when `DATABASE_URL` is absent.
- Reuse one in-flight promise.
- Call `runIngestion({ persistence })`.
- Classify successfully persisted IDs.
- Mark data fresh only when at least one source succeeded and persistence has
  zero failures.
- Support `{ force: true }` for CLI runs.
- Clear the in-flight promise in `finally`.

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```bash
npm test -- src/ingestion/__tests__/refresh-canonical-events.test.ts src/ingestion/__tests__ src/lib/events/__tests__/persistence.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ingestion src/lib/events/persistence.ts src/lib/events/__tests__/persistence.test.ts
git commit -m "feat: coordinate canonical event refresh"
```

### Task 4: Wire the CLI to Canonical Refresh

**Files:**
- Modify: `src/ingestion/cli.ts`
- Modify: `src/ingestion/cli-output.ts`
- Modify: `src/ingestion/__tests__/cli-output.test.ts`
- Create: `src/ingestion/__tests__/cli.test.ts`

- [ ] **Step 1: Write failing CLI tests**

Extract an executable `runCli` function and prove it forces refresh and returns
a non-zero exit code for source-total or persistence failure:

```ts
await runCli({ refresh });
expect(refresh).toHaveBeenCalledWith({ force: true });

expect(runCli({ refresh: failedPersistenceRefresh })).resolves.toBe(1);
expect(runCli({ refresh: successfulRefresh })).resolves.toBe(0);
```

Extend CLI output expectations to include classification counts.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- src/ingestion/__tests__/cli.test.ts src/ingestion/__tests__/cli-output.test.ts
```

Expected: FAIL because the CLI calls `runIngestion` directly.

- [ ] **Step 3: Implement CLI wiring**

Make `runCli` call the default canonical refresh coordinator with
`{ force: true }`, print constrained JSON, and return the required exit code.
Keep the module entry point responsible only for assigning `process.exitCode`.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
npm test -- src/ingestion/__tests__/cli.test.ts src/ingestion/__tests__/cli-output.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ingestion/cli.ts src/ingestion/cli-output.ts src/ingestion/__tests__/cli.test.ts src/ingestion/__tests__/cli-output.test.ts
git commit -m "feat: run canonical refresh from ingestion cli"
```

### Task 5: Refresh Events on Browse-Page Load

**Files:**
- Create: `src/lib/events/load-events.ts`
- Create: `src/lib/events/__tests__/load-events.test.ts`
- Modify: `src/app/events/page.tsx`
- Modify: `src/lib/events/repository.ts`
- Modify: `src/lib/events/__tests__/repository.test.ts`

- [ ] **Step 1: Write failing browse loader tests**

Define `loadFreshEvents` and prove:

```ts
it("refreshes before reading canonical events", async () => {
  await loadFreshEvents({ refresh, getEvents });
  expect(refresh.mock.invocationCallOrder[0]).toBeLessThan(
    getEvents.mock.invocationCallOrder[0],
  );
});

it("serves canonical events when refresh fails", async () => {
  refresh.mockRejectedValue(new Error("source unavailable"));
  await expect(loadFreshEvents({ refresh, getEvents })).resolves.toEqual(events);
});
```

Add a repository test proving events that already started but have not ended
are included using `endTime >= now`.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- src/lib/events/__tests__/load-events.test.ts src/lib/events/__tests__/repository.test.ts
```

Expected: FAIL because `loadFreshEvents` does not exist and the repository
filters on `startTime`.

- [ ] **Step 3: Implement browse loader and repository query**

Implement:

```ts
export async function loadFreshEvents(): Promise<HermesEvent[]> {
  try {
    await refreshCanonicalEvents();
  } catch {
    // Best-effort refresh; canonical data remains the page fallback.
  }

  return getEvents();
}
```

Change canonical reads and fallback filtering to include events whose
`endTime >= currentTime`. Update `/events` to call `loadFreshEvents()`.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
npm test -- src/lib/events/__tests__/load-events.test.ts src/lib/events/__tests__/repository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/events/load-events.ts src/lib/events/__tests__/load-events.test.ts src/lib/events/repository.ts src/lib/events/__tests__/repository.test.ts src/app/events/page.tsx
git commit -m "feat: refresh canonical events on browse"
```

### Task 6: Align Documentation and Verify End to End

**Files:**
- Modify: `docs/architecture.md`
- Modify: `.env.example`

- [ ] **Step 1: Update architecture documentation**

Document the canonical refresh coordinator, five-minute page-load freshness
window, Prisma persistence, persisted classification, fallback behavior, and
forced CLI refresh. Remove the obsolete transitional live-repository flow.

- [ ] **Step 2: Document optional refresh configuration**

Keep existing database and OpenAI variables and add:

```dotenv
EVENT_REFRESH_FRESHNESS_MS=300000
```

The implementation must validate this value and default to five minutes when it
is absent or invalid.

- [ ] **Step 3: Run complete verification**

Run:

```bash
npm test
npx tsc --noEmit --pretty false
npm run lint
npm run build
git diff --check
```

Expected: all commands exit successfully.

- [ ] **Step 4: Run a forced live refresh**

Run:

```bash
npm run ingest:events
```

Expected: output includes successful source counts, persistence counts, and
classification counts. If the configured database is unavailable, report that
as an operational blocker rather than claiming end-to-end database success.

- [ ] **Step 5: Commit**

```bash
git add docs/architecture.md .env.example
git commit -m "docs: describe canonical event refresh"
```
