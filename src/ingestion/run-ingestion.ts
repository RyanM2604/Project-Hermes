import type { NormalizedEventCandidate } from "@/lib/events/adapters";
import {
  persistEvents,
  type EventPersistenceRepository,
} from "@/lib/events/persistence";

import { deduplicateEvents } from "./dedupe-events";
import { fetchSourceText } from "./fetch-source";
import {
  fetchApifyInstagramPosts,
} from "./fetch-apify";
import { normalizedEventCandidateSchema } from "./schema";
import { liveEventSources } from "./sources/registry";
import type {
  FetchText,
  IngestionErrorCode,
  IngestionRejection,
  IngestionRunResult,
  IngestionSource,
  SourceIngestionResult,
  ValidateSourceUrl,
} from "./types";
import { validateSourceUrl } from "./validate-source-url";

interface RunIngestionOptions {
  sources?: readonly IngestionSource[];
  fetchText?: FetchText;
  now?: () => Date;
  persistence?: EventPersistenceRepository;
  validateSourceUrl?: ValidateSourceUrl;
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
const SOURCE_URL_VALIDATION_CONCURRENCY = 5;

async function fetchTextForSource(source: IngestionSource): Promise<string> {
  if (source.id === "instagram-clubs") {
    return JSON.stringify(await fetchApifyInstagramPosts(source));
  }

  return fetchSourceText(source);
}

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
  sourceUrlValidator: ValidateSourceUrl,
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

  const candidates: NormalizedEventCandidate[] = [];
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

    candidates.push(validated.data);
  }

  const sourceUrlAvailability = Array<boolean>(candidates.length);
  let nextCandidateIndex = 0;

  async function validateCandidateSources(): Promise<void> {
    while (nextCandidateIndex < candidates.length) {
      const candidate = candidates[nextCandidateIndex];
      const candidateIndex = nextCandidateIndex;
      nextCandidateIndex += 1;

      sourceUrlAvailability[candidateIndex] = await sourceUrlValidator(
        candidate.sourceUrl,
      );
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(SOURCE_URL_VALIDATION_CONCURRENCY, candidates.length),
      },
      () => validateCandidateSources(),
    ),
  );

  const events = candidates.filter((candidate, index) => {
    if (!sourceUrlAvailability[index]) {
        rejections.push({
          source: source.id,
          recordId: candidate.sourceFingerprint,
          reason: "dead-source-url",
        });

        return false;
    }

    return true;
  });

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
      runSource(
        source,
        options.fetchText ?? fetchTextForSource,
        options.validateSourceUrl ?? validateSourceUrl,
      ),
    ),
  );
  const deduplicated = deduplicateEvents(
    sourceRuns.flatMap((sourceRun) => sourceRun.events),
  );
  const persistence = options.persistence
    ? await persistEvents(deduplicated.events, options.persistence)
    : undefined;

  return {
    startedAt,
    completedAt: now().toISOString(),
    sources: sourceRuns.map((sourceRun) => sourceRun.result),
    events: deduplicated.events,
    duplicates: deduplicated.duplicates,
    ...(persistence ? { persistence } : {}),
  };
}
