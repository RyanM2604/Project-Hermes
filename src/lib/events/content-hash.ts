import { createHash } from "node:crypto";

import type { NormalizedEventCandidate } from "@/lib/events/adapters";

function normalizeWhitespace(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ");
}

export function createEventContentHash(
  candidate: NormalizedEventCandidate,
): string {
  const classificationContent = {
    title: normalizeWhitespace(candidate.title),
    description: normalizeWhitespace(candidate.description),
    clubName: normalizeWhitespace(candidate.clubName),
    locationName: normalizeWhitespace(candidate.locationName),
    tags: candidate.tags.map(normalizeWhitespace).sort(),
  };

  return createHash("sha256")
    .update(JSON.stringify(classificationContent))
    .digest("hex");
}
