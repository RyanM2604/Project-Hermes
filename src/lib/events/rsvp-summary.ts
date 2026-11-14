import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

import { prisma } from "@/lib/db/prisma";

interface EventRsvpRow {
  event_id: string;
  user_id: string;
  status: string;
  updated_at: string;
}

export async function loadEventGoingCounts(
  eventIds: readonly string[],
  options: { throwOnUnavailable?: boolean } = {},
): Promise<Record<string, number>> {
  if (eventIds.length === 0) {
    return {};
  }

  try {
    const parents = new Map<string, string | null>();
    const checked = new Set<string>();
    const pending = new Set(eventIds);
    while (pending.size) {
      const batch = [...pending].slice(0, 100);
      batch.forEach(id => { pending.delete(id); checked.add(id); });
      const aliases = await prisma.event.findMany({
        where: { OR: [{ id: { in: batch } }, { supersededById: { in: batch } }] },
        select: { id: true, supersededById: true },
      });
      for (const alias of aliases) {
        parents.set(alias.id, alias.supersededById);
        for (const id of [alias.id, alias.supersededById]) {
          if (id && !checked.has(id)) pending.add(id);
        }
      }
    }
    function canonicalId(id: string): string {
      const visited = new Set<string>();
      while (parents.get(id)) {
        if (visited.has(id)) throw new Error("Event alias cycle");
        visited.add(id);
        id = parents.get(id)!;
      }
      return id;
    }
    const ids = [...new Set([...eventIds, ...parents.keys()])];
    const canonical = new Map(ids.map(id => [id, canonicalId(id)]));
    const supabase = createSupabaseServiceRoleClient();
    const responses = new Map<string, Map<string, EventRsvpRow>>();
    for (let chunk = 0; chunk < ids.length; chunk += 100) {
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("event_rsvps")
          .select("event_id,user_id,status,updated_at")
          .in("event_id", ids.slice(chunk, chunk + 100)).order("id").range(offset, offset + 499);
        if (error) throw error;
        const rows = (data ?? []) as EventRsvpRow[];
        for (const row of rows) {
          const id = canonical.get(row.event_id) ?? row.event_id;
          const users = responses.get(id) ?? new Map<string, EventRsvpRow>();
          const previous = users.get(row.user_id);
          if (!previous || Date.parse(row.updated_at) > Date.parse(previous.updated_at) ||
            (Date.parse(row.updated_at) === Date.parse(previous.updated_at) && row.event_id === id)) {
            users.set(row.user_id, row);
          }
          responses.set(id, users);
        }
        if (!rows.length) break;
      }
    }
    // The latest response wins across merged IDs, including cancellations.
    const totals = new Map([...responses].map(([id, users]) => [id, [...users.values()].filter(row => row.status === "going").length]));
    const counts: Record<string, number> = {};
    for (const [id, root] of canonical) counts[id] = totals.get(root) ?? 0;
    return counts;
  } catch (error) {
    if (options.throwOnUnavailable) throw error;
    return {};
  }
}
