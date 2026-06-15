# Social Taxonomy Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `chill-social` into activity-based sub-tags so the feed stays useful without turning social browsing into one oversized bucket.

**Architecture:** Keep `free-food` as a top-level category and add a second layer of social activity tags underneath `chill-social`. The shared event-tag schema, ingestion derivation, fallback classification, and feed UI should all agree on the same tag list so the split stays consistent across source parsing, saved data, filters, and cards.

**Tech Stack:** TypeScript, Next.js App Router, Vitest, Tailwind, existing Hermes ingestion/classification pipeline.

---

### Task 1: Add the social sub-tag taxonomy in one place

**Files:**
- Create: `src/lib/events/social-tags.ts`
- Modify: `src/types/event.ts`
- Modify: `src/ingestion/schema.ts`
- Modify: `src/lib/classification/schema.ts`
- Modify: `src/lib/events/event-theme.ts`
- Modify: `src/lib/events/filters.ts`
- Test: `src/lib/events/__tests__/social-tags.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import type { HermesEvent } from "@/types/event";
import { socialSubTags } from "../social-tags";

const events = [
  {
    id: "event-1",
    title: "Board Game Night",
    description: "Play Catan and Uno with friends.",
    clubName: "Campus Social Club",
    startTime: "2026-06-15T23:00:00.000Z",
    endTime: "2026-06-16T01:00:00.000Z",
    locationName: "SLC",
    tags: ["games"],
    sourceUrl: "https://example.com/board-game-night",
    isFreeFood: false,
    createdAt: "2026-06-15T00:00:00.000Z",
  },
] satisfies HermesEvent[];

it("keeps free-food top level and exposes social sub-tags", () => {
  expect(socialSubTags).toEqual([
    "games",
    "hangout",
    "arts-crafts",
    "outdoors",
    "nightlife",
    "wellness",
    "movie-tv",
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npm test -- src/lib/events/__tests__/social-tags.test.ts
```

Expected: fail because the new social sub-tag constants and parent-bucket behavior do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Add `src/lib/events/social-tags.ts` with the shared social taxonomy and labels:

```ts
export const socialSubTags = [
  "games",
  "hangout",
  "arts-crafts",
  "outdoors",
  "nightlife",
  "wellness",
  "movie-tv",
] as const;

export type SocialSubTag = (typeof socialSubTags)[number];
```

Update the tag unions/enums so every layer accepts the same values:

```ts
export type EventTag =
  | "free-food"
  | "hack-dev"
  | "career-coop"
  | "startup-pitch"
  | "music"
  | "reels"
  | "chill-social"
  | "games"
  | "hangout"
  | "arts-crafts"
  | "outdoors"
  | "nightlife"
  | "wellness"
  | "movie-tv";
```

