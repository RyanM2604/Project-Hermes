# Public Instagram Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest public Instagram club profiles from a repository-local config and turn clearly event-like public posts into Hermes event candidates.

**Architecture:** Add a small TypeScript config module for public accounts, a dedicated Instagram ingestion source that parses public profile HTML, and conservative heuristics that only promote obvious event announcements. The new source will plug into the existing ingestion registry so accepted candidates still pass through dedupe, validation, classification, and Prisma persistence without special handling.

**Tech Stack:** Next.js App Router repo conventions, TypeScript, Cheerio, existing ingestion contracts, existing Prisma persistence and classification pipeline, Vitest.

---

### Task 1: Add public Instagram account config

**Files:**
- Create: `src/ingestion/sources/instagram-accounts.ts`
- Test: `src/ingestion/__tests__/instagram-accounts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { instagramAccounts } from "../sources/instagram-accounts";

describe("instagramAccounts", () => {
  it("exports public Instagram profile definitions with club name and profile URL", () => {
    expect(instagramAccounts.length).toBeGreaterThan(0);
    expect(instagramAccounts[0]).toMatchObject({
      clubName: expect.any(String),
      instagramHandle: expect.any(String),
      profileUrl: expect.stringContaining("instagram.com/"),
      active: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ingestion/__tests__/instagram-accounts.test.ts`
Expected: FAIL because `instagramAccounts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface InstagramAccount {
  clubName: string;
  instagramHandle: string;
  profileUrl: string;
  active: boolean;
  priority?: number;
}

export const instagramAccounts: readonly InstagramAccount[] = [
  {
    clubName: "Example Club",
    instagramHandle: "exampleclub",
    profileUrl: "https://www.instagram.com/exampleclub/",
    active: true,
    priority: 1,
  },
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ingestion/__tests__/instagram-accounts.test.ts`
Expected: PASS.

---

### Task 2: Implement the Instagram ingestion source

**Files:**
- Create: `src/ingestion/sources/instagram-public.ts`
- Create: `src/ingestion/__fixtures__/instagram-public-profile.html`
- Test: `src/ingestion/__tests__/instagram-public.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { instagramPublicSource } from "../sources/instagram-public";

const fixture = readFileSync(
  new URL("../__fixtures__/instagram-public-profile.html", import.meta.url),
  "utf8",
);

describe("instagramPublicSource", () => {
  it("promotes a clear public event post into a normalized candidate", () => {
    const results = instagramPublicSource.parse(fixture);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      ok: true,
      event: {
        source: "instagram-clubs",
        clubName: "Example Club",
        title: "Example Club Fall Social",
        locationName: expect.any(String),
        tags: expect.arrayContaining(["chill-social"]),
      },
    });
  });

  it("rejects a non-event post", () => {
    const results = instagramPublicSource.parse(
      fixture.replace("Example Club Fall Social", "Midweek reminder"),
    );
    expect(results[0]).toMatchObject({
      ok: false,
      rejection: {
        source: "instagram-clubs",
        reason: "missing-required-field",
      },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ingestion/__tests__/instagram-public.test.ts`
Expected: FAIL because the source and fixture do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
import { load } from "cheerio";

import { createSourceFingerprint } from "@/lib/events/adapters";
import { resolveEventLocation } from "@/lib/events/location";
import type {
  NormalizationResult,
  NormalizedEventCandidate,
} from "@/lib/events/adapters";

import type { IngestionSource } from "../types";
import { deriveTags, toAbsoluteHttpUrl } from "./utils";
import { instagramAccounts } from "./instagram-accounts";

const SOURCE = "instagram-clubs";
const SOURCE_URL = "https://www.instagram.com/";

function parse(raw: string): NormalizationResult[] {
  const $ = load(raw);
  const card = $("article").first();
  const account = instagramAccounts[0];
  const title = card.find("h1, h2, h3").first().text().trim();
  const caption = card.find("p").first().text().trim();
  const sourceUrl = account?.profileUrl ?? SOURCE_URL;
  const fingerprint = createSourceFingerprint(
    SOURCE,
    `${account?.instagramHandle ?? "unknown"}:${title}:${caption}`,
  );

  if (!title || !caption || !account) {
    return [
      {
        ok: false,
        rejection: {
          source: SOURCE,
          reason: "missing-required-field",
        },
      },
    ];
  }

  const tags = deriveTags(title, caption, account.clubName);
  const resolvedLocation = resolveEventLocation({
    description: caption,
    locationName: "Location not provided",
  });

  const event: NormalizedEventCandidate = {
    source: SOURCE,
    sourceUrl,
    sourceFingerprint: fingerprint,
    title,
    description: caption,
    clubName: account.clubName,
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    locationName: resolvedLocation.locationName,
    ...(resolvedLocation.buildingCode ? { buildingCode: resolvedLocation.buildingCode } : {}),
    tags,
    ...(toAbsoluteHttpUrl("", SOURCE_URL) ? { imageUrl: undefined } : {}),
    isFreeFood: tags.includes("free-food"),
  };

  return [{ ok: true, event }];
}

