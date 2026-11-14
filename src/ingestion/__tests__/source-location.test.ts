import { describe, expect, it } from "vitest";
import { readSourceLocation } from "../source-location";
import { wusaIcsSource } from "../sources/wusa-ics";

describe("source-supplied location facts", () => {
  it("preserves an iCalendar GEO pair", () => {
    const [event] = wusaIcsSource.parse("BEGIN:VEVENT\nUID:geo-test\nSUMMARY:Meetup\nURL:https://wusa.ca/event/test\nDTSTART:20261114T180000Z\nDTEND:20261114T200000Z\nLOCATION:Campus venue\nGEO:43.472;-80.54\nEND:VEVENT");
    expect(event).toMatchObject({ ok: true, event: { latitude: 43.472, longitude: -80.54 } });
  });
  it("extracts Event location coordinates and address from structured source data", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "Event", name: "Meetup", location: { "@type": "Place", name: "New Venue", geo: { latitude: "43.472", longitude: "-80.54" }, address: { streetAddress: "123 Example Rd", addressLocality: "Waterloo" } } })}</script>`;
    expect(readSourceLocation(html, "Meetup")).toMatchObject({ latitude: 43.472, longitude: -80.54, locationName: "New Venue, 123 Example Rd, Waterloo" });
  });
  it("reads UW event map coordinates without using footer or unrelated map points", () => {
    const settings = { leaflet: { "leaflet-map-node-uw-ct-event-123-field-uw-event-location-coord": { features: [{ type: "point", lat: 43.473663, lon: -80.538647 }] }, footer: { features: [{ type: "point", lat: 0, lon: 0 }] } } };
    const html = `<div class="card__location"><div class="card__address"><span class="uw-label">Location Address:</span>ECH - East Campus Hall<br>200 University Ave West<br>Waterloo</div><div id="leaflet-map-node-uw-ct-event-123-field-uw-event-location-coord"></div></div><div property="v:latitude">0</div><script data-drupal-selector="drupal-settings-json">${JSON.stringify(settings)}</script>`;
    expect(readSourceLocation(html, "Exhibit")).toEqual({ latitude: 43.473663, longitude: -80.538647, locationName: "ECH - East Campus Hall, 200 University Ave West, Waterloo" });
  });
  it("does not select a different event or an ambiguous location", () => {
    const html = `<script type="application/ld+json">${JSON.stringify([{ "@type": "Event", name: "Other", location: { name: "Other Place", geo: { latitude: 43.47, longitude: -80.54 } } }, { "@type": "Event", name: "Another", location: { name: "Elsewhere" } }])}</script>`;
    expect(readSourceLocation(html, "Meetup")).toBeNull();
    expect(readSourceLocation(`<script type="application/ld+json">{"@type":"Event","name":"Other","location":{"name":"Wrong venue"}}</script>`, "Meetup")).toBeNull();
  });
});
