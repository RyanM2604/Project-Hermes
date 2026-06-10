import type { BuildingCode, EventTag } from "@/types/event";

export type EventSourceId =
  | "uwaterloo-events"
  | "wusa-events"
  | "wusa-clubs";

export interface NormalizedEventCandidate {
  source: EventSourceId;
  sourceUrl: string;
  sourceFingerprint: string;
  title: string;
  description: string;
  clubName: string;
  startTime: string;
  endTime: string;
  locationName: string;
  buildingCode?: BuildingCode;
  tags: EventTag[];
  imageUrl?: string;
  isFreeFood: boolean;
}

export interface NormalizationRejection {
  source: EventSourceId;
  recordId?: string;
  reason: "missing-required-field" | "invalid-date";
}

export type NormalizationResult =
  | { ok: true; event: NormalizedEventCandidate }
  | { ok: false; rejection: NormalizationRejection };

export interface EventSourceAdapter<TRawRecord> {
  readonly source: EventSourceId;
  parseRaw(raw: string): TRawRecord[];
  normalize(record: TRawRecord): NormalizationResult;
  sourceFingerprint(record: TRawRecord): string | null;
}
