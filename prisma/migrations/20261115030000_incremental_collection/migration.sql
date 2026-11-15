BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE public.social_collection_state (
 account_handle TEXT PRIMARY KEY,
 last_success_at TIMESTAMPTZ,
 last_review_at TIMESTAMPTZ,
 next_check_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 lease_until TIMESTAMPTZ,
 results_limit INTEGER NOT NULL DEFAULT 12 CHECK (results_limit BETWEEN 1 AND 96)
);
CREATE TABLE public.apify_collection_runs (
 id TEXT PRIMARY KEY,
 workflow_id TEXT NOT NULL,
 account_handle TEXT NOT NULL,
 provider_run_id TEXT UNIQUE,
 results_limit INTEGER NOT NULL DEFAULT 12 CHECK (results_limit BETWEEN 1 AND 96),
 reserved_micros INTEGER NOT NULL CHECK (reserved_micros > 0),
 charged_micros INTEGER CHECK (charged_micros >= 0),
 processed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX apify_collection_runs_created_at_idx ON public.apify_collection_runs(created_at);
CREATE INDEX apify_collection_runs_workflow_id_idx ON public.apify_collection_runs(workflow_id);
ALTER TABLE public.social_collection_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apify_collection_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.social_collection_state, public.apify_collection_runs FROM anon, authenticated;
COMMIT;
