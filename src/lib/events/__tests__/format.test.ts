import { describe, expect, it } from "vitest";

import { formatEventLocation } from "../format";

describe("formatEventLocation", () => {
  it("adds a building code when the location does not include it", () => {
    expect(
      formatEventLocation({
        locationName: "Great Hall",
        buildingCode: "SLC",
      }),
    ).toBe("Great Hall, SLC");
  });

  it("does not repeat a building code already in the location", () => {
    expect(
      formatEventLocation({
        locationName: "QNC 2501",
        buildingCode: "QNC",
      }),
    ).toBe("QNC 2501");
  });

  it("shows the location cleanly when no building code is known", () => {
    expect(formatEventLocation({ locationName: "Waterloo Park" })).toBe(
      "Waterloo Park",
    );
  });
});
