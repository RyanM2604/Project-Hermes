import { createOpenAIClassifier } from "@/lib/classification/openai-classifier";
import { createPrismaClassificationRepository } from "@/lib/classification/prisma-repository";
import { createPrismaEventPersistenceRepository } from "@/lib/events/persistence";
import type { PrismaClient } from "@prisma/client";

import type {
  ClassificationClassifier,
  ClassificationRepository,
  ClassifyEventsResult,
} from "@/lib/classification/classify-events";
import { classifyEvents } from "@/lib/classification/classify-events";

import { runIngestion } from "./run-ingestion";
import type {
  CanonicalEventRefreshCoordinator,
  CanonicalEventRefreshOptions,
  CanonicalEventRefreshResult,
  IngestionRunResult,
} from "./types";

export const DEFAULT_EVENT_REFRESH_FRESHNESS_MS = 300_000;

export function parseEventRefreshFreshnessMs(
  value: string | null | undefined,
): number {
  if (!value) {
    return DEFAULT_EVENT_REFRESH_FRESHNESS_MS;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_EVENT_REFRESH_FRESHNESS_MS;
}

interface CanonicalEventRefreshDependencies {
  classifyEvents?: typeof classifyEvents;
  classifier?: ClassificationClassifier;
  classificationRepository?: ClassificationRepository;
  databaseUrl?: string | null;
  freshnessWindowMs?: number;
  now?: () => Date;
  persistence?: ReturnType<typeof createPrismaEventPersistenceRepository>;
  runIngestion?: typeof runIngestion;
}

function emptySkippedResult(now: () => Date): CanonicalEventRefreshResult {
  const timestamp = now().toISOString();

  return {
    startedAt: timestamp,
    completedAt: timestamp,
    sources: [],
    events: [],
    duplicates: [],
    persistedEventIds: [],
    skipped: true,
  };
}

function successfulRefreshResult(
  run: IngestionRunResult,
  persistedEventIds: string[],
  classification?: ClassifyEventsResult,
): CanonicalEventRefreshResult {
  return {
    ...run,
    persistedEventIds,
    ...(classification ? { classification } : {}),
    skipped: false,
  };
}

export function createCanonicalEventRefreshCoordinator(
  dependencies: CanonicalEventRefreshDependencies = {},
): CanonicalEventRefreshCoordinator {
  const now = dependencies.now ?? (() => new Date());
  const databaseUrl = dependencies.databaseUrl ?? process.env.DATABASE_URL?.trim();
  const freshnessWindowMs =
    dependencies.freshnessWindowMs ??
    parseEventRefreshFreshnessMs(process.env.EVENT_REFRESH_FRESHNESS_MS);
  const persistence = dependencies.persistence;
  const classificationRepository = dependencies.classificationRepository;
  const classifier = dependencies.classifier;
  const runIngestionWithDependencies = dependencies.runIngestion ?? runIngestion;
  const classifyEventsWithDependencies =
    dependencies.classifyEvents ?? classifyEvents;
  let inFlight: Promise<CanonicalEventRefreshResult> | null = null;
  let freshAt: number | null = null;
  let lastSuccessfulResult: CanonicalEventRefreshResult | null = null;

  async function refresh(
    options: CanonicalEventRefreshOptions = {},
  ): Promise<CanonicalEventRefreshResult> {
    if (!databaseUrl) {
      return lastSuccessfulResult ?? emptySkippedResult(now);
    }

    if (inFlight) {
      return inFlight;
    }

    const currentTime = now().getTime();
    if (
      !options.force &&
      freshAt !== null &&
      currentTime - freshAt < freshnessWindowMs &&
      lastSuccessfulResult
    ) {
      return {
        ...lastSuccessfulResult,
        skipped: true,
      };
    }

    inFlight = (async () => {
      try {
        const run = await runIngestionWithDependencies({
          persistence,
        });
        const persistedEventIds = run.persistence?.persistedEventIds ?? [];
        let classificationResult: ClassifyEventsResult | undefined;

        if (
          persistedEventIds.length > 0 &&
          classifier &&
          classificationRepository
        ) {
          classificationResult = await classifyEventsWithDependencies({
            classifier,
            repository: classificationRepository,
            eventIds: persistedEventIds,
            reclassify: options.reclassify,
          });
        }

        const successfulSources = run.sources.some(
          (source) => source.status === "succeeded",
        );
        const persistenceSucceeded =
          run.persistence !== undefined && run.persistence.failedCount === 0;
        const refreshResult = successfulRefreshResult(
          run,
          persistedEventIds,
          classificationResult,
        );

        if (successfulSources && persistenceSucceeded) {
          freshAt = now().getTime();
          lastSuccessfulResult = refreshResult;
        }

        return refreshResult;
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  }

  return { refresh };
}

export function createDefaultCanonicalEventRefreshCoordinator(
  client: PrismaClient,
) {
  return createCanonicalEventRefreshCoordinator({
    persistence: createPrismaEventPersistenceRepository(client),
    classificationRepository: createPrismaClassificationRepository(client),
    classifier: createOpenAIClassifier(),
  });
}
