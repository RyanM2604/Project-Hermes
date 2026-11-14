import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { backfillLocations, GeocodingError, searchNominatim } from "../geocode-events";
import { locationKey } from "@/lib/events/geocoding";

const event = { id: "one", title: "Meetup", source: "instagram-clubs", sourceUrl: "https://www.instagram.com/p/example/", locationName: "New Venue, 123 Example Road, Waterloo", description: "Meet up", buildingCode: null, geocode: null };
const resolved = { status: "resolved" as const, latitude: 43.472, longitude: -80.54, displayName: "New Venue" };
type Stored = { eventId: string; query: string; source: string; checkedAt: Date; retryAfter: Date | null; status: string; locationKey: string; latitude: number | null; longitude: number | null; displayName: string | null };
function harness(events = [event]) {
  const rows: Stored[] = [];
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ locked: true }]),
    event: { findMany: vi.fn().mockResolvedValueOnce(events).mockResolvedValue([]) },
    eventGeocode: {
      findFirst: vi.fn(async ({ where }: { where: { query?: string; source?: string; status?: string } }) => {
        const matches = rows.filter(row => (!where.query || row.query === where.query) && (!where.source || row.source === where.source) && (!where.status || row.status === where.status));
        return matches.sort((a, b) => +b.checkedAt - +a.checkedAt)[0] ?? null;
      }),
      upsert: vi.fn(async ({ create }: { create: Stored }) => { rows.push(create); return create; }),
    },
  };
  const client = { $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) } as unknown as PrismaClient;
  return { tx, client, rows };
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("ingestion location stage", () => {
  it("performs no lookup or writes in dry runs", async () => {
    const { client, tx } = harness(); const search = vi.fn(), sourceLookup = vi.fn();
    expect(await backfillLocations(client, { dryRun: true, search, sourceLookup })).toMatchObject({ eligible: 1, complete: true });
    expect(search).not.toHaveBeenCalled(); expect(sourceLookup).not.toHaveBeenCalled(); expect(tx.eventGeocode.upsert).not.toHaveBeenCalled();
  });
  it("uses one saved query result for multiple events at the same venue", async () => {
    const { client, rows } = harness([event, { ...event, id: "two" }]);
    const search = vi.fn().mockResolvedValue(resolved);
    const summary = await backfillLocations(client, { search, sourceLookup: async () => null });
    expect(search).toHaveBeenCalledTimes(1); expect(summary).toMatchObject({ resolved: 2, cached: 1 });
    expect(rows.map(row => row.eventId)).toEqual(["one", "two"]);
  });
  it("preserves source coordinates without calling a geocoder", async () => {
    const { client, rows } = harness(); const search = vi.fn();
    await backfillLocations(client, { search, sourceLookup: async () => ({ latitude: 43.472, longitude: -80.54, locationName: "Source venue" }) });
    expect(search).not.toHaveBeenCalled(); expect(rows[0]).toMatchObject({ source: "source", status: "resolved", latitude: 43.472 });
  });
  it("waits at least 15.1 seconds between distinct provider queries", async () => {
    const { client } = harness([event, { ...event, id: "two", locationName: "Other venue" }]);
    let clock = Date.parse("2026-11-14T12:00:00Z");
    const wait = vi.fn(async (ms: number) => { clock += ms; });
    const search = vi.fn().mockResolvedValue(resolved);
    await backfillLocations(client, { nowMs: () => clock, search, sourceLookup: async () => null, wait });
    expect(search).toHaveBeenCalledTimes(2); expect(wait).toHaveBeenCalledWith(15100);
  });
  it("stores throttling and stops the batch rather than repeatedly calling the provider", async () => {
    const { client, rows } = harness([event, { ...event, id: "two", locationName: "Other venue" }]);
    const search = vi.fn().mockRejectedValue(new GeocodingError(true, 120_000));
    expect(await backfillLocations(client, { search, sourceLookup: async () => null })).toMatchObject({ failed: 1, complete: false });
    expect(search).toHaveBeenCalledTimes(1); expect(rows[0]).toMatchObject({ status: "rate_limited" });
  });
  it("does not search if another worker owns the geocoding batch", async () => {
    const { client, tx } = harness(); tx.$queryRaw.mockResolvedValue([{ locked: false }]);
    const search = vi.fn(); expect(await backfillLocations(client, { search })).toMatchObject({ busy: true, complete: false });
    expect(search).not.toHaveBeenCalled();
  });
  it("retains good coordinates when refreshing an unchanged venue fails", async () => {
    const { client, tx, rows } = harness();
    const cached = { locationKey: locationKey({ ...event, buildingCode: undefined }), ...resolved, source: "nominatim", checkedAt: new Date(0), retryAfter: new Date(0) };
    tx.event.findMany.mockReset().mockResolvedValueOnce([{ ...event, geocode: cached }]).mockResolvedValue([]);
    await backfillLocations(client, { search: async () => { throw new GeocodingError(); }, sourceLookup: async () => null });
    expect(rows[0]).toMatchObject({ status: "error", latitude: resolved.latitude, longitude: resolved.longitude });
  });
  it("skips a valid persisted location for unchanged event inputs", async () => {
    const cached = { eventId: "one", locationKey: locationKey({ ...event, buildingCode: undefined }), query: "", status: "resolved", latitude: 43.472, longitude: -80.54, displayName: "New Venue", source: "nominatim", checkedAt: new Date(), retryAfter: null };
    const { client, tx } = harness(); tx.event.findMany.mockReset().mockResolvedValueOnce([{ ...event, geocode: cached }]).mockResolvedValue([]);
    const search = vi.fn(); expect(await backfillLocations(client, { search })).toMatchObject({ skipped: 1 }); expect(search).not.toHaveBeenCalled();
  });
});
describe("provider requests", () => {
  it("identifies the app, restricts results and honors 429 Retry-After", async () => {
    vi.stubEnv("GEOCODING_BASE_URL", "https://example.org/geocoding/");
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 429, headers: { "retry-after": "120" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(searchNominatim("123 Example Road")).rejects.toMatchObject({ throttled: true, retryMs: 120000 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.origin).toBe("https://example.org"); expect(url.searchParams.get("countrycodes")).toBe("ca");
    expect(init.headers["User-Agent"]).toContain("Hermes"); expect(init.redirect).toBe("error");
  });
});
