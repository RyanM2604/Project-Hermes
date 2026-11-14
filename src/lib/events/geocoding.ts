import { createHash } from "node:crypto";
import boundary from "./waterloo-boundary.json";
import { isPlaceholderLocation, resolveEventLocation } from "./location";
import { resolveMapLocation } from "./map-venues";
import type { MapLocation } from "./map";

export interface LocationInput { locationName: string; buildingCode?: string; description?: string; sourceUrl?: string }
export interface SavedGeocode {
  locationKey: string; status: string; latitude: number | null; longitude: number | null;
  displayName: string | null; source: string;
}
export interface GeocodeResult {
  status: "resolved" | "outside";
  latitude: number; longitude: number; displayName: string;
}
export function normalizePlace(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}
export function locationKey(input: LocationInput): string {
  return createHash("sha256").update(JSON.stringify(["geocode-v2", ...[input.locationName, input.buildingCode ?? "", input.description ?? ""].map(normalizePlace)])).digest("hex");
}
export function coordinates(latitude: unknown, longitude: unknown): [number, number] | null {
  const valid = (value: unknown) => typeof value === "number" || (typeof value === "string" && value.trim() !== "");
  if (!valid(latitude) || !valid(longitude)) return null;
  const lat = Number(latitude), lon = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lon, lat] : null;
}

// City of Waterloo Public_Base/MapServer/0, WGS84 geometry, 2026-11-14.
// https://gis.waterloo.ca/maps/rest/services/Public/Public_Base/MapServer/0
export function isInWaterloo(point: readonly number[]): boolean {
  function inRing(ring: number[][]) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x, y] = ring[i], [x2, y2] = ring[j];
      const cross = (point[0] - x) * (y2 - y) - (point[1] - y) * (x2 - x);
      if (Math.abs(cross) < 1e-12 && point[0] >= Math.min(x, x2) && point[0] <= Math.max(x, x2) && point[1] >= Math.min(y, y2) && point[1] <= Math.max(y, y2)) return true;
      if ((y > point[1]) !== (y2 > point[1]) && point[0] < (x2 - x) * (point[1] - y) / (y2 - y) + x) inside = !inside;
    }
    return inside;
  }
  return inRing(boundary.coordinates[0]) && !boundary.coordinates.slice(1).some(inRing);
}

export function geocodingQuery(input: LocationInput): string | null {
  const resolved = resolveEventLocation(input);
  const name = isPlaceholderLocation(input.locationName) ? resolved.locationName : input.locationName;
  if (isPlaceholderLocation(name) || /^(?:waterloo|uwaterloo|university of waterloo(?: campus)?|campus|on campus|unknown|tbd)$/i.test(name.trim()) ||
    name.length > 180 || /^(?:for |join |see |details |donations )/i.test(name) || /https?:|@|\b(?:online|virtual|zoom)\b/i.test(name)) return null;
  const cleaned = name.replace(/\b(?:room|rm|unit|suite)\s+[a-z0-9-]+[,]?\s*/gi, "")
    .replace(/\b\d{1,5}-(?=\d{1,6}\s+[a-z])/gi, "").replace(/\s+/g, " ").trim();
  // Search the civic address when a business name precedes it. Providers may
  // know the building even when a tenant is absent from their place index.
  return cleaned.replace(/^.*?,\s*(?=\d{1,6}[a-z]?\s+[a-z])/i, "");
}

function streetKey(value: string): string {
  return normalizePlace(value).replace(/\b(rd|st|ave|dr|blvd|cres|hwy|west|east|north|south)\b/g,
    word => ({ rd: "road", st: "street", ave: "avenue", dr: "drive", blvd: "boulevard", cres: "crescent", hwy: "highway", west: "w", east: "e", north: "n", south: "s" }[word]!));
}
export function selectGeocodingResult(data: unknown, query: string): GeocodeResult | null {
  if (!Array.isArray(data)) return null;
  const civicNumber = /\b(\d{1,6}[a-z]?)\s+[a-z]/i.exec(query)?.[1].toLowerCase();
  const queryKey = streetKey(query);
  const nameTokens = normalizePlace(query.split(",")[0]).split(" ").filter(token => !["the", "in", "at", "ontario", "canada"].includes(token));
  const matches: GeocodeResult[] = [];
  for (const raw of data.slice(0, 5)) {
    if (!raw || typeof raw !== "object") continue;
    const point = coordinates(raw.lat, raw.lon);
    const address = raw.address ?? {};
    const rank = Number(raw.place_rank);
    if (!point || address.country_code !== "ca" || !Number.isFinite(rank) || rank < 24 ||
      ["boundary", "highway", "place"].includes(raw.category) || (rank < 28 && !["amenity", "leisure", "tourism", "shop", "office"].includes(raw.category))) continue;
    if (civicNumber) {
      if (String(address.house_number ?? "").toLowerCase() !== civicNumber || typeof address.road !== "string" ||
        !streetKey(address.road).split(" ").every(token => (` ${queryKey} `).includes(` ${token} `))) continue;
    } else {
      const name = normalizePlace(String(raw.name ?? ""));
      if (!nameTokens.length || !nameTokens.every(token => (` ${name} `).includes(` ${token} `))) continue;
    }
    // Multiple OSM representations of one building are not separate venues.
    if (matches.some(match => Math.hypot(match.longitude - point[0], match.latitude - point[1]) < 0.0003)) continue;
    matches.push({ longitude: point[0], latitude: point[1], displayName: String(raw.name || query), status: isInWaterloo(point) ? "resolved" : "outside" });
  }
  return matches.length === 1 ? matches[0] : null;
}

export function mapSavedLocation(input: LocationInput, saved: SavedGeocode | undefined): MapLocation | null {
  if (!saved || saved.locationKey !== locationKey(input)) return null;
  if (saved.status === "outside") return { venue: null, locationStatus: "outside" };
  const point = coordinates(saved.latitude, saved.longitude);
  if (!["resolved", "error", "rate_limited"].includes(saved.status) || !point) return null;
  if (!isInWaterloo(point)) return { venue: null, locationStatus: "outside" };
  const registered = resolveMapLocation(input).venue;
  const sameBuilding = registered && Math.hypot(registered.coordinates[0] - point[0], registered.coordinates[1] - point[1]) < 0.0003;
  return { locationStatus: "located", venue: {
    id: sameBuilding ? registered.id : `geo:${point[0].toFixed(5)}:${point[1].toFixed(5)}`,
    name: saved.displayName || input.locationName, aliases: [], buildingCodes: [], coordinates: point,
    city: "Waterloo", verifiedFrom: saved.source === "nominatim" ? "https://www.openstreetmap.org/copyright" : saved.source === "registry"
      ? registered?.verifiedFrom ?? "https://uwaterloo.ca/map/" : input.sourceUrl ?? "https://uwaterloo.ca/map/",
  } };
}
