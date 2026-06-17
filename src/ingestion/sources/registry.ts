import type { IngestionSource } from "../types";
import { instagramPublicSources } from "./instagram-public";
import { uwaterlooHtmlSource } from "./uwaterloo-html";
import { wusaIcsSource } from "./wusa-ics";

export const liveEventSources: readonly IngestionSource[] = [
  wusaIcsSource,
  uwaterlooHtmlSource,
  ...instagramPublicSources,
];
