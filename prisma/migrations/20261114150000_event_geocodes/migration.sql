BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE public.event_geocodes (
  event_id TEXT PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  location_key TEXT NOT NULL,
  query TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('resolved', 'outside', 'unresolved', 'error', 'rate_limited')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  display_name TEXT,
  source TEXT NOT NULL CHECK (source IN ('source', 'registry', 'nominatim', 'none')),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retry_after TIMESTAMPTZ,
  CONSTRAINT event_geocodes_coordinates_check CHECK (
    (latitude IS NULL AND longitude IS NULL) OR
    (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  ),
  CONSTRAINT event_geocodes_resolved_check CHECK (status <> 'resolved' OR latitude IS NOT NULL)
);
CREATE INDEX event_geocodes_query_source_idx ON public.event_geocodes(query, source);
CREATE INDEX event_geocodes_source_checked_at_idx ON public.event_geocodes(source, checked_at);
ALTER TABLE public.event_geocodes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_geocodes FROM anon, authenticated;
COMMIT;
