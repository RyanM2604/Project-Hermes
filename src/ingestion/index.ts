export { buildCliOutput } from "./cli-output";
export { deduplicateEvents } from "./dedupe-events";
export { fetchSourceText, IngestionFetchError } from "./fetch-source";
export {
  DEFAULT_EVENT_REFRESH_FRESHNESS_MS,
  createCanonicalEventRefreshCoordinator,
  createDefaultCanonicalEventRefreshCoordinator,
  parseEventRefreshFreshnessMs,
} from "./refresh-canonical-events";
export { runIngestion } from "./run-ingestion";
export { normalizedEventCandidateSchema } from "./schema";
export { liveEventSources } from "./sources/registry";
export type {
  CanonicalEventRefreshCoordinator,
  CanonicalEventRefreshOptions,
  CanonicalEventRefreshResult,
  DuplicateEvent,
  FetchText,
  IngestionErrorCode,
  IngestionRejection,
  IngestionRunResult,
  IngestionSource,
  SourceIngestionResult,
} from "./types";
