# AI Classification And Personalized Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist canonical events, enrich them with backend-only structured AI classification, show authenticated users deterministic personalized recommendations, protect routes with rate limits, and give event cards tag-driven visual themes.

**Architecture:** The ingestion pipeline upserts normalized events into Prisma and classifies only new or changed records through a server-only OpenAI adapter with strict Zod validation and deterministic fallback. Page requests read persisted events and calculate recommendations from stored classifications and authenticated interaction history without calling OpenAI. A shared rate-limit interface protects public routes, while card themes derive from the persisted primary tag.

**Tech Stack:** Next.js App Router 16, TypeScript, Prisma/Postgres, Supabase Auth, OpenAI Responses API, Zod, Vitest, Tailwind CSS, Playwright

---

## File Structure

### Canonical Events

- `prisma/schema.prisma`: Add canonical event, classification, and rate-limit models.
- `prisma/migrations/<timestamp>_canonical_events/migration.sql`: Create canonical event tables, indexes, constraints, and relationships.
- `src/lib/events/content-hash.ts`: Build deterministic classification-relevant content hashes.
- `src/lib/events/persistence.ts`: Upsert normalized ingestion candidates and expose persistence contracts.
- `src/lib/events/repository.ts`: Read canonical Prisma events and map them to `HermesEvent`.
- `src/ingestion/run-ingestion.ts`: Persist deduplicated candidates after source processing.

### Classification

- `src/lib/classification/schema.ts`: Define Zod schemas and classification vocabulary.
- `src/lib/classification/prompt.ts`: Build the versioned classification prompt from public event fields.
- `src/lib/classification/fallback.ts`: Produce deterministic classification without OpenAI.
- `src/lib/classification/openai-classifier.ts`: Call OpenAI server-side and validate structured output.
- `src/lib/classification/classify-events.ts`: Enforce budgets, classify eligible events, and persist results.
- `src/ingestion/cli.ts`: Run persistence and bounded classification as one internal command.
- `.env.example`: Document non-secret OpenAI classification configuration.

### Recommendations

- `src/lib/recommendations/rank-events.ts`: Pure deterministic ranking, exclusions, diversity, and reasons.
- `src/lib/recommendations/get-recommendations.ts`: Load authenticated signals and invoke the pure ranker.
- `src/components/feed/RecommendedEvents.tsx`: Render the separate authenticated recommendation section.
- `src/app/events/page.tsx`: Resolve the current user and render recommendations above the normal feed.

### Rate Limiting

- `src/lib/rate-limit/rate-limit.ts`: Shared limiter contract, policies, and response helpers.
- `src/lib/rate-limit/prisma-rate-limit.ts`: Atomic database-backed limiter.
- `src/app/api/interactions/route.ts`: Enforce public IP limits and body-size limits.
- `src/app/api/events/[id]/save/route.ts`: Enforce user and IP limits.
- `src/app/api/events/[id]/rsvp/route.ts`: Enforce user and IP limits.
- `src/lib/interactions/log-interaction.ts`: Enforce metadata depth and entry limits.

### Event Card Themes

- `src/lib/events/event-theme.ts`: Map primary tags to deterministic card themes.
- `src/components/events/EventCard.tsx`: Apply accessible visual variants and optional recommendation reason.
- `src/components/feed/StartingSoonCarousel.tsx`: Reuse tag themes in compact cards.
- `src/types/event.ts`: Add optional classification-facing fields used by the UI.

---

### Task 1: Canonical Prisma Event Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_canonical_events/migration.sql`
- Test: `src/lib/events/__tests__/content-hash.test.ts`
- Create: `src/lib/events/content-hash.ts`

- [ ] **Step 1: Write failing content-hash tests**

Create tests proving:

```ts
expect(createEventContentHash(candidate)).toMatch(/^[a-f0-9]{64}$/);
expect(createEventContentHash(candidate)).toBe(
  createEventContentHash({ ...candidate, sourceUrl: "https://changed.example" }),
);
expect(createEventContentHash(candidate)).not.toBe(
  createEventContentHash({ ...candidate, description: "Changed description" }),
);
```

