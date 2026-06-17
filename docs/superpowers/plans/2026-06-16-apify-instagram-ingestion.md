# Apify Instagram Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Hermes' Instagram scraping path with Apify's `apify/instagram-post-scraper` actor so public club Instagram posts can be ingested as event candidates.

**Architecture:** Hermes will call the Apify actor directly, request structured post data for each configured public Instagram profile, and normalize the actor output into the existing event-candidate pipeline. Instagram-specific parsing will move away from HTML scraping and rely on structured post fields plus the existing event heuristics, while the rest of ingestion, dedupe, location resolution, classification, and persistence stay unchanged.

**Tech Stack:** TypeScript, Next.js, Apify actor API, Zod, Vitest

---

### Task 1: Add an Apify fetch helper for Instagram posts

**Files:**
- Create: `src/ingestion/fetch-apify.ts`
- Test: `src/ingestion/__tests__/fetch-apify.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import { fetchApifyInstagramPosts } from "../fetch-apify";

describe("fetchApifyInstagramPosts", () => {
  it("posts to the Apify actor sync dataset endpoint with the configured token", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.origin).toBe("https://api.apify.com");
      expect(url.pathname).toBe("/v2/actors/apify~instagram-post-scraper/run-sync-get-dataset-items");
      expect(url.searchParams.get("format")).toBe("json");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer test-token",
        "content-type": "application/json",
      });
      return new Response(JSON.stringify([{ shortCode: "abc123" }]), {
        headers: { "content-type": "application/json" },
      });
    });

    await expect(
      fetchApifyInstagramPosts({
        profileUrl: "https://www.instagram.com/uwcheeseclub/",
        token: "test-token",
        fetchImpl,
      }),
    ).resolves.toEqual([{ shortCode: "abc123" }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/ingestion/__tests__/fetch-apify.test.ts`

- [ ] **Step 3: Write the minimal implementation**

```ts
export async function fetchApifyInstagramPosts(...) { ... }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/ingestion/__tests__/fetch-apify.test.ts`

Expected: PASS

---

### Task 2: Normalize Apify Instagram actor items into Hermes candidates

**Files:**
- Modify: `src/ingestion/sources/instagram-public.ts`
- Test: `src/ingestion/__tests__/instagram-public.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createInstagramSource } from "../sources/instagram-public";

const source = createInstagramSource({
  clubName: "UW Cheese Club",
  instagramHandle: "uwcheeseclub",
  profileUrl: "https://www.instagram.com/uwcheeseclub/",
  active: true,
  priority: 1,
});

describe("createInstagramSource", () => {
  it("promotes a structured Apify post item into an event candidate", () => {
    const results = source.parse(
      JSON.stringify([
        {
          shortCode: "DZpt0I1ESPa",
          caption: "UW Cheese Club Fall Social\nJoin us on June 20, 2026 at 7 PM in SLC for free pizza and games.",
          timestamp: "2026-06-20T19:00:00.000Z",
          locationName: "SLC Great Hall",
          displayUrl: "https://example.com/post.jpg",
          url: "https://www.instagram.com/p/DZpt0I1ESPa/",
        },
      ]),
    );

    expect(results[0]).toMatchObject({
      ok: true,
      event: {
        source: "instagram-clubs",
        sourceUrl: "https://www.instagram.com/p/DZpt0I1ESPa/",
        clubName: "UW Cheese Club",
        title: "UW Cheese Club Fall Social",
        locationName: "SLC Great Hall",
        isFreeFood: true,
      },
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/ingestion/__tests__/instagram-public.test.ts`

- [ ] **Step 3: Write the minimal implementation**

```ts
function parse(raw: string): NormalizationResult[] { ... }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/ingestion/__tests__/instagram-public.test.ts`

Expected: PASS

---

### Task 3: Route Instagram ingestion through Apify

**Files:**
- Modify: `src/ingestion/run-ingestion.ts`
- Modify: `src/ingestion/sources/registry.ts` if the source wiring needs it
- Test: `src/ingestion/__tests__/run-ingestion.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("routes instagram-clubs through the Apify fetch path", async () => {
  ...
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/ingestion/__tests__/run-ingestion.test.ts`

- [ ] **Step 3: Write the minimal implementation**

```ts
if (source.id === "instagram-clubs") {
  return fetchApifyInstagramPosts(...);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/ingestion/__tests__/run-ingestion.test.ts`

Expected: PASS

---

### Task 4: Verify the full ingestion stack

**Files:**
- No code changes expected

- [ ] **Step 1: Run typecheck and build**

Run:
```bash
npx tsc --noEmit
npm run build
```

Expected: both commands pass.

- [ ] **Step 2: Run a live ingestion pass**

Run:
```bash
npm run ingest:events -- --reclassify
```

Expected:
- `instagram-clubs` appears in the sources summary
- the source returns structured posts instead of HTML-derived parsing
- existing WUSA and UW sources still succeed

---

### Task 5: Commit the Apify migration

**Files:**
- Commit the modified ingestion files and tests

- [ ] **Step 1: Review the diff for leftover ScrapeFly wiring**

Check that Instagram no longer depends on `SCRAPEFLY_API_KEY`.

- [ ] **Step 2: Commit**

```bash
git add src/ingestion src/ingestion/__tests__ docs/superpowers/plans/2026-06-16-apify-instagram-ingestion.md
git commit -m "feat: route instagram ingestion through apify"
```
