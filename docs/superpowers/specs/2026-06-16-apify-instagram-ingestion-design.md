# Apify Instagram Ingestion Design

## Goal
Replace the current Instagram scraping path with Apify's `apify/instagram-post-scraper` actor so Hermes can ingest public club Instagram posts as event candidates.

## Scope
This change only affects the Instagram ingestion source. The rest of Hermes ingestion, deduplication, location resolution, classification, and persistence should continue to work unchanged.

## Requirements
- Use the existing public Instagram account config as the source of truth for which accounts to ingest.
- Run the Apify Instagram post scraper actor directly from Hermes code.
- Prefer a synchronous actor call that returns dataset items immediately.
- Normalize actor output into Hermes event candidates without going back through HTML parsing.
- Keep Instagram ingestion conservative:
  - only promote posts that look like real event announcements
  - ignore generic updates, reposts, memes, and non-event content
- Preserve existing source provenance so every imported event remains traceable to the originating Instagram profile/post.
- Support a clear fallback env contract:
  - primary token: `APIFY_TOKEN`
  - optional compatibility fallback: `APIFY_API_TOKEN`

## Proposed Architecture

### 1. Apify fetch helper
Create a small Apify helper in the ingestion layer that:
- builds a sync request to `apify/instagram-post-scraper`
- sends the actor input with:
  - `username`: the configured public profile URL or username
  - `resultsLimit`: a bounded per-profile post limit
  - `skipPinnedPosts`: true
  - `dataDetailLevel`: basic data unless the parser needs richer detail
- authenticates using the token from env
- parses the returned dataset items

The helper should return a JSON-serializable array of actor items, not HTML.

### 2. Instagram normalization
Replace the current Instagram HTML parsing path with a normalization path that converts Apify actor items into `NormalizedEventCandidate` records.

The normalizer should:
- derive a stable shortcode or source fingerprint from the actor item
- use caption/title text to decide whether the post is event-like
- parse start/end time from caption text when present
- extract `locationName` from actor fields first, then caption fallback
- resolve building codes using the existing location helper where possible
- derive tags using the current tagging logic
- reject posts without enough evidence to look like upcoming events

### 3. Ingestion wiring
Update the ingestion runner so the `instagram-clubs` source uses the Apify helper and the Apify-backed normalization path.

The source registry itself should remain the same except for the new backend behavior.

## Data Flow

1. Hermes loads the active Instagram accounts from `instagram-accounts.ts`.
2. For each account, Hermes runs the Apify actor against the public profile URL or handle.
3. Apify returns structured post records.
4. Hermes filters and normalizes those records into event candidates.
5. The candidates proceed through the existing:
   - validation
   - source URL checking
   - deduplication
   - classification
   - persistence

## Guardrails
- Reject missing or malformed actor responses instead of fabricating events.
- Cap the number of posts ingested per account per run.
- Only promote posts with enough evidence of:
  - a date/time
  - event language
  - and some location/context signal when possible
- Keep pinned post handling deterministic by skipping pinned posts by default.
- If Apify is unavailable or the token is missing, fail the Instagram source cleanly without breaking WUSA or UW ingestion.

## Testing
- Add a helper test that verifies the Apify request payload and token handling.
- Add a normalization test for a realistic Apify Instagram post item.
- Add an ingestion test that confirms `instagram-clubs` flows through the Apify path.
- Keep the existing non-Instagram ingestion tests intact.

## Out of Scope
- No official Meta API integration.
- No background scheduler changes.
- No changes to the event feed UI.
- No generalized social ingestion beyond Instagram public profiles.
