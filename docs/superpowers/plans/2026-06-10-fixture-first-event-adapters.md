# Fixture-First Event Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build tested, fixture-first event adapters for UWaterloo Events, WUSA Events, and clubs.wusa.ca without live fetching or persistence.

**Architecture:** Each source owns a small adapter that parses HTML fixtures into source records, normalizes records into a shared ingestion contract, and creates deterministic SHA-256 fingerprints. Shared contracts expose structured success and rejection results so one malformed record does not stop the rest of a fixture.

**Tech Stack:** TypeScript, Vitest, Cheerio, Node `crypto`, Next.js 16 repository tooling

---

## File Structure

- Modify `package.json`: add test scripts and dependencies.
- Modify `package-lock.json`: lock Vitest and Cheerio versions.
- Create `vitest.config.ts`: configure Vitest and the existing `@/` alias.
- Create `src/lib/events/adapters/types.ts`: shared adapter, candidate, and result contracts.
- Create `src/lib/events/adapters/utils.ts`: shared date validation and fingerprint helpers.
- Create `src/lib/events/adapters/index.ts`: public adapter exports.
- Modify `src/lib/events/index.ts`: export adapter contracts and implementations.
- Create `src/lib/events/adapters/__tests__/framework.test.ts`: shared-contract utility tests.
- Create `src/lib/events/adapters/uwaterloo-events.ts`: UWaterloo fixture parser and normalizer.
- Create `src/lib/events/adapters/__fixtures__/uwaterloo-events.html`: focused UWaterloo fixture.
- Create `src/lib/events/adapters/__tests__/uwaterloo-events.test.ts`: UWaterloo adapter tests.
- Create `src/lib/events/adapters/wusa-events.ts`: WUSA fixture parser and normalizer.
- Create `src/lib/events/adapters/__fixtures__/wusa-events.html`: focused WUSA fixture.
- Create `src/lib/events/adapters/__tests__/wusa-events.test.ts`: WUSA adapter tests.
- Create `src/lib/events/adapters/wusa-clubs.ts`: clubs.wusa.ca fixture parser and normalizer.
- Create `src/lib/events/adapters/__fixtures__/wusa-clubs.html`: focused clubs.wusa.ca fixture.
- Create `src/lib/events/adapters/__tests__/wusa-clubs.test.ts`: clubs.wusa.ca adapter tests.

### Task 1: Test Tooling

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install the test and HTML-parser dependencies**

Run:

```bash
npm install cheerio
npm install --save-dev vitest
```

Expected: `package.json` and `package-lock.json` include Cheerio and Vitest.

- [ ] **Step 2: Add test scripts**

Add to `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
```

- [ ] **Step 4: Verify the empty test suite**

Run: `npm test`

Expected: Vitest exits successfully with no test files.

- [ ] **Step 5: Verify repository checks**

Run:

```bash
npm run lint
npx tsc --noEmit --pretty false
npm run build
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "test: add event adapter test tooling"
```

### Task 2: Shared Adapter Framework

**Files:**
- Create: `src/lib/events/adapters/types.ts`
- Create: `src/lib/events/adapters/utils.ts`
- Create: `src/lib/events/adapters/index.ts`
- Create: `src/lib/events/adapters/__tests__/framework.test.ts`
- Modify: `src/lib/events/index.ts`

- [ ] **Step 1: Write failing framework tests**

Create `src/lib/events/adapters/__tests__/framework.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createSourceFingerprint, parseRequiredDate } from "../utils";

describe("adapter utilities", () => {
  it("creates a stable fingerprint independent of surrounding whitespace", () => {
    expect(createSourceFingerprint("uwaterloo", "  Event 42 ")).toBe(
      createSourceFingerprint("uwaterloo", "Event 42"),
    );
  });

  it("returns an ISO date for valid input", () => {
    expect(parseRequiredDate("2026-06-15T18:00:00-04:00")).toBe(
      "2026-06-15T22:00:00.000Z",
    );
  });

  it("returns null for malformed dates", () => {
    expect(parseRequiredDate("not-a-date")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- framework.test.ts`

Expected: FAIL because `../utils` does not exist.

- [ ] **Step 3: Create shared contracts**

Create `src/lib/events/adapters/types.ts`:

```ts
import type { BuildingCode, EventTag } from "@/types/event";

export type EventSourceId = "uwaterloo-events" | "wusa-events" | "wusa-clubs";

export interface NormalizedEventCandidate {
  source: EventSourceId;
  sourceUrl: string;
  sourceFingerprint: string;
  title: string;
  description: string;
  clubName: string;
  startTime: string;
  endTime: string;
  locationName: string;
  buildingCode?: BuildingCode;
  tags: EventTag[];
  imageUrl?: string;
  isFreeFood: boolean;
}

export interface NormalizationRejection {
  source: EventSourceId;
  recordId?: string;
  reason: "missing-required-field" | "invalid-date";
}

export type NormalizationResult =
  | { ok: true; event: NormalizedEventCandidate }
  | { ok: false; rejection: NormalizationRejection };

export interface EventSourceAdapter<TRawRecord> {
  readonly source: EventSourceId;
  parseRaw(raw: string): TRawRecord[];
  normalize(record: TRawRecord): NormalizationResult;
  sourceFingerprint(record: TRawRecord): string;
}
```

