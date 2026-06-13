import type { IngestionSource } from "../types";
import { uwaterlooHtmlSource } from "./uwaterloo-html";
import { wusaIcsSource } from "./wusa-ics";

export const liveEventSources: readonly IngestionSource[] = [
  wusaIcsSource,
  uwaterlooHtmlSource,
];
