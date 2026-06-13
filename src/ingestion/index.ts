export { buildCliOutput } from "./cli-output";
export { deduplicateEvents } from "./dedupe-events";
export { fetchSourceText, IngestionFetchError } from "./fetch-source";
export { runIngestion } from "./run-ingestion";
export { normalizedEventCandidateSchema } from "./schema";
export { liveEventSources } from "./sources/registry";
export type {
  DuplicateEvent,
  FetchText,
  IngestionErrorCode,
  IngestionRejection,
  IngestionRunResult,
  IngestionSource,
  SourceIngestionResult,
} from "./types";
