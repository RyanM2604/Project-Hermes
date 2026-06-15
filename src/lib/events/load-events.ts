import "server-only";

import { canonicalEventRefreshCoordinator } from "@/ingestion/refresh-canonical-events.server";

import { getEvents } from "./repository";
import type { HermesEvent } from "@/types/event";

export interface LoadFreshEventsOptions {
  getEvents?: () => Promise<HermesEvent[]>;
  refresh?: typeof canonicalEventRefreshCoordinator.refresh;
}

export async function loadFreshEvents(
  options: LoadFreshEventsOptions = {},
): Promise<HermesEvent[]> {
  const refresh =
    options.refresh ??
    ((refreshOptions?: Parameters<
      typeof canonicalEventRefreshCoordinator.refresh
    >[0]) => canonicalEventRefreshCoordinator.refresh(refreshOptions));
  const getCanonicalEvents = options.getEvents ?? getEvents;

  try {
    await refresh();
  } catch {
    // Best-effort refresh; canonical data still serves the page.
  }

  return getCanonicalEvents();
}
