export type {
  EventSourceAdapter,
  EventSourceId,
  NormalizationRejection,
  NormalizationResult,
  NormalizedEventCandidate,
} from "./types";
export {
  uwaterlooEventsAdapter,
  type UWaterlooEventRecord,
} from "./uwaterloo-events";
export { createSourceFingerprint, parseRequiredDate } from "./utils";
