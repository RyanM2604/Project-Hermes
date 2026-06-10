export type {
  EventSourceAdapter,
  EventSourceId,
  NormalizationRejection,
  NormalizationResult,
  NormalizedEventCandidate,
} from "./types";
export { uwaterlooEventsAdapter } from "./uwaterloo-events";
export { createSourceFingerprint, parseRequiredDate } from "./utils";
