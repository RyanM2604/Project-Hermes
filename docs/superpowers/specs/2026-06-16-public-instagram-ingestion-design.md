# Public Instagram Ingestion Design

## Goal

Add a configurable ingestion source for public Instagram club accounts so
Hermes can discover student club activities and surface them in the Events tab.
The first version should be conservative, source-backed, and compatible with
the existing ingestion, deduplication, classification, and persistence
pipeline.

## Scope

The first Instagram milestone covers:

- A repository-local config file listing public Instagram accounts.
- A new Instagram ingestion source that reads that config.
- Scraping only public profile pages and their recent posts.
- Turning only obvious event announcements into normalized event candidates.
- Reusing the existing dedupe, location resolution, classification, and Prisma
  persistence pipeline.
- Structured rejections for posts that are not clearly events.
- Tests for config loading, parsing, and rejection behavior.

This milestone does not cover:

- Private or authenticated Instagram access.
- Meta API integration.
- Story scraping, DM ingestion, comment scraping, or follower data.
- Ranker/personalization changes beyond the existing classifier.
- Social graph ingestion or organizer analytics.

## Non-Goals

Hermes should not try to model all Instagram content. The source is only a
best-effort event feed for public club profiles. General updates, memes,
reposts, and non-event posts should be rejected rather than forced into the
Events tab.

## Proposed Config

Add a committed config file, likely under `src/ingestion/sources/`, that lists
public account definitions with fields like:

- `clubName`
- `instagramHandle`
- `profileUrl`
- optional `active` / `priority` metadata

The config should be easy to update without changing parser code. A plain TypeScript
module is acceptable for the first pass because it keeps type safety and avoids
new parsing infrastructure.

## Architecture

The Instagram source should follow the same source contract as the existing
WUSA and UW sources:

- `id`
- `url`
- accepted content types
- `parse(raw: string)`

`src/ingestion/fetch-source.ts` should keep owning HTTP retrieval, timeouts,
and content-type validation. The new Instagram source should only parse raw
HTML/text and produce `NormalizationResult` values.

`src/ingestion/run-ingestion.ts` should treat Instagram like any other source.
Its accepted candidates should pass through:

1. Zod validation
2. dead-source URL checks
3. deduplication
4. classification
5. persistence

The source must not bypass the canonical pipeline.

## Parsing Strategy

Instagram public pages are noisy and unstable, so the parser should be strict.
The source should only promote a post when there is enough evidence that it is
an actual event announcement.

Promote a post only when the content includes most of the following:

- explicit event language such as event, RSVP, join, meeting, workshop,
  talk, social, hangout, info session, screening, mixer, or tournament
- a date or day reference
- a time reference or clear scheduling cue
- a campus or Waterloo-relevant location cue, or a source-linked location
- enough organizer context to map the post to the club account

Reject posts that are only:

- promotional graphics with no date/time
- generic reminders
- memes or reposts
- story-like status updates
- non-public pages that cannot be read without login

If a post looks like an event but is missing a location, it can still be
promoted if the title and caption clearly describe a campus activity. The
existing location resolver should then attempt structured extraction and
description fallback.

## Candidate Shape

Instagram-derived normalized candidates should populate the same Hermes event
fields as other sources:

- `source`
- `sourceUrl`
- `sourceFingerprint`
- `title`
- `description`
- `clubName`
- `startTime`
- `endTime`
- `locationName`
- `buildingCode` when available
- `tags`
- `imageUrl` when available
- `isFreeFood`

The source fingerprint should be stable for a post and must not depend on
ephemeral ordering or transient HTML details.

## Tagging Strategy

Instagram should not invent overly specific tags. It should derive only
obvious source-level tags from the post content and let the classifier refine
the result later.

Use conservative heuristics for obvious signals:

- free food
- career/co-op
- hack/dev
- startup/pitch
- music
- reels/media
- social activity sub-tags when clearly present

If the post is ambiguous, prefer no tag or `general` rather than forcing the
post into a narrow bucket.

## Deduplication

Instagram posts must deduplicate against:

- repeated posts from the same account
- duplicate event announcements from different accounts
- events already ingested from WUSA or UW listings

Reuse the existing source-fingerprint dedupe first, then the canonical
signature dedupe. The canonical signature should continue to prioritize title,
time, and location.

## Error Handling

- One bad profile or one malformed post should not stop the full ingestion run.
- If a public profile cannot be fetched or parsed, it should produce a
  structured failed source result.
- If the page requires login or changes structure, the parser should reject the
  affected posts instead of inventing candidates.
- Do not log raw HTML, personal data, cookies, or credentials.

## Testing

Add tests for:

- loading the Instagram config
- promoting a clear event post
- rejecting a non-event post
- rejecting login-gated or malformed content
- deduplication against existing canonical events

Keep the fixtures small and synthetic. The goal is parser behavior, not
archival fidelity to Instagram’s live markup.

## Implementation Notes

This should start as a public-profile scraper using repository config because
it matches the current ingestion architecture and does not require Meta API
access.

If public scraping becomes too brittle, the next step would be to split the
Instagram source into:

- profile discovery
- post extraction
- event promotion heuristics
- canonical candidate normalization

That separation would make later replacements easier without changing the
downstream Hermes pipeline.
