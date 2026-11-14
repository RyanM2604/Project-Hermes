import type { Prisma, PrismaClient } from "@prisma/client";
import { coordinates, geocodingQuery, isInWaterloo, locationKey, normalizePlace, selectGeocodingResult, type GeocodeResult } from "@/lib/events/geocoding";
import { resolveMapLocation } from "@/lib/events/map-venues";
import type { EventSourceId } from "@/lib/events/adapters";
import { fetchSourceText } from "./fetch-source";
import { readSourceLocation } from "./source-location";

export class GeocodingError extends Error {
  constructor(readonly throttled = false, readonly retryMs = 3600_000) { super("geocoding-unavailable"); }
}
export async function searchNominatim(query: string): Promise<GeocodeResult | null> {
  const base = process.env.GEOCODING_BASE_URL || "https://nominatim.openstreetmap.org/";
  const url = new URL("search", base.endsWith("/") ? base : base + "/");
  if (url.protocol !== "https:") throw new GeocodingError();
  url.search = new URLSearchParams({ q: `${query}, Ontario, Canada`, format: "jsonv2", addressdetails: "1", limit: "5", countrycodes: "ca", viewbox: "-80.70,43.65,-80.25,43.25", bounded: "1" }).toString();
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(8000), headers: {
    "User-Agent": process.env.GEOCODING_USER_AGENT || "Project-Hermes-Events/0.1 (Waterloo event discovery)",
    "Accept-Language": "en", accept: "application/json",
  } });
  if (response.status === 429) {
    const raw = response.headers.get("retry-after");
    const delay = raw && /^\d+$/.test(raw) ? Number(raw) * 1000 : raw ? Date.parse(raw) - Date.now() : 3600_000;
    throw new GeocodingError(true, Number.isFinite(delay) ? Math.max(60_000, delay) : 3600_000);
  }
  if (!response.ok) throw new GeocodingError();
  if (Number(response.headers.get("content-length")) > 100_000) throw new GeocodingError();
  const body = await response.text();
  if (body.length > 100_000) throw new GeocodingError();
  return selectGeocodingResult(JSON.parse(body), query);
}

type LocationEvent = { id: string; source: string; sourceUrl: string; title: string; locationName: string; description: string; buildingCode: string | null };
const campusUrl = "https://services5.arcgis.com/z87D0RdgTttiUQbV/arcgis/rest/services/BuildingsView/FeatureServer/0/query?where=1%3D1&outFields=buildingCode,buildingName,parentBuildingCode&outSR=4326&f=geojson";
let campusBuildings: Promise<{ name: string; code: string; point: [number, number] }[]> | undefined;
async function campusLocation(name: string) {
  campusBuildings ??= (async () => {
    const html = await fetchSourceText({ id: "uwaterloo-events", url: campusUrl, acceptedContentTypes: ["application/json", "application/geo+json"], parse: () => [] }, { timeoutMs: 8000, fetchImpl: (url, init) => fetch(url, { ...init, redirect: "error" }) });
    const body = JSON.parse(html) as { features?: { properties?: { buildingCode?: string; buildingName?: string; parentBuildingCode?: string | null }; geometry?: { type?: string; coordinates?: number[] } }[] };
    return (body.features ?? []).flatMap(feature => {
      const point = coordinates(feature.geometry?.coordinates?.[1], feature.geometry?.coordinates?.[0]);
      return point && feature.geometry?.type === "Point" && feature.properties?.buildingCode && feature.properties.buildingName && !feature.properties.parentBuildingCode
        ? [{ name: feature.properties.buildingName, code: feature.properties.buildingCode, point }] : [];
    });
  })();
  const query = ` ${normalizePlace(name)} `;
  const matches = (await campusBuildings).filter(building => [building.name, building.code].some(alias => query.includes(` ${normalizePlace(alias)} `)));
  return matches.length === 1 ? { locationName: matches[0].name, latitude: matches[0].point[1], longitude: matches[0].point[0], origin: "registry" as const } : null;
}
export async function loadSourceLocation(event: LocationEvent) {
  const url = new URL(event.sourceUrl);
  let facts: ReturnType<typeof readSourceLocation> = null;
  if (event.source !== "instagram-clubs" && url.protocol === "https:" && !url.username && !url.password &&
    ["wusa.ca", "www.wusa.ca", "uwaterloo.ca", "www.uwaterloo.ca"].includes(url.hostname)) {
    const html = await fetchSourceText({ id: event.source as EventSourceId, url: url.href, acceptedContentTypes: ["text/html"], parse: () => [] },
      { timeoutMs: 8000, fetchImpl: (input, init) => fetch(input, { ...init, redirect: "error" }) });
    facts = readSourceLocation(html, event.title);
  }
  if (coordinates(facts?.latitude, facts?.longitude)) return facts;
  const name = facts?.locationName ?? event.locationName;
  if (resolveMapLocation({ locationName: name }).venue || !geocodingQuery({ locationName: name })) return facts;
  try { return await campusLocation(name) ?? facts; } catch { return facts; }
}

