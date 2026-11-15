# Incremental collection and fresh Upcoming events

Approved: reduce repeated paid collection, reuse saved posts in dry-runs, and cap
scraper spend. Keep detailed carousel data and existing validation. Upcoming means
starts on the current Toronto calendar day or later and has not ended; old ranges
move to Past. Map scope remains ongoing/today.

Implementation:
- Persist per-account collection checkpoints, next check, and weekly refresh time.
  Daily/48h/72h cadence follows existing priority; six-hour overlap; weekly seven-day
  refresh. First collection remains a bounded latest-12 bootstrap. Saturated later
  windows do not advance the checkpoint and increase the next cap (up to 96).
- Reserve actor budgets atomically in a private ledger before starting paid work.
  Default workflow limit $0.50, calendar-month limit $15. Actor-side
  maxTotalChargeUsd enforces each reservation. Uncertain charges remain reserved;
  authenticated completed-run cost checks release unused reserves once stable.
  These caps cover runs recorded by this pipeline after rollout, not prior/other
  account activity, subscription fees, or OpenAI charges.
- Persist raw posts before advancing a source checkpoint. A short account lease
  prevents duplicate concurrent collections. Source failures retain the checkpoint.
- Dry-runs read saved posts/extractions, never call Apify, and reuse successful
  extraction without AI/image requests. Missing cached extraction remains held.
- No new dependencies. Test filters, budget races, failed/partial runs, cached replay,
  and Toronto day boundaries. Verify migration locally, deploy, and push main.

Provider references: https://docs.apify.com/api/v2/actors-runs-post and
https://docs.apify.com/api/v2/actor-run-get . Completed cost/event statistics may
be preliminary for ten seconds; keep maximum reservations until a mature read.

Verification:
- 432 unit tests passed; nine collection integration tests passed on isolated
  PostgreSQL (budget races, raw persistence, resume, and browser-role denial).
- TypeScript and production build passed; lint has no errors (existing warnings).
- Additive migration deployed; connected database reports all migrations applied.
- Cached preview against saved production posts completed with all HTTP requests
  blocked: zero requests and exit code zero. No paid collection was launched.
- Local Upcoming rendered 89 cards with no start dates before Toronto today;
  Past retained the older multiweek entries, including Fall Chess Lessons.