- [ ] **Step 4: Implement shared utilities**

Create `src/lib/events/adapters/utils.ts`:

```ts
import { createHash } from "node:crypto";

export function createSourceFingerprint(source: string, sourceId: string) {
  return createHash("sha256")
    .update(`${source}:${sourceId.trim()}`)
    .digest("hex");
}

export function parseRequiredDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}
```

Create `src/lib/events/adapters/index.ts`:

```ts
export type {
  EventSourceAdapter,
  EventSourceId,
  NormalizationRejection,
  NormalizationResult,
  NormalizedEventCandidate,
} from "./types";
export { createSourceFingerprint, parseRequiredDate } from "./utils";
```

Append to `src/lib/events/index.ts`:

```ts
export * from "./adapters";
```

- [ ] **Step 5: Run framework tests and repository checks**

Run:

```bash
npm test -- framework.test.ts
npm run lint
npx tsc --noEmit --pretty false
npm run build
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/events
git commit -m "feat: add event source adapter framework"
```

### Task 3: UWaterloo Events Adapter

**Files:**
- Create: `src/lib/events/adapters/uwaterloo-events.ts`
- Create: `src/lib/events/adapters/__fixtures__/uwaterloo-events.html`
- Create: `src/lib/events/adapters/__tests__/uwaterloo-events.test.ts`
- Modify: `src/lib/events/adapters/index.ts`

- [ ] **Step 1: Save a focused fixture**

Create `src/lib/events/adapters/__fixtures__/uwaterloo-events.html` containing
three `.event-card` elements:

```html
<main>
  <article class="event-card" data-event-id="uw-101">
    <a class="event-link" href="https://uwaterloo.ca/events/quantum-workshop">Quantum Workshop</a>
    <p class="event-description">A hands-on introduction to quantum computing.</p>
    <span class="event-organizer">Institute for Quantum Computing</span>
    <time class="event-start" datetime="2026-06-15T18:00:00-04:00"></time>
    <time class="event-end" datetime="2026-06-15T20:00:00-04:00"></time>
    <span class="event-location">QNC 0101</span>
    <img class="event-image" src="https://uwaterloo.ca/events/quantum.jpg" alt="">
  </article>
  <article class="event-card" data-event-id="uw-102">
    <a class="event-link" href="https://uwaterloo.ca/events/career-panel">Career Panel</a>
    <p class="event-description"></p>
    <span class="event-organizer">Co-operative Education</span>
    <time class="event-start" datetime="2026-06-16T17:00:00-04:00"></time>
    <time class="event-end" datetime="2026-06-16T18:00:00-04:00"></time>
    <span class="event-location">TC 2218</span>
  </article>
  <article class="event-card" data-event-id="uw-bad">
    <a class="event-link" href="https://uwaterloo.ca/events/bad-date">Bad Date Event</a>
    <span class="event-organizer">UWaterloo</span>
    <time class="event-start" datetime="unknown"></time>
    <time class="event-end" datetime="unknown"></time>
    <span class="event-location">SLC</span>
  </article>
</main>
```

- [ ] **Step 2: Write failing UWaterloo tests**

Create tests that load the fixture with `readFileSync`, then assert:

```ts
expect(records).toHaveLength(3);
expect(valid).toMatchObject({
  ok: true,
  event: {
    source: "uwaterloo-events",
    title: "Quantum Workshop",
    buildingCode: "QNC",
  },
});
expect(optionalDescription).toMatchObject({ ok: true });
expect(malformed).toEqual({
  ok: false,
  rejection: {
    source: "uwaterloo-events",
    recordId: "uw-bad",
    reason: "invalid-date",
  },
});
expect(adapter.sourceFingerprint(records[0])).toBe(
  adapter.sourceFingerprint(records[0]),
);
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- uwaterloo-events.test.ts`

Expected: FAIL because the UWaterloo adapter does not exist.

- [ ] **Step 4: Implement the UWaterloo adapter**

Use Cheerio selectors matching the fixture. Define a private
`UWaterlooEventRecord` with strings for source ID, URL, title, description,
organizer, dates, location, and optional image. `normalize` must:

- Reject blank title, organizer, URL, or location as `missing-required-field`.
- Reject invalid start or end dates as `invalid-date`.
- Derive `QNC`, `TC`, or `SLC` from the location when present.
- Default blank descriptions to `"No description provided."`.
- Return an empty tag list and `isFreeFood: false`.
- Use `createSourceFingerprint(this.source, record.sourceId)`.

Export:

```ts
export const uwaterlooEventsAdapter: EventSourceAdapter<UWaterlooEventRecord>;
```

