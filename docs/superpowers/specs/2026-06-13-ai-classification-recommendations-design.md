# AI Classification And Personalized Recommendations Design

## Goal

Add backend-only AI event enrichment, authenticated personalized
recommendations, abuse controls, and tag-driven event card themes without
introducing a chatbot or calling OpenAI during user-facing requests.

## Product Behavior

Hermes continues to provide a chronological discovery feed to every visitor.
Signed-in users additionally see a separate **Recommended for you** section
above the chronological feed.

Recommendations are available only to authenticated users. Anonymous browsing
does not create or display a personalized profile.

Event cards retain one consistent, accessible information hierarchy. Their
visual treatment varies according to the event's persisted primary tag so the
feed is easier to scan without becoming visually inconsistent.

## Architecture

OpenAI is an offline enrichment dependency used by the ingestion pipeline. It
is not called while rendering pages, ranking recommendations, or handling
normal user interactions.

The event pipeline becomes:

```text
fetch -> normalize -> deduplicate -> upsert -> classify new/changed events -> persist
```

Prisma becomes the canonical event data layer. The application reads persisted
events and classifications for event pages, recommendations, and event card
themes.

## Canonical Event Persistence

The Prisma `Event` model stores:

- Stable event ID and source fingerprint
- Source URL and source identifier
- Title, description, organizer, time, and location
- Optional building code and image URL
- Source-derived tags and free-food flag
- Content hash
- Classification status
- Created and updated timestamps

The content hash is computed from fields relevant to classification. An event
is classified only when it is new, its classification-relevant content
changes, or a retry is required.

Ingestion upserts canonical events after normalization and deduplication.
Persisting or classifying one event must not prevent other valid events from
being stored.

## AI Classification

Classification uses the OpenAI API from server-only ingestion or internal job
code. There is no browser-accessible or user-facing AI route.

Only these public event fields may be sent to OpenAI:

- Title
- Description
- Organizer
- Location
- Source-derived tags

User IDs, user profiles, emails, authentication data, interactions, saves, and
RSVPs must never be included in classification requests.

The classifier uses a versioned, tightly scoped prompt. It instructs the model
to classify only from provided evidence, avoid inventing facts, preserve
supported source-derived tags, and express uncertainty through confidence.

Structured model output is validated with Zod before persistence:

- `primaryTag`
- `tags`
- `vibes`
- `audiences`
- `format`
- `confidence`
- `rationale`

`primaryTag` and `tags` use Hermes' supported event-tag vocabulary. The
internal rationale is short and is not displayed directly to users.

The `EventClassification` model stores the current enrichment, prompt version,
model identifier, classification fields, and classified timestamp.

If `OPENAI_API_KEY` is absent, the model output is invalid, the request times
out, or the classification budget is exhausted, ingestion succeeds using the
existing deterministic keyword classification. Failed AI classifications are
marked for bounded retry and never hide an event.

## Personalized Recommendations

Personalized ranking is deterministic, explainable, and computed server-side
from Prisma data. It does not invoke OpenAI.

Only authenticated users receive recommendations. Their recommendation score
uses:

- Positive signals: RSVP, save, open, tag affinity, organizer affinity, and
  classified vibe affinity
- Negative signals: dismissals, cancelled RSVPs, expired events, and repeated
  impressions without later engagement
- Context signals: starting soon, freshness, and diversity across tags and
  organizers

Signal importance follows:

```text
RSVP > save > open > impression
```

Past and dismissed events are excluded. Already-saved or RSVP'd events may
remain eligible because they are useful reminders, but receive a reason that
reflects the existing action.

Cold-start users receive a diverse, timely selection until sufficient
interaction history exists. The initial section is intentionally small and
does not replace or reorder the chronological feed.

Each recommendation may include a deterministic explanation such as:

- `Because you saved hack/dev events`
- `Similar to events you marked Going`
- `Starting soon near events you follow`

Recommendation failures omit the personalized section and preserve the normal
feed.

## Rate Limiting And Abuse Controls

