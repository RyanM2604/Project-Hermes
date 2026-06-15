import "server-only";

import { canonicalEventRefreshCoordinator } from "@/ingestion/refresh-canonical-events.server";
import type { CanonicalEventRefreshResult } from "@/ingestion/types";

import { getEvents } from "./repository";
import type { HermesEvent } from "@/types/event";

export interface LoadFreshEventsOptions {
  getEvents?: () => Promise<HermesEvent[]>;
  refresh?: typeof canonicalEventRefreshCoordinator.refresh;
}

function triggerBackgroundRefresh(
  refresh: NonNullable<LoadFreshEventsOptions["refresh"]>,
) {
  void refresh().catch(() => {
    // Best-effort background refresh; canonical data still serves the page.
  });
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
  const events = await getCanonicalEvents();

  try {
    if (events.length > 0) {
      triggerBackgroundRefresh(refresh);
      return events;
    }

    const refreshResult = (await refresh()) as CanonicalEventRefreshResult;

    if (refreshResult.skipped) {
      return events;
    }
  } catch {
    return events;
  }

  return getCanonicalEvents();
}
