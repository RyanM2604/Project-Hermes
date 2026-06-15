# Chill + Social Taxonomy Split

## Summary
Hermes currently over-concentrates many unrelated events under `chill-social`, which makes the feed look less useful than it is. This change splits that umbrella into activity-based sub-tags while keeping `free-food` as its own top-level filter.

## Goals
- Keep the current top-level taxonomy recognizable.
- Make social browsing more specific and scannable.
- Avoid a single oversized `chill-social` bucket.
- Keep `free-food` as a first-class category because it is a high-signal campus utility.

## Proposed Tag Model
Top-level tags remain:
- `free-food`
- `hack-dev`
- `career-coop`
- `startup-pitch`
- `music`
- `reels`
- `chill-social`

New activity-based sub-tags under `chill-social`:
- `games`
- `hangout`
- `arts-crafts`
- `outdoors`
- `nightlife`
- `wellness`
- `movie-tv`

## Classification Rules
- Every event may still have one primary tag.
- Events that clearly fit social activity patterns should receive `chill-social` plus one or more sub-tags.
- Do not force a sub-tag if the source evidence is weak.
- Preserve `free-food` as a direct top-level classification when food is the main utility signal.
- Keep the current trust gate for risky categories like `career-coop` and `hack-dev`.

## Ingestion and Normalization
- Update tag derivation helpers to recognize the new social sub-tags.
- Map source keywords and phrases to the most specific sub-tag available.
- Keep source-backed evidence as the source of truth; do not invent finer-grained detail than the text supports.
- Preserve backward compatibility for existing events by allowing `chill-social` to remain valid when no sub-tag can be established.

## UI Behavior
- Keep the main filter row as the top-level tags.
- Add a `chill-social` detail state that can surface the sub-tags without expanding the main filter row permanently.
- Show sub-tags only when they have a meaningful count in the current feed.
- Continue hiding empty top-level pills when they are not selected.
- Keep counts visible on filter chips so the feed size is obvious.

## Data Display
- Feed cards should continue to render based on the primary tag.
- If a social event has a more specific sub-tag, show it as an additional badge or secondary label where it adds clarity.
- Do not replace the top-level social label on cards unless the UI has room for both.

## Testing
- Add ingestion or classification tests for each new social sub-tag.
- Add regression tests for events that should remain plain `chill-social`.
- Add UI/filter tests for:
  - counts
  - hidden zero-count sub-tags
  - selected sub-tags remaining visible even when empty
- Add one test that verifies `free-food` remains top level and unaffected by the social split.

## Non-Goals
- Reworking the entire recommendation system.
- Adding new top-level categories beyond the current list.
- Turning every event into a multi-tag taxonomy explosion.

## Notes
- This is intentionally a taxonomy cleanup, not a redesign of the feed architecture.
- The change should stay backward compatible for existing saved data and historical events.