- [ ] **Step 5: Export and verify the adapter**

Export it from `src/lib/events/adapters/index.ts`, then run:

```bash
npm test -- uwaterloo-events.test.ts
npm run lint
npx tsc --noEmit --pretty false
npm run build
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/events/adapters
git commit -m "feat: add UWaterloo events fixture adapter"
```

### Task 4: WUSA Events Adapter

**Files:**
- Create: `src/lib/events/adapters/wusa-events.ts`
- Create: `src/lib/events/adapters/__fixtures__/wusa-events.html`
- Create: `src/lib/events/adapters/__tests__/wusa-events.test.ts`
- Modify: `src/lib/events/adapters/index.ts`

- [ ] **Step 1: Save a focused WUSA fixture**

Create three `.wusa-event` elements using `data-id`, `.title a`, `.summary`,
`.host`, `.starts-at`, `.ends-at`, `.venue`, `.category`, and optional
`.featured-image` fields. Include:

- A complete free-food social event in SLC.
- A valid event without an image or description.
- An event with a blank title for rejection.

- [ ] **Step 2: Write failing WUSA tests**

Assert three records parse, the complete event normalizes with:

```ts
{
  source: "wusa-events",
  buildingCode: "SLC",
  tags: ["free-food", "chill-social"],
  isFreeFood: true,
}
```

Assert the optional-field event succeeds, the blank-title event returns
`missing-required-field`, and fingerprints remain stable.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- wusa-events.test.ts`

Expected: FAIL because the WUSA adapter does not exist.

- [ ] **Step 4: Implement and export the WUSA adapter**

Use Cheerio selectors matching the fixture. Map source categories:

```ts
const categoryTags = {
  "Free Food": ["free-food"],
  Social: ["chill-social"],
  Career: ["career-coop"],
} as const;
```

Set `isFreeFood` from the normalized tags. Apply the same required-field, date,
description fallback, location-code, and fingerprint rules as the UWaterloo
adapter while keeping selectors and source records inside `wusa-events.ts`.

- [ ] **Step 5: Verify all tests and repository checks**

Run:

```bash
npm test
npm run lint
npx tsc --noEmit --pretty false
npm run build
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/events/adapters
git commit -m "feat: add WUSA events fixture adapter"
```

### Task 5: WUSA Clubs Adapter

**Files:**
- Create: `src/lib/events/adapters/wusa-clubs.ts`
- Create: `src/lib/events/adapters/__fixtures__/wusa-clubs.html`
- Create: `src/lib/events/adapters/__tests__/wusa-clubs.test.ts`
- Modify: `src/lib/events/adapters/index.ts`

- [ ] **Step 1: Save a focused clubs.wusa.ca fixture**

Create three `.club-event` elements using `data-event`, `.club-event__title a`,
`.club-event__description`, `.club-name`, `.club-event__start`,
`.club-event__end`, `.club-event__location`, and `.club-event__labels` fields.
Include:

- A complete developer workshop.
- A valid social event with no image.
- An event with a missing organizer for rejection.

- [ ] **Step 2: Write failing clubs.wusa.ca tests**

Assert three records parse, the workshop normalizes with:

```ts
{
  source: "wusa-clubs",
  tags: ["hack-dev"],
  isFreeFood: false,
}
```

Assert the optional-image event succeeds, the missing-organizer event returns
`missing-required-field`, and fingerprints remain stable.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- wusa-clubs.test.ts`

Expected: FAIL because the clubs.wusa.ca adapter does not exist.

- [ ] **Step 4: Implement and export the clubs.wusa.ca adapter**

Use Cheerio selectors matching the fixture. Map labels:

```ts
const labelTags = {
  Developer: ["hack-dev"],
  Music: ["music", "reels"],
  Social: ["chill-social"],
  Startup: ["startup-pitch"],
} as const;
```

Apply the same required-field, date, description fallback, location-code, and
fingerprint rules while keeping source-specific selectors isolated in
`wusa-clubs.ts`.

- [ ] **Step 5: Run final verification**

Run:

```bash
npm test
npm run lint
npx tsc --noEmit --pretty false
npm run build
git diff --check
```

Expected: all commands pass. Tests demonstrate that malformed records do not
prevent valid records in the same fixture from normalizing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/events/adapters
git commit -m "feat: add WUSA clubs fixture adapter"
```

### Task 6: Deliverable Review

**Files:**
- Review only; no expected file changes.

- [ ] **Step 1: Confirm scope boundaries**

Verify no adapter performs HTTP requests, schedules jobs, writes to Supabase, or
logs raw fixture contents.

- [ ] **Step 2: Confirm public exports**

Run:

```bash
npx tsc --noEmit --pretty false
```

Expected: consumers can import all three adapters and shared contracts from
`@/lib/events`.

- [ ] **Step 3: Confirm clean repository state**

Run:

```bash
git status --short --branch
git log --oneline -5
```

Expected: working tree is clean and each implementation subtask has its own
commit.
