import type { ClassifyEventsResult } from "@/lib/classification/classify-events";

import type { IngestionRunResult } from "./types";

export interface CliOutputRunResult extends IngestionRunResult {
  classification?: ClassifyEventsResult;
}

export function buildCliOutput(run: CliOutputRunResult) {
  return {
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    sources: run.sources.map((source) => ({
      source: source.source,
      status: source.status,
      acceptedCount: source.acceptedCount,
      rejectedCount: source.rejectedCount,
      ...(source.errorCode ? { errorCode: source.errorCode } : {}),
      rejectionReasons: [...new Set(source.rejections.map(({ reason }) => reason))],
    })),
    eventCount: run.events.length,
    duplicateCount: run.duplicates.length,
    ...(run.persistence ? { persistence: run.persistence } : {}),
    ...(run.classification ? { classification: run.classification } : {}),
    events: run.events.map((event) => ({
      source: event.source,
      sourceUrl: event.sourceUrl,
      sourceFingerprint: event.sourceFingerprint,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      locationName: event.locationName,
      ...(event.buildingCode ? { buildingCode: event.buildingCode } : {}),
      tags: event.tags,
      isFreeFood: event.isFreeFood,
    })),
  };
}