export interface LocationBackfillOptions {
  where?: Prisma.EventWhereInput;
  deadline?: number;
  dryRun?: boolean;
  nowMs?: () => number;
  search?: typeof searchNominatim;
  sourceLookup?: typeof loadSourceLocation;
  wait?: (ms: number) => Promise<void>;
}
export async function backfillLocations(client: PrismaClient, options: LocationBackfillOptions = {}) {
  const nowMs = options.nowMs ?? Date.now;
  const deadline = options.deadline ?? nowMs() + 120_000;
  const summary = { eligible: 0, resolved: 0, outside: 0, unresolved: 0, failed: 0, cached: 0, skipped: 0, dryRun: !!options.dryRun, complete: true, busy: false };
  if (nowMs() >= deadline) return { ...summary, complete: false };
  // One worker/connection handles the entire small batch. No distributed
  // geocoding, no parallel requests, and a shared 4/minute provider ceiling.
  // ponytail: this holds a worker DB connection for at most two minutes in normal
  // ingestion; use a hosted geocoder if volume requires a larger worker fleet.
  return client.$transaction(async tx => {
    const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(80411234) AS locked`;
    if (!lock.locked) return { ...summary, busy: true, complete: false };
    let cursor: string | undefined;
    while (nowMs() < deadline) {
      const events = await tx.event.findMany({
        where: { AND: [options.where ?? {}, { supersededById: null, endTime: { gt: new Date(nowMs()) } }, ...(cursor ? [{ id: { gt: cursor } }] : [])] },
        orderBy: { id: "asc" }, take: 50, include: { geocode: true },
      });
      if (!events.length) return summary;
      for (const event of events) {
        if (nowMs() >= deadline) return { ...summary, complete: false };
        cursor = event.id;
        const input = { ...event, buildingCode: event.buildingCode ?? undefined };
        const key = locationKey(input);
        const previous = event.geocode;
        if (previous?.locationKey === key && (!previous.retryAfter || previous.retryAfter.getTime() > nowMs())) { summary.skipped++; continue; }
        summary.eligible++;
        if (options.dryRun) continue; // No provider or source-page requests in dry runs.
        let query = geocodingQuery(input) ?? "";
        let source = "none";
        let result: { status: string; latitude?: number; longitude?: number; displayName?: string } | null = null;
        let sourceFailed = false;
        const registered = resolveMapLocation(input);
        if (registered.venue) {
          result = { status: registered.locationStatus === "outside" ? "outside" : "resolved", latitude: registered.venue.coordinates[1], longitude: registered.venue.coordinates[0], displayName: registered.venue.name };
          source = "registry";
        } else if (registered.locationStatus === "outside" || registered.locationStatus === "online") {
          result = { status: registered.locationStatus === "outside" ? "outside" : "unresolved" };
        } else {
          if (deadline - nowMs() < 9000) return { ...summary, complete: false };
          try {
            const facts = await (options.sourceLookup ?? loadSourceLocation)(event);
            const point = coordinates(facts?.latitude, facts?.longitude);
            if (point) {
              result = { status: isInWaterloo(point) ? "resolved" : "outside", latitude: point[1], longitude: point[0], displayName: facts?.locationName ?? event.locationName };
              source = facts?.origin ?? "source";
            } else if (facts?.locationName) {
              const known = resolveMapLocation({ locationName: facts.locationName });
              if (known.venue) {
                result = { status: known.locationStatus === "outside" ? "outside" : "resolved", latitude: known.venue.coordinates[1], longitude: known.venue.coordinates[0], displayName: known.venue.name };
                source = "source";
              } else query = geocodingQuery({ locationName: facts.locationName }) ?? "";
            }
          } catch { sourceFailed = true; }
        }
        const normalizedQuery = normalizePlace(query);
        let retryAfter: Date | null = null;
        let checkedAt = new Date(nowMs());
        if (!result && query) {
          const cached = await tx.eventGeocode.findFirst({ where: { query: normalizedQuery, source: "nominatim", OR: [{ retryAfter: null }, { retryAfter: { gt: new Date(nowMs()) } }] }, orderBy: { checkedAt: "desc" } });
          if (cached) {
            result = { status: cached.status, ...(cached.latitude !== null && cached.longitude !== null ? { latitude: cached.latitude, longitude: cached.longitude } : {}), ...(cached.displayName ? { displayName: cached.displayName } : {}) };
            retryAfter = cached.retryAfter; checkedAt = cached.checkedAt; summary.cached++;
          } else {
            const throttle = await tx.eventGeocode.findFirst({ where: { source: "nominatim", status: "rate_limited", retryAfter: { gt: new Date(nowMs()) } } });
            if (throttle) return { ...summary, complete: false };
            const last = await tx.eventGeocode.findFirst({ where: { source: "nominatim" }, orderBy: { checkedAt: "desc" } });
            const delay = last ? Math.max(0, last.checkedAt.getTime() + 15_100 - nowMs()) : 0;
            if (deadline - nowMs() < delay + 9000) return { ...summary, complete: false };
            if (delay) await (options.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms))))(delay);
            try { result = await (options.search ?? searchNominatim)(query); }
            catch (error) {
              result = { status: error instanceof GeocodingError && error.throttled ? "rate_limited" : "error" };
              retryAfter = new Date(nowMs() + (error instanceof GeocodingError ? error.retryMs : 3600_000));
            }
            checkedAt = new Date(nowMs());
          }
          source = "nominatim";
        }
        if (!result) result = { status: sourceFailed ? "error" : "unresolved" };
        if (!retryAfter && source === "nominatim" && ["resolved", "outside"].includes(result.status)) retryAfter = new Date(nowMs() + 30 * 86400_000);
        if (!retryAfter && !["resolved", "outside"].includes(result.status)) retryAfter = new Date(nowMs() + (result.status === "error" ? 3600_000 : 7 * 86400_000));
        if (["error", "rate_limited"].includes(result.status) && previous?.locationKey === key && coordinates(previous.latitude, previous.longitude)) {
          result = { ...result, latitude: previous.latitude!, longitude: previous.longitude!, displayName: previous.displayName ?? event.locationName };
        }
        const data = { locationKey: key, query: normalizedQuery, status: result.status, latitude: result.latitude ?? null,
          longitude: result.longitude ?? null, displayName: result.displayName ?? null, source, checkedAt, retryAfter };
        await tx.eventGeocode.upsert({ where: { eventId: event.id }, create: { eventId: event.id, ...data }, update: data });
        if (result.status === "resolved") summary.resolved++;
        else if (result.status === "outside") summary.outside++;
        else if (["error", "rate_limited"].includes(result.status)) summary.failed++;
        else summary.unresolved++;
        if (result.status === "rate_limited") return { ...summary, complete: false };
      }
    }
    return { ...summary, complete: false };
  }, { maxWait: 5000, timeout: Math.max(1000, deadline - nowMs()) + 15_000 });
}
