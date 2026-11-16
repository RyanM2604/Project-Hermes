import { describe, expect, it } from "vitest";
import { coordinates, isInWaterloo, locationKey, geocodingQuery, selectGeocodingResult, mapSavedLocation } from "../geocoding";

const event = { locationName: "123 Example Road, Waterloo", description: "Meet us", buildingCode: undefined };
const result = { lat: "43.472", lon: "-80.54", place_rank: 30, category: "building", name: "Example venue", address: { house_number: "123", road: "Example Road", city: "Waterloo", country_code: "ca" } };
describe("automatic event locations", () => {
  it("accepts finite source pairs and checks the actual city polygon", () => {
    expect(coordinates(43.472, -80.54)).toEqual([-80.54, 43.472]);
    expect(coordinates(undefined, -80.54)).toBeNull();
    expect(coordinates(91, -80.54)).toBeNull();
    expect(coordinates(NaN, -80.54)).toBeNull();
    expect(isInWaterloo([-80.54, 43.472])).toBe(true);
    expect(isInWaterloo([-80.493, 43.4516])).toBe(false);
  });
  it("fingerprints the input and does not search city-only or absent venues", () => {
    expect(locationKey(event)).not.toBe(locationKey({ ...event, locationName: "Elsewhere" }));
    expect(geocodingQuery({ locationName: "Revive Karaoke, 28 King St N, Waterloo, ON" })).toBe("28 King St N, Waterloo, ON");
    expect(geocodingQuery({ locationName: "RARE Nightclub – 24 King St N, Waterloo, ON" })).toBe("24 King St N, Waterloo, ON");
    expect(geocodingQuery({ locationName: "Waterloo" })).toBeNull();
    expect(geocodingQuery({ locationName: "See source for location" })).toBeNull();
    expect(geocodingQuery({ locationName: "for Stock the Bank, WUSA’s annual food drive!" })).toBeNull();
    expect(geocodingQuery({ locationName: "New Venue, 19-105 Lexington Rd, Waterloo" })).toContain("105 Lexington");
  });
  it("matches a building address but rejects city centroids and wrong street numbers", () => {
    expect(selectGeocodingResult([result], event.locationName)?.status).toBe("resolved");
    expect(selectGeocodingResult([{ ...result, place_rank: 16, category: "boundary" }], event.locationName)).toBeNull();
    expect(selectGeocodingResult([{ ...result, address: { ...result.address, house_number: "124" } }], event.locationName)).toBeNull();
    expect(selectGeocodingResult([{ ...result, address: { ...result.address, road: "Other Road" } }], event.locationName)).toBeNull();
  });
  it("rejects ambiguous places and marks precise outside-city matches outside", () => {
    expect(selectGeocodingResult([result, { ...result, lat: "43.49" }], event.locationName)).toBeNull();
    expect(selectGeocodingResult([{ ...result, lat: "43.4516", lon: "-80.493" }], event.locationName)?.status).toBe("outside");
    expect(selectGeocodingResult([{ ...result, name: "Unrelated place", address: { country_code: "ca" } }], "Named Venue")).toBeNull();
  });
  it("does not put stale cached coordinates onto an edited event", () => {
    const saved = { locationKey: locationKey(event), status: "resolved", latitude: 43.472, longitude: -80.54, displayName: "Example venue", source: "nominatim" };
    expect(mapSavedLocation(event, saved)?.locationStatus).toBe("located");
    expect(mapSavedLocation({ ...event, locationName: "New address" }, saved)).toBeNull();
  });
});