A shared rate-limit interface protects public and authenticated endpoints. The
private MVP uses a database-backed `RateLimitBucket` model with atomic counters
and expiry. Route handlers depend on the interface so the implementation can
later move to Redis or another distributed limiter.

Initial limits:

| Endpoint or operation | Limit |
| --- | --- |
| Interaction logging | 60 requests per minute per IP |
| Save event | 30 requests per minute per user and 60 per minute per IP |
| RSVP event | 30 requests per minute per user and 60 per minute per IP |
| Personalized recommendations | Server-rendered; no public API |
| AI classification | Internal-only; concurrency 2, bounded retries, request timeout, per-run budget, and daily global allowance |

Rate-limited requests return HTTP `429` with `Retry-After`. Interaction logging
continues to fail silently on the client because analytics must never interrupt
browsing.

Public request bodies receive explicit size limits. Interaction metadata also
receives depth and entry-count limits in addition to its existing Zod
validation.

Any future user-triggered AI endpoint must require authentication and implement
both per-user and global cost limits before it is enabled.

## Event Card Themes

Cards use their persisted `primaryTag` to select a deterministic theme:

| Primary tag | Visual treatment |
| --- | --- |
| `free-food` | Amber and coral with a simple food motif |
| `hack-dev` | Cyan and indigo with a restrained grid motif |
| `career-coop` | Blue and emerald with structured linework |
| `chill-social` | Violet and rose with soft circular forms |
| `music` or `reels` | Magenta and purple with waveform or spotlight forms |
| `startup-pitch` | Orange and lime with upward directional forms |
| Unclassified | Neutral blue and zinc fallback |

The layout, semantic structure, focus behavior, tap targets, and content
hierarchy remain consistent across themes. The primary tag remains visible as
text so meaning never depends on color alone. Decorative motifs are hidden from
assistive technology.

Recommended event cards reuse the same card component and display a concise
deterministic `Why this` reason.

## Data Models

The implementation adds these Prisma models:

- `Event`: canonical normalized event data and classification state
- `EventClassification`: current structured enrichment for one event
- `RateLimitBucket`: expiring database-backed rate-limit counters

The existing `Interaction` model remains the recommendation signal source and
references canonical event IDs logically. Existing Supabase-backed saved-event
and RSVP operations remain in place for this phase; recommendation queries
read those records through the authenticated Supabase server client until they
are intentionally migrated to Prisma.

## Error Handling

- Invalid model output is rejected by Zod and replaced with deterministic
  classification.
- Missing OpenAI configuration does not fail ingestion or builds.
- OpenAI errors are recorded without logging raw prompts, event descriptions,
  credentials, or model responses.
- Classification retries are bounded and occur only in internal jobs.
- A single persistence or classification failure does not stop the full
  ingestion run.
- Recommendation failures omit the personalized section.
- Rate-limit failures return `429` and `Retry-After`.

## Testing

Unit tests cover:

- Versioned prompt construction
- Structured-output validation
- Deterministic fallback behavior
- Content-hash generation and unchanged-event classification skipping
- Recommendation weights, exclusions, diversity, cold start, and reasons
- Authenticated-only recommendation access
- Rate-limit boundaries, expiry, and `Retry-After`
- Event-card theme selection

Integration tests cover:

- Ingestion persistence and upserts
- Classification persistence and failure fallback
- Canonical event repository reads
- Rate-limited route-handler responses
- Authenticated and anonymous events-page behavior

Playwright verifies:

- Visually distinct tag themes
- Accessible primary-tag text and focus behavior
- Anonymous users do not see recommendations
- Authenticated users see the separate recommendation section when test
  authentication is available

## Delivery Sequence

Implementation is divided into independently verifiable commits:

1. Canonical Prisma event persistence
2. AI classification pipeline and deterministic fallback
3. Personalized recommendation ranker and section
4. Shared rate limiting and endpoint protections
5. Tag-driven event card themes

Existing unrelated landing-page work and generated Playwright artifacts must
not be included in these commits.
