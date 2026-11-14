import "server-only";
import { getEvents } from "./repository";
import type { EventPeriod } from "./feed-period";
import type { HermesEvent } from "@/types/event";
export interface LoadFreshEventsOptions {
  period?: EventPeriod;
  getEvents?: (options?: { period?: EventPeriod }) => Promise<HermesEvent[]>;
  /** Compatibility for callers/tests; ingestion is exclusively worker-driven. */
  refresh?: (...args: never[]) => unknown;
}
export async function loadFreshEvents(options: LoadFreshEventsOptions = {}): Promise<HermesEvent[]> {
  const read = options.getEvents ?? getEvents;
  return options.period ? read({ period: options.period }) : read();
}
