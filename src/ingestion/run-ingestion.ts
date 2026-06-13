import type { NormalizedEventCandidate } from "@/lib/events/adapters";

import { deduplicateEvents } from "./dedupe-events";
import { fetchSourceText } from "./fetch-source";
import { normalizedEventCandidateSchema } from "./schema";
import { liveEventSources } from "./sources/registry";
import type {
  FetchText,
  IngestionErrorCode,
  IngestionRejection,
  IngestionRunResult,
  IngestionSource,
  SourceIngestionResult,
} from "./types";

interface RunIngestionOptions {
  sources?: readonly IngestionSource[];
  fetchText?: FetchText;
  now?: () => Date;
}

const ERROR_CODES = new Set<IngestionErrorCode>([
  "http-error",
  "network-error",
  "parse-error",
  "response-too-large",
  "timeout",
  "unexpected-content-type",
  "unknown-error",
]);

function errorCode(error: unknown, fallback: IngestionErrorCode): IngestionErrorCode {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    ERROR_CODES.has(error.code as IngestionErrorCode)
  ) {
    return error.code as IngestionErrorCode;
  }

  return fallback;
}

async function runSource(
  source: IngestionSource,
  fetchText: FetchText,
): Promise<{
  result: SourceIngestionResult;
  events: NormalizedEventCandidate[];
}> {
  let raw: string;

  try {
    raw = await fetchText(source);
  } catch (error) {
    return {
      events: [],
      result: {
        source: source.id,
        sourceUrl: source.url,
        status: "failed",
        acceptedCount: 0,
        rejectedCount: 0,
        rejections: [],
        errorCode: errorCode(error, "network-error"),
      },
    };
  }

  let normalizationResults;

  try {
    normalizationResults = source.parse(raw);
  } catch {
    return {
      events: [],
      result: {
        source: source.id,
        sourceUrl: source.url,
        status: "failed",
        acceptedCount: 0,
        rejectedCount: 0,
        rejections: [],
        errorCode: "parse-error",
      },
    };
  }

  const events: NormalizedEventCandidate[] = [];
  const rejections: IngestionRejection[] = [];

  for (const normalizationResult of normalizationResults) {
    if (!normalizationResult.ok) {
      rejections.push(normalizationResult.rejection);
      continue;
    }

    const validated = normalizedEventCandidateSchema.safeParse(
      normalizationResult.event,
    );

    if (!validated.success) {
      rejections.push({
        source: source.id,
        recordId: normalizationResult.event.sourceFingerprint,
        reason: "invalid-candidate",
      });
      continue;
    }

    events.push(validated.data);
  }

  return {
    events,
    result: {
      source: source.id,
      sourceUrl: source.url,
      status: "succeeded",
      acceptedCount: events.length,
      rejectedCount: rejections.length,
      rejections,
    },
  };
}

export async function runIngestion(
  options: RunIngestionOptions = {},
): Promise<IngestionRunResult> {
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const sourceRuns = await Promise.all(
    (options.sources ?? liveEventSources).map((source) =>
      runSource(source, options.fetchText ?? fetchSourceText),
    ),
  );
  const deduplicated = deduplicateEvents(
    sourceRuns.flatMap((sourceRun) => sourceRun.events),
  );

  return {
    startedAt,
    completedAt: now().toISOString(),
    sources: sourceRuns.map((sourceRun) => sourceRun.result),
    events: deduplicated.events,
    duplicates: deduplicated.duplicates,
  };
}
