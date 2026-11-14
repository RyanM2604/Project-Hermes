import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { event: { findMany: vi.fn() } } }));
vi.mock("@/lib/supabase/service-role", () => ({ createSupabaseServiceRoleClient: vi.fn() }));
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { loadEventGoingCounts } from "../rsvp-summary";

const aliases = [{ id: "canonical", supersededById: null }, { id: "alias", supersededById: "canonical" }, { id: "old", supersededById: "alias" }];
const rows = [{ event_id: "canonical", user_id: "one" }, { event_id: "alias", user_id: "one" }, { event_id: "old", user_id: "two" }].map(row => ({ ...row, status: "going", updated_at: "2026-11-14T12:00:00Z" }));
const range = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.event.findMany).mockImplementation((async (args: Parameters<typeof prisma.event.findMany>[0]) => {
    const clauses = args?.where?.OR as { id?: { in: string[] }; supersededById?: { in: string[] } }[];
    return aliases.filter(row => clauses.some(clause => clause.id?.in.includes(row.id) || (row.supersededById && clause.supersededById?.in.includes(row.supersededById)))) as never;
  }) as typeof prisma.event.findMany);
  range.mockImplementation(async (start: number) => ({ data: start === 0 ? rows : [], error: null }));
  const query = { select: () => query, eq: () => query, in: () => query, order: () => query, range };
  vi.mocked(createSupabaseServiceRoleClient).mockReturnValue({ from: () => query } as unknown as ReturnType<typeof createSupabaseServiceRoleClient>);
});
describe("Going aggregation", () => {
  it("deduplicates users across canonical and multi-hop superseded IDs", async () => {
    expect(await loadEventGoingCounts(["canonical"])).toMatchObject({ canonical: 2 });
    expect(await loadEventGoingCounts(["old"])).toMatchObject({ old: 2 });
  });
  it("reads beyond the first page and counts distinct users", async () => {
    range.mockImplementation(async (start: number) => ({ data: start === 0 ? Array.from({ length: 500 }, (_, i) => ({ event_id: "canonical", user_id: `u${i}`, status: "going", updated_at: "2026-11-14T12:00:00Z" })) : start === 500 ? [{ event_id: "old", user_id: "last", status: "going", updated_at: "2026-11-14T12:00:00Z" }] : [], error: null }));
    expect((await loadEventGoingCounts(["canonical"])).canonical).toBe(501);
  });
  it("propagates strict failures and preserves the existing feed fallback", async () => {
    range.mockResolvedValue({ data: null, error: new Error("counts offline") });
    await expect(loadEventGoingCounts(["canonical"], { throwOnUnavailable: true })).rejects.toThrow("counts offline");
    await expect(loadEventGoingCounts(["canonical"])).resolves.toEqual({});
  });
  it("does not loop on corrupt alias cycles", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([{ id: "canonical", supersededById: "alias" }, { id: "alias", supersededById: "canonical" }] as never);
    await expect(loadEventGoingCounts(["canonical"], { throwOnUnavailable: true })).rejects.toThrow("cycle");
  });
  it("a newer cancellation on the canonical event overrides an old Going alias", async () => {
    range.mockImplementation(async (start: number) => ({ data: start === 0 ? [
      { event_id: "old", user_id: "one", status: "going", updated_at: "2026-11-14T12:00:00Z" },
      { event_id: "canonical", user_id: "one", status: "cancelled", updated_at: "2026-11-14T12:01:00Z" },
    ] : [], error: null }));
    expect((await loadEventGoingCounts(["canonical"])).canonical).toBe(0);
  });
});