The hash includes classification-relevant public fields only: title,
description, club name, location, and source-derived tags.

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```bash
npm test -- src/lib/events/__tests__/content-hash.test.ts
```

Expected: FAIL because `content-hash.ts` does not exist.

- [ ] **Step 3: Implement deterministic hashing**

Create `createEventContentHash(candidate)` using `node:crypto`, normalized
whitespace, sorted tags, and SHA-256.

- [ ] **Step 4: Add Prisma models and SQL migration**

Add:

```prisma
enum EventClassificationStatus {
  pending
  classified
  fallback
  retry
}

model Event {
  id                   String                    @id
  source               String
  sourceFingerprint    String                    @unique @map("source_fingerprint")
  sourceUrl            String                    @map("source_url")
  title                String
  description          String
  clubName             String                    @map("club_name")
  startTime            DateTime                  @map("start_time") @db.Timestamptz(6)
  endTime              DateTime                  @map("end_time") @db.Timestamptz(6)
  locationName         String                    @map("location_name")
  buildingCode         String?                   @map("building_code")
  sourceTags           String[]                  @map("source_tags")
  imageUrl             String?                   @map("image_url")
  isFreeFood           Boolean                   @default(false) @map("is_free_food")
  contentHash          String                    @map("content_hash")
  classificationStatus EventClassificationStatus @default(pending) @map("classification_status")
  classification       EventClassification?
  createdAt            DateTime                  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt            DateTime                  @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@index([startTime], map: "events_start_time_idx")
  @@index([classificationStatus], map: "events_classification_status_idx")
  @@map("events")
}

model EventClassification {
  eventId       String   @id @map("event_id")
  event         Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  promptVersion String   @map("prompt_version")
  model         String
  primaryTag    String   @map("primary_tag")
  tags          String[]
  vibes         String[]
  audiences     String[]
  format        String
  confidence    Float
  rationale     String
  classifiedAt  DateTime @default(now()) @map("classified_at") @db.Timestamptz(6)

  @@index([primaryTag], map: "event_classifications_primary_tag_idx")
  @@map("event_classifications")
}
```

Write SQL matching the Prisma schema, including the enum, unique fingerprint,
indexes, and cascade relationship.

- [ ] **Step 5: Verify schema and tests**

Run:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npm test -- src/lib/events/__tests__/content-hash.test.ts
```

Expected: all commands pass.

- [ ] **Step 6: Commit canonical schema**

Stage only the files from this task and commit:

```bash
git commit -m "feat: add canonical event schema"
```

---

### Task 2: Persist Ingested Events

**Files:**
- Create: `src/lib/events/persistence.ts`
- Test: `src/lib/events/__tests__/persistence.test.ts`
- Modify: `src/ingestion/run-ingestion.ts`
- Modify: `src/ingestion/types.ts`
- Modify: `src/ingestion/cli-output.ts`

- [ ] **Step 1: Write failing persistence tests**

Define a dependency-injected `EventPersistenceRepository` and prove:

```ts
await persistEvents([candidate], repository);
expect(repository.upsert).toHaveBeenCalledWith(
  expect.objectContaining({
    id: `event-${candidate.sourceFingerprint}`,
    contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
  }),
);
```

Also prove unchanged events retain their classification status, changed events
become `pending`, and one failed upsert does not prevent later candidates from
being attempted.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```bash
npm test -- src/lib/events/__tests__/persistence.test.ts
```

Expected: FAIL because persistence is not implemented.

- [ ] **Step 3: Implement the persistence unit**

Implement:

```ts
export interface EventPersistenceRepository {
  upsert(input: PersistedEventInput): Promise<{
    changed: boolean;
    eventId: string;
  }>;
}

