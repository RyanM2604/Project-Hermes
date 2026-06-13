import type { NormalizedEventCandidate } from "@/lib/events/adapters";

import type { DuplicateEvent } from "./types";

function normalizeSignaturePart(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function canonicalSignature(event: NormalizedEventCandidate): string {
  return [
    normalizeSignaturePart(event.title),
    event.startTime,
    normalizeSignaturePart(event.locationName),
  ].join("|");
}

export function deduplicateEvents(events: NormalizedEventCandidate[]): {
  events: NormalizedEventCandidate[];
  duplicates: DuplicateEvent[];
} {
  const retained: NormalizedEventCandidate[] = [];
  const duplicates: DuplicateEvent[] = [];
  const byFingerprint = new Map<string, NormalizedEventCandidate>();
  const byCanonicalSignature = new Map<string, NormalizedEventCandidate>();

  for (const event of events) {
    const fingerprintMatch = byFingerprint.get(event.sourceFingerprint);

    if (fingerprintMatch) {
      duplicates.push({
        keptSourceFingerprint: fingerprintMatch.sourceFingerprint,
        discardedSourceFingerprint: event.sourceFingerprint,
        reason: "source-fingerprint",
      });
      continue;
    }

    const signature = canonicalSignature(event);
    const canonicalMatch = byCanonicalSignature.get(signature);

    if (canonicalMatch) {
      duplicates.push({
        keptSourceFingerprint: canonicalMatch.sourceFingerprint,
        discardedSourceFingerprint: event.sourceFingerprint,
        reason: "canonical-signature",
      });
      continue;
    }

    retained.push(event);
    byFingerprint.set(event.sourceFingerprint, event);
    byCanonicalSignature.set(signature, event);
  }

  return { events: retained, duplicates };
}
