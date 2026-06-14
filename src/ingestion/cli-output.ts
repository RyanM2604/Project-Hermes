import type { IngestionRunResult } from "./types";

export function buildCliOutput(run: IngestionRunResult) {
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