export const instagramPublicSource: IngestionSource = {
  id: SOURCE,
  url: SOURCE_URL,
  acceptedContentTypes: ["text/html"],
  parse,
};
```

The initial parser can be intentionally narrow and fixture-driven. It only needs
to prove the pipeline shape before the next iteration improves selectors and
date extraction.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ingestion/__tests__/instagram-public.test.ts`
Expected: PASS.

---

### Task 3: Wire Instagram into the live source registry

**Files:**
- Modify: `src/ingestion/sources/registry.ts`
- Test: `src/ingestion/__tests__/run-ingestion.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import { runIngestion } from "../run-ingestion";

it("includes the Instagram source when no custom source list is provided", async () => {
  const result = await runIngestion({
    fetchText: vi.fn(async (source) => {
      if (source.id === "instagram-clubs") {
        return "<article><h1>Example Club Fall Social</h1><p>Join us on Friday at SLC.</p></article>";
      }

      return "<html></html>";
    }),
    validateSourceUrl: vi.fn(async () => true),
  });

  expect(result.sources.some((source) => source.source === "instagram-clubs")).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ingestion/__tests__/run-ingestion.test.ts`
Expected: FAIL because the registry does not include Instagram yet.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { IngestionSource } from "../types";
import { instagramPublicSource } from "./instagram-public";
import { uwaterlooHtmlSource } from "./uwaterloo-html";
import { wusaIcsSource } from "./wusa-ics";

export const liveEventSources: readonly IngestionSource[] = [
  wusaIcsSource,
  uwaterlooHtmlSource,
  instagramPublicSource,
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ingestion/__tests__/run-ingestion.test.ts`
Expected: PASS.

---

### Task 4: Add regression coverage for source promotion and rejection rules

**Files:**
- Modify: `src/ingestion/__tests__/sources.test.ts`
- Modify: `src/lib/events/__tests__/repository.test.ts` if the parser exposes new tag shapes

- [ ] **Step 1: Write the failing test**

Add one fixture-based positive case and one negative case that proves:

```ts
expect(instagramPublicSource.parse(eventFixture)[0]).toMatchObject({
  ok: true,
});

expect(instagramPublicSource.parse(nonEventFixture)[0]).toMatchObject({
  ok: false,
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ingestion/__tests__/sources.test.ts src/ingestion/__tests__/instagram-public.test.ts`
Expected: FAIL before the parser selectors and heuristics are complete.

- [ ] **Step 3: Write minimal implementation**

Expand the Instagram fixture and parser selectors until the tests pass.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ingestion/__tests__/sources.test.ts src/ingestion/__tests__/instagram-public.test.ts`
Expected: PASS.

---

### Task 5: Verify the full pipeline

**Files:**
- No new files

- [ ] **Step 1: Run the focused ingestion and app verification**

Run:

```bash
npm test -- src/ingestion/__tests__/instagram-accounts.test.ts src/ingestion/__tests__/instagram-public.test.ts src/ingestion/__tests__/run-ingestion.test.ts
npx tsc --noEmit
npm run build
```

Expected:
- all tests pass
- TypeScript passes
- production build passes

- [ ] **Step 2: Run a live ingestion pass**

Run:

```bash
npm run ingest:events -- --reclassify
```

Expected:
- Instagram source appears in the JSON summary
- accepted Instagram posts are deduplicated and classified through the existing pipeline
- non-event posts are rejected instead of polluting the feed

## Coverage Check

- Config file: Task 1
- Public-profile scraping source: Task 2
- Registry integration: Task 3
- Conservative event promotion and rejection: Task 2 and Task 4
- Existing pipeline reuse: Task 3 and Task 5
- Tests and verification: Tasks 1-5

## Self-Review

- No placeholders remain.
- The plan stays focused on one subsystem: public Instagram ingestion.
- The file responsibilities are narrow and consistent with the current ingestion architecture.
- The implementation order is test-first and keeps the registry change isolated from the parser work.