Map every sub-tag to the existing chill/social theme so the cards stay visually consistent while the labels become specific.

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npm test -- src/lib/events/__tests__/social-tags.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/events/social-tags.ts src/types/event.ts src/ingestion/schema.ts src/lib/classification/schema.ts src/lib/events/event-theme.ts src/lib/events/filters.ts src/lib/events/__tests__/social-tags.test.ts
git commit -m "feat: add social activity taxonomy"
```

### Task 2: Teach ingestion and fallback classification to emit social sub-tags

**Files:**
- Modify: `src/ingestion/sources/utils.ts`
- Modify: `src/lib/classification/fallback.ts`
- Modify: `src/lib/classification/prompt.ts`
- Modify: `src/lib/classification/classify-events.ts`
- Modify: `src/lib/classification/guardrails.ts`
- Test: `src/lib/classification/__tests__/fallback.test.ts`
- Test: `src/lib/classification/__tests__/classify-events.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("maps board-game events to the games sub-tag", () => {
  const fallback = createFallbackClassification({
    title: "Board Game Night",
    description: "Play Catan, Uno, and other games with friends.",
    clubName: "Campus Social Club",
    locationName: "SLC",
    sourceTags: [],
  });

  expect(fallback.primaryTag).toBe("games");
  expect(fallback.tags).toEqual(["games", "chill-social"]);
});
```

```ts
it("keeps weak social events in chill-social without forcing a sub-tag", async () => {
  classifier.classify.mockResolvedValue({
    model: "gpt-5.1-mini",
    status: "classified",
    classification: {
      primaryTag: "chill-social",
      tags: ["chill-social"],
      vibes: ["social"],
      audiences: ["all-students"],
      format: "social",
      confidence: 0.62,
      rationale: "Casual campus hangout.",
    },
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npm test -- src/lib/classification/__tests__/fallback.test.ts src/lib/classification/__tests__/classify-events.test.ts
```

Expected: fail because the new sub-tag derivation and social-aware fallback logic do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Add lightweight keyword mapping for social activity phrases in the shared ingestion helper:

```ts
if (/\\b(board games?|game night|cards?|uno|catan|trivia|poker)\\b/i.test(text)) {
  tags.push("games");
  tags.push("chill-social");
}
if (/\\b(paint night|crafts?|arts?|DIY|bake|make and take)\\b/i.test(text)) {
  tags.push("arts-crafts");
  tags.push("chill-social");
}
```

Update fallback classification so:
- `free-food` stays top level
- social events can promote a specific sub-tag as `primaryTag`
- low-confidence or vague social events fall back to plain `chill-social`

Keep the existing career/hack trust gate intact so the taxonomy split does not reintroduce noisy tags.

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npm test -- src/lib/classification/__tests__/fallback.test.ts src/lib/classification/__tests__/classify-events.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ingestion/sources/utils.ts src/lib/classification/fallback.ts src/lib/classification/prompt.ts src/lib/classification/classify-events.ts src/lib/classification/guardrails.ts src/lib/classification/__tests__/fallback.test.ts src/lib/classification/__tests__/classify-events.test.ts
git commit -m "feat: classify social events by activity"
```

### Task 3: Expose the new split in the feed UI

**Files:**
- Modify: `src/lib/events/filters.ts`
- Modify: `src/components/feed/EventFilters.tsx`
- Modify: `src/app/events/page.tsx`
- Modify: `src/components/events/EventCard.tsx`
- Modify: `src/components/feed/StartingSoonCarousel.tsx`
- Modify: `src/app/events/[id]/page.tsx`
- Test: `src/lib/events/__tests__/filters.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { type HermesEvent } from "@/types/event";

const makeEvent = (tags: HermesEvent["tags"]): HermesEvent => ({
  id: "event-a",
  title: "Social Event",
  description: "Hang out with friends.",
  clubName: "Campus Social Club",
  startTime: "2026-06-15T23:00:00.000Z",
  endTime: "2026-06-16T01:00:00.000Z",
  locationName: "SLC",
  tags,
  sourceUrl: "https://example.com/social",
  isFreeFood: false,
  createdAt: "2026-06-15T00:00:00.000Z",
});

it("shows parent and sub-tag counts without showing empty social chips", () => {
  const counts = getEventTagCounts([
    makeEvent(["games"]),
    makeEvent(["free-food"]),
  ]);

  expect(counts).toMatchObject({
    "chill-social": 1,
    games: 1,
    "free-food": 1,
  });
});
```

```ts
it("keeps selected sub-tags visible even when the count is zero", () => {
  const visible = getVisibleSocialSubTags([], "games");
  expect(visible).toEqual(["games"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npm test -- src/lib/events/__tests__/filters.test.ts
```

Expected: fail because the parent/sub-tag counts and visibility helpers do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Update the filter logic so:
- `filterEventsByTag("chill-social")` matches any event tagged `chill-social` or one of the social sub-tags
- the top filter row shows `Chill + Social` as a combined count
- the sub-filter row only renders social sub-tags with counts unless one is currently selected

Add a small helper in `src/lib/events/filters.ts` so the UI can keep the selected social sub-tag visible:

```ts
export function getVisibleSocialSubTags(
  counts: Record<string, number>,
  selectedTag?: string,
) {
  return socialSubTagFilters
    .map((item) => item.tag)
    .filter((tag) => counts[tag] > 0 || tag === selectedTag);
}
```

Use the specific labels in the UI:

```tsx
{[
  { tag: "games", label: "Games" },
  { tag: "hangout", label: "Hangout" },
  { tag: "arts-crafts", label: "Arts + Crafts" },
  { tag: "outdoors", label: "Outdoors" },
  { tag: "nightlife", label: "Nightlife" },
  { tag: "wellness", label: "Wellness" },
  { tag: "movie-tv", label: "Movie + TV" },
]}
```

Render the selected social sub-tag as an additional chip on cards and event detail pages when present, while leaving `free-food` visible as a separate top-level badge.

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npm test -- src/lib/events/__tests__/filters.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/events/filters.ts src/components/feed/EventFilters.tsx src/app/events/page.tsx src/components/events/EventCard.tsx src/components/feed/StartingSoonCarousel.tsx src/app/events/[id]/page.tsx src/lib/events/__tests__/filters.test.ts
git commit -m "feat: surface social subcategories in feed ui"
```

### Task 4: Verify the whole change set

**Files:**
- All files touched in Tasks 1-3

- [ ] **Step 1: Run the full targeted test set**

Run:
```bash
npm test -- src/lib/events/__tests__/social-tags.test.ts src/lib/events/__tests__/filters.test.ts src/lib/classification/__tests__/fallback.test.ts src/lib/classification/__tests__/classify-events.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript**

Run:
```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run the production build**

Run:
```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit the verified end state**

```bash
git add .
git commit -m "feat: split chill social into activity categories"
```