export async function persistEvents(
  events: readonly NormalizedEventCandidate[],
  repository: EventPersistenceRepository,
): Promise<EventPersistenceResult>;
```

The Prisma adapter must use an upsert and set `classificationStatus` to
`pending` only when `contentHash` changes.

- [ ] **Step 4: Wire persistence into ingestion**

Extend `runIngestion` with an optional persistence dependency. Keep source
fetching, normalization, and deduplication behavior unchanged. Include
persistence counts and constrained failure codes in the run result without raw
payload logging.

- [ ] **Step 5: Verify persistence behavior**

Run:

```bash
npm test -- src/lib/events/__tests__/persistence.test.ts src/ingestion/__tests__/run-ingestion.test.ts src/ingestion/__tests__/cli-output.test.ts
npx tsc --noEmit --pretty false
```

Expected: all focused tests and type checking pass.

- [ ] **Step 6: Commit event persistence**

Stage only this task's files and commit:

```bash
git commit -m "feat: persist ingested events"
```

---

### Task 3: Read Canonical Events Through Prisma

**Files:**
- Create: `src/lib/events/repository.ts`
- Test: `src/lib/events/__tests__/repository.test.ts`
- Modify: `src/lib/events/index.ts`
- Modify: `src/types/event.ts`
- Modify: `src/app/events/page.tsx`
- Modify: `src/app/events/[id]/page.tsx`
- Modify: `src/app/api/events/[id]/save/route.ts`
- Modify: `src/app/api/events/[id]/rsvp/route.ts`
- Delete after replacement: `src/lib/events/live-events.ts`

- [ ] **Step 1: Write failing repository mapping tests**

Prove persisted records map to `HermesEvent`, classification tags override
source tags when present, source tags remain the fallback, and primary tag is
optional:

```ts
expect(toHermesEvent(record)).toMatchObject({
  id: record.id,
  tags: record.classification.tags,
  primaryTag: record.classification.primaryTag,
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```bash
npm test -- src/lib/events/__tests__/repository.test.ts
```

Expected: FAIL because the canonical repository does not exist.

- [ ] **Step 3: Implement canonical event repository**

Implement `getEvents`, `getEventById`, and `eventExists` with Prisma queries.
Read upcoming events in chronological order. Map Prisma dates to ISO strings
and validate tag strings before exposing them as `EventTag`.

- [ ] **Step 4: Route current consumers through the repository**

Update event pages and save/RSVP existence validation to use the canonical
repository. Remove `live-events.ts` only after all imports have been replaced.
Preserve the normal chronological feed and current fallback behavior during
database failures by returning mock events from the repository boundary.

- [ ] **Step 5: Verify event routes**

Run:

```bash
npm test -- src/lib/events/__tests__/repository.test.ts src/lib/events/__tests__/save-event.test.ts src/lib/events/__tests__/rsvp-event.test.ts
npx tsc --noEmit --pretty false
npm run build
```

Expected: tests, type checking, and build pass.

- [ ] **Step 6: Commit canonical repository**

Stage only this task's files and commit:

```bash
git commit -m "feat: serve canonical events"
```

---

### Task 4: Classification Schema, Prompt, And Fallback

**Files:**
- Create: `src/lib/classification/schema.ts`
- Create: `src/lib/classification/prompt.ts`
- Create: `src/lib/classification/fallback.ts`
- Create: `src/lib/classification/index.ts`
- Test: `src/lib/classification/__tests__/schema.test.ts`
- Test: `src/lib/classification/__tests__/prompt.test.ts`
- Test: `src/lib/classification/__tests__/fallback.test.ts`

- [ ] **Step 1: Write failing classification contract tests**

Prove:

- Unsupported tags, confidence outside `0..1`, and long rationales fail.
- The prompt contains a fixed version, the supported vocabulary, the public
  fields, and explicit instructions not to invent facts.
- The prompt does not contain user or interaction fields.
- Deterministic fallback always returns a valid classification and chooses a
  stable primary tag.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```bash
npm test -- src/lib/classification/__tests__
```

Expected: FAIL because classification modules do not exist.

- [ ] **Step 3: Implement schemas and vocabulary**

Define:

```ts
export const classificationSchema = z.object({
  primaryTag: eventTagSchema,
  tags: z.array(eventTagSchema).min(1).max(5),
  vibes: z.array(z.enum(["focused", "social", "creative", "energetic", "relaxed", "professional"])).max(3),
  audiences: z.array(z.enum(["all-students", "undergraduate", "graduate", "technical", "career-focused", "founders", "performers"])).max(3),
  format: z.enum(["workshop", "social", "talk", "competition", "performance", "meal", "networking", "other"]),
  confidence: z.number().min(0).max(1),
  rationale: z.string().trim().min(1).max(240),
});
```

- [ ] **Step 4: Implement versioned prompt and fallback**

Build a stable prompt payload from only title, description, organizer,
location, and source-derived tags. The fallback uses source-derived tags and
existing deterministic keyword classification; when no tag exists, use
`chill-social` at low confidence.

- [ ] **Step 5: Verify classification contracts**

Run:

```bash
npm test -- src/lib/classification/__tests__
npx tsc --noEmit --pretty false
```

Expected: all focused tests and type checking pass.

- [ ] **Step 6: Commit classification contracts**

Stage only this task's files and commit:

```bash
git commit -m "feat: add event classification contracts"
```

---

### Task 5: Server-Only OpenAI Classifier

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Create: `src/lib/classification/openai-classifier.ts`
- Test: `src/lib/classification/__tests__/openai-classifier.test.ts`

- [ ] **Step 1: Install the official OpenAI SDK**

Run:

```bash
npm install openai
```

Expected: `openai` is added to dependencies without exposing any API key.

- [ ] **Step 2: Write failing adapter tests**

Inject the OpenAI response call and prove:

- Valid structured output returns a validated classification.
- Invalid structured output returns a constrained classification failure.
- Missing `OPENAI_API_KEY` returns an unavailable result without making a call.
- Timeouts and provider failures do not expose raw prompts or responses.

- [ ] **Step 3: Run focused tests and confirm failure**

Run:

```bash
npm test -- src/lib/classification/__tests__/openai-classifier.test.ts
```

Expected: FAIL because the adapter does not exist.

- [ ] **Step 4: Implement the server-only adapter**

Use `import "server-only"` and the official OpenAI SDK Responses API with a
strict JSON schema matching `classificationSchema`. Read:

```text
OPENAI_API_KEY
OPENAI_CLASSIFICATION_MODEL
OPENAI_CLASSIFICATION_TIMEOUT_MS
```

from server environment variables. Do not log prompts, raw event descriptions,
credentials, or raw model responses.

- [ ] **Step 5: Document placeholder configuration**

Add only placeholder values to `.env.example`:

```text
OPENAI_API_KEY=your-openai-api-key
OPENAI_CLASSIFICATION_MODEL=your-structured-output-model
OPENAI_CLASSIFICATION_TIMEOUT_MS=15000
```

Do not inspect `.env`.

- [ ] **Step 6: Verify adapter**

Run:

```bash
npm test -- src/lib/classification/__tests__/openai-classifier.test.ts
npx tsc --noEmit --pretty false
```

Expected: tests and type checking pass with no real API key.

- [ ] **Step 7: Commit OpenAI adapter**

Stage only this task's files and commit:

```bash
git commit -m "feat: add server-only event classifier"
```

---

### Task 6: Bounded Classification Pipeline

**Files:**
- Create: `src/lib/classification/classify-events.ts`
- Test: `src/lib/classification/__tests__/classify-events.test.ts`
- Modify: `src/ingestion/cli.ts`
- Modify: `src/ingestion/cli-output.ts`
- Modify: `src/ingestion/types.ts`

- [ ] **Step 1: Write failing pipeline tests**

Prove:

- Only `pending` and `retry` events are selected.
- Unchanged classified events are skipped.
- At most the configured per-run budget is processed.
- At most two classifier calls are active concurrently.
- Valid AI output becomes `classified`.
- Missing configuration or provider failure persists deterministic fallback and
  marks the event `fallback`.
- A failed event does not stop later events.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```bash
npm test -- src/lib/classification/__tests__/classify-events.test.ts
```

Expected: FAIL because the pipeline does not exist.

- [ ] **Step 3: Implement repository-driven classification**

Define repository methods for selecting eligible events and atomically
persisting classification results. Implement a small concurrency worker pool
with a hard maximum of `2`, bounded retries, and a per-run event budget.

- [ ] **Step 4: Wire classification into internal ingestion CLI**

After ingestion persistence, run bounded classification. Extend structured CLI
output with attempted, classified, fallback, skipped, and failed counts.
Classification failures must not set a failed ingestion exit code.

- [ ] **Step 5: Verify pipeline**

Run:

```bash
npm test -- src/lib/classification/__tests__/classify-events.test.ts src/ingestion/__tests__/cli-output.test.ts
npx tsc --noEmit --pretty false
```

Expected: tests and type checking pass.

- [ ] **Step 6: Commit classification pipeline**

Stage only this task's files and commit:

```bash
git commit -m "feat: classify ingested events"
```

---

### Task 7: Pure Recommendation Ranker

**Files:**
- Create: `src/lib/recommendations/rank-events.ts`
- Create: `src/lib/recommendations/types.ts`
- Test: `src/lib/recommendations/__tests__/rank-events.test.ts`

- [ ] **Step 1: Write failing ranking tests**

Use fixed timestamps and prove:

- Past and dismissed events are excluded.
- RSVP scores higher than save, save higher than open, and open higher than
  impression.
- Repeated impressions without engagement reduce score.
- Matching tags, organizer, and vibes improve score.
- Starting-soon and fresh events receive bounded boosts.
- Results include stable deterministic reasons.
- Cold-start results are timely and diverse across primary tags and organizers.
- Final results do not contain excessive consecutive events with the same
  primary tag or organizer.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```bash
npm test -- src/lib/recommendations/__tests__/rank-events.test.ts
```

Expected: FAIL because the ranker does not exist.

- [ ] **Step 3: Implement deterministic scoring**

Implement pure functions with named weights:

```ts
const ACTION_WEIGHTS = {
  rsvp: 12,
  save: 8,
  open: 3,
  impression: 0.25,
  dismiss: -20,
} as const;
```

Cap repeated signal effects, apply time decay, exclude past/dismissed events,
and perform a final diversity pass. Return a score and one concise reason for
each selected event.

- [ ] **Step 4: Verify ranker**

Run:

```bash
npm test -- src/lib/recommendations/__tests__/rank-events.test.ts
npx tsc --noEmit --pretty false
```

Expected: all focused tests and type checking pass.

- [ ] **Step 5: Commit recommendation ranker**

Stage only this task's files and commit:

```bash
git commit -m "feat: rank personalized event recommendations"
```

---

### Task 8: Authenticated Recommendation Data And UI

**Files:**
- Create: `src/lib/recommendations/get-recommendations.ts`
- Test: `src/lib/recommendations/__tests__/get-recommendations.test.ts`
- Create: `src/components/feed/RecommendedEvents.tsx`
- Modify: `src/components/feed/index.ts`
- Modify: `src/components/events/EventCard.tsx`
- Modify: `src/app/events/page.tsx`

- [ ] **Step 1: Write failing recommendation-service tests**

Prove:

- No user returns no recommendations without querying private signals.
- An authenticated user loads Prisma interactions plus Supabase saves and
  RSVPs, then passes normalized signals to the pure ranker.
- Signal-read failures return an empty recommendation list.
- The returned recommendation reason is deterministic and contains no private
  raw interaction data.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```bash
npm test -- src/lib/recommendations/__tests__/get-recommendations.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement authenticated recommendation service**

Use the Supabase server client to resolve the current user and read that user's
saved events and RSVPs. Query Prisma interactions by `userId`. Normalize all
signals and call `rankEvents`. Do not expose this through a public route.

- [ ] **Step 4: Add the separate recommendation section**

Render `RecommendedEvents` above `StartingSoonCarousel` only when a signed-in
user has recommendations. Use `EventCard` with an optional `recommendationReason`
prop and a visible `Why this` label. Preserve the normal chronological feed.

- [ ] **Step 5: Verify recommendation UI**

Run:

```bash
npm test -- src/lib/recommendations/__tests__/get-recommendations.test.ts
npx tsc --noEmit --pretty false
npm run build
```

Use Playwright to verify anonymous `/events` has no recommendation section and
the normal feed remains usable. Verify authenticated behavior when test auth is
available.

- [ ] **Step 6: Commit recommendation section**

Stage only this task's files and commit:

```bash
git commit -m "feat: show authenticated event recommendations"
```

---

### Task 9: Shared Database Rate Limiter

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_rate_limit_buckets/migration.sql`
- Create: `src/lib/rate-limit/rate-limit.ts`
- Create: `src/lib/rate-limit/prisma-rate-limit.ts`
- Test: `src/lib/rate-limit/__tests__/rate-limit.test.ts`

- [ ] **Step 1: Write failing limiter tests**

Prove:

- Requests below a policy limit are allowed.
- The next request is denied with a positive `retryAfterSeconds`.
- Expired windows reset.
- Different IP, user, and policy keys do not share counters.
- Repository failures default to a documented fail-open result for browsing
  APIs, while the interface supports fail-closed policies for future AI routes.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```bash
npm test -- src/lib/rate-limit/__tests__/rate-limit.test.ts
```

Expected: FAIL because the limiter does not exist.

- [ ] **Step 3: Add the rate-limit model and atomic SQL**

Add:

```prisma
model RateLimitBucket {
  key       String   @id
  count     Int
  expiresAt DateTime @map("expires_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@index([expiresAt], map: "rate_limit_buckets_expires_at_idx")
  @@map("rate_limit_buckets")
}
```

The migration must include an atomic PostgreSQL function or equivalent
transaction-safe statement that increments an active bucket or resets an
expired bucket in one database operation.

- [ ] **Step 4: Implement limiter policies and response helper**

Define:

```ts
export const rateLimitPolicies = {
  interactionByIp: { limit: 60, windowSeconds: 60 },
  saveByUser: { limit: 30, windowSeconds: 60 },
  saveByIp: { limit: 60, windowSeconds: 60 },
  rsvpByUser: { limit: 30, windowSeconds: 60 },
  rsvpByIp: { limit: 60, windowSeconds: 60 },
} as const;
```

Add a helper that produces a `429` JSON response with `Retry-After`.

- [ ] **Step 5: Verify limiter**

Run:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npm test -- src/lib/rate-limit/__tests__/rate-limit.test.ts
```

Expected: schema and focused tests pass.

- [ ] **Step 6: Commit rate-limit foundation**

Stage only this task's files and commit:

```bash
git commit -m "feat: add shared database rate limiter"
```

---

### Task 10: Protect Public And Authenticated Routes

**Files:**
- Modify: `src/app/api/interactions/route.ts`
- Modify: `src/app/api/events/[id]/save/route.ts`
- Modify: `src/app/api/events/[id]/rsvp/route.ts`
- Modify: `src/lib/interactions/log-interaction.ts`
- Test: `src/lib/interactions/__tests__/log-interaction.test.ts`
- Create: `src/lib/rate-limit/__tests__/protected-routes.test.ts`

- [ ] **Step 1: Write failing abuse-control tests**

Prove:

- Oversized interaction bodies return `413`.
- Excessively deep metadata and excessive metadata entries return `400`.
- Interaction requests beyond the IP limit return `429` with `Retry-After`.
- Save and RSVP enforce both IP and authenticated-user policies.
- Unauthenticated save and RSVP behavior remains `401`.
- Rate-limit or analytics logging failures never block the underlying client
  navigation behavior.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```bash
npm test -- src/lib/interactions/__tests__/log-interaction.test.ts src/lib/rate-limit/__tests__/protected-routes.test.ts
```

Expected: FAIL because routes are not protected.

- [ ] **Step 3: Add request identity and size helpers**

Derive IP identity from trusted deployment headers with a stable fallback.
Reject interaction bodies above a small explicit byte limit before parsing.
Extend Zod validation with bounded metadata depth and entry count.

- [ ] **Step 4: Apply route policies**

Apply `interactionByIp` before interaction logging. Resolve authenticated users
before applying save/RSVP user limits, then also apply the matching IP limit.
Return `429` with `Retry-After` on denial.

- [ ] **Step 5: Verify protected routes**

Run:

```bash
npm test -- src/lib/interactions/__tests__/log-interaction.test.ts src/lib/rate-limit/__tests__/protected-routes.test.ts src/lib/events/__tests__/save-event.test.ts src/lib/events/__tests__/rsvp-event.test.ts
npx tsc --noEmit --pretty false
```

Expected: all focused tests and type checking pass.

- [ ] **Step 6: Commit protected routes**

Stage only this task's files and commit:

```bash
git commit -m "feat: rate limit event interactions"
```

---

### Task 11: Tag-Driven Event Card Themes

**Files:**
- Create: `src/lib/events/event-theme.ts`
- Test: `src/lib/events/__tests__/event-theme.test.ts`
- Modify: `src/components/events/EventCard.tsx`
- Modify: `src/components/feed/StartingSoonCarousel.tsx`

- [ ] **Step 1: Write failing theme tests**

Prove every supported primary tag maps to a deterministic theme, `music` and
`reels` share the intended family, and missing/invalid tags map to the neutral
fallback.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```bash
npm test -- src/lib/events/__tests__/event-theme.test.ts
```

Expected: FAIL because the theme mapper does not exist.

- [ ] **Step 3: Implement the theme mapper**

Return semantic theme data rather than assembling classes inline:

```ts
interface EventTheme {
  label: string;
  mediaClassName: string;
  glowClassName: string;
  accentTextClassName: string;
  tagClassName: string;
  motif: "food" | "grid" | "lines" | "circles" | "wave" | "upward" | "neutral";
}
```

- [ ] **Step 4: Apply accessible card variants**

Keep the current card layout, semantic headings, focus behavior, tap targets,
and text contrast. Add a visible primary-tag label. Render decorative motifs
with `aria-hidden="true"`. Ensure long titles, tags, and recommendation reasons
do not overflow.

- [ ] **Step 5: Verify card visuals**

Run:

```bash
npm test -- src/lib/events/__tests__/event-theme.test.ts
npx tsc --noEmit --pretty false
npm run build
```

Use Playwright at desktop and mobile widths to verify each theme, visible tag
labels, keyboard focus, long-text containment, and no horizontal overflow.

- [ ] **Step 6: Commit card themes**

Stage only this task's files and commit:

```bash
git commit -m "feat: add tag-driven event card themes"
```

---

### Task 12: Full Verification And Operational Documentation

**Files:**
- Modify: `docs/architecture.md`
- Create: `docs/ai-classification.md`

- [ ] **Step 1: Document the operational boundary**

Document:

- How canonical ingestion and classification run
- Required placeholder environment variables
- Prompt versioning and content-hash behavior
- Classification budgets, retries, and deterministic fallback
- The rule that user data is never sent to OpenAI
- Recommendation scoring inputs and limitations
- Current database-backed limits and the Redis migration boundary

- [ ] **Step 2: Run complete automated verification**

Run:

```bash
npm test
npm run lint -- --quiet
npx tsc --noEmit --pretty false
npm run build
```

Expected: all commands pass.

- [ ] **Step 3: Run ingestion without an OpenAI key**

Run:

```bash
npm run ingest:events
```

Expected: events persist and deterministic fallback classification succeeds
without exposing secrets or requiring `OPENAI_API_KEY`.

- [ ] **Step 4: Run Playwright UI verification**

Verify:

- Anonymous users see no personalized section.
- The normal chronological feed remains present.
- Tag-driven card themes are visibly distinct and accessible.
- No event card, recommendation reason, or tag causes overflow.
- Authenticated recommendations appear when test authentication is available.

- [ ] **Step 5: Review commit and worktree isolation**

Run:

```bash
git status --short
git log --oneline --decorate -12
```

Confirm unrelated landing-page files, `.github/skills/`, `.playwright-cli/`,
and `output/` artifacts were not included in feature commits.

- [ ] **Step 6: Commit documentation**

Stage only the documentation files from this task and commit:

```bash
git commit -m "docs: document AI event recommendations"
```
