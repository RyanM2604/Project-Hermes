import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

interface EventRsvpRow {
  event_id: string;
}

export async function loadEventGoingCounts(
  eventIds: readonly string[],
): Promise<Record<string, number>> {
  if (eventIds.length === 0) {
    return {};
  }

  try {
    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("event_rsvps")
      .select("event_id")
      .eq("status", "going")
      .in("event_id", eventIds);

    if (error) {
      throw error;
    }

    return (data ?? []).reduce<Record<string, number>>((counts, row) => {
      const eventId = (row as EventRsvpRow).event_id;
      counts[eventId] = (counts[eventId] ?? 0) + 1;
      return counts;
    }, {});
  } catch {
    return {};
  }
}
