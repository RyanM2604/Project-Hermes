import type {
  EventSourceId,
  NormalizationRejection,
  NormalizationResult,
  NormalizedEventCandidate,
} from "@/lib/events/adapters";

export type IngestionErrorCode =
  | "http-error"
  | "network-error"
  | "parse-error"
  | "response-too-large"
  | "timeout"
  | "unexpected-content-type"
  | "unknown-error";

export interface IngestionSource {
  readonly id: EventSourceId;
  readonly url: string;
  readonly acceptedContentTypes: readonly string[];
  parse(raw: string): NormalizationResult[];
}

export interface InvalidCandidateRejection {
  source: EventSourceId;
  recordId?: string;
  reason: "invalid-candidate";
}

export type IngestionRejection =
  | NormalizationRejection
  | InvalidCandidateRejection;

export interface DuplicateEvent {
  keptSourceFingerprint: string;
  discardedSourceFingerprint: string;
  reason: "source-fingerprint" | "canonical-signature";
}

export interface SourceIngestionResult {
  source: EventSourceId;
  sourceUrl: string;
  status: "succeeded" | "failed";
  acceptedCount: number;
  rejectedCount: number;
  rejections: IngestionRejection[];
  errorCode?: IngestionErrorCode;
}

export interface IngestionRunResult {
  startedAt: string;
  completedAt: string;
  sources: SourceIngestionResult[];
  events: NormalizedEventCandidate[];
  duplicates: DuplicateEvent[];
}

export type FetchText = (source: IngestionSource) => Promise<string>;
