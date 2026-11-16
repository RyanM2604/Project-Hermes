import { load } from "cheerio";
import { coordinates, normalizePlace } from "@/lib/events/geocoding";

interface SourceLocation { locationName?: string; latitude?: number; longitude?: number; origin?: "source" | "registry" }
export function readSourceLocation(html: string, title: string): SourceLocation | null {
  const $ = load(html);
  const events: Record<string, unknown>[] = [];
  function visit(value: unknown) {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
    if (types.some(type => typeof type === "string" && /Event$/.test(type))) events.push(record);
    if (record["@graph"]) visit(record["@graph"]);
  }
  $("script[type='application/ld+json']").each((_, node) => {
    try { visit(JSON.parse($(node).text())); } catch { /* Invalid optional metadata does not reject an event. */ }
  });
  const named = events.filter(event => normalizePlace(load(String(event.name ?? "")).text()) === normalizePlace(title));
  const event = named.length === 1 ? named[0] : events.length === 1 && !events[0].name ? events[0] : undefined;
  if (event) {
    const places = Array.isArray(event.location) ? event.location : [event.location];
    if (places.length !== 1 || !places[0] || typeof places[0] !== "object") return null;
    const place = places[0] as Record<string, unknown>;
    const geo = place.geo as Record<string, unknown> | undefined;
    const point = coordinates(geo?.latitude, geo?.longitude);
    const address = place.address as Record<string, unknown> | string | undefined;
    const parts = typeof address === "string" ? [address] : [address?.streetAddress, address?.addressLocality, address?.addressRegion, address?.postalCode];
    const locationName = [...new Set([place.name, ...parts].filter((part): part is string => typeof part === "string" && !!part.trim()))].join(", ");
    if (point || locationName) return { ...(locationName ? { locationName } : {}), ...(point ? { latitude: point[1], longitude: point[0] } : {}) };
  }
  if (events.length) return null;
  let point = coordinates($("[itemprop='latitude']").first().attr("content"), $("[itemprop='longitude']").first().attr("content"));
  const address = $(".card__location .card__address").first().clone();
  address.find(".uw-label").remove();
  address.find("br").replaceWith(", ");
  const locationName = address.text().trim() || $("[itemprop='location'], .field--name-field-event-location, .field--name-field-event-location-address").first().text().trim();
  const maps = $(".card__location [id^='leaflet-map-node-uw-ct-event-']");
  if (maps.length === 1) {
    try {
      const settings = JSON.parse($("script[data-drupal-selector='drupal-settings-json']").text()) as { leaflet?: Record<string, { features?: { type?: string; lat?: unknown; lon?: unknown }[] }> };
      const features = settings.leaflet?.[maps.attr("id")!]?.features;
      if (Array.isArray(features) && features.length === 1 && features[0].type === "point") point = coordinates(features[0].lat, features[0].lon) ?? point;
    } catch { /* Drupal map metadata is optional; retain the assigned address. */ }
  }
  return point || locationName ? { ...(locationName ? { locationName: locationName.replace(/\s+/g, " ") } : {}), ...(point ? { latitude: point[1], longitude: point[0] } : {}) } : null;
}
