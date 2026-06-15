import { describe, expect, it } from "vitest";

import { formatEventLocation } from "../format";
import { resolveEventLocation } from "../location";

describe("resolveEventLocation", () => {
  it("extracts a building-level location from description text", () => {
    expect(
      resolveEventLocation({
        locationName: "Location not provided",
        description:
          "Join us in Enterprise Theatre, East Campus 5 for a talk about campus life.",
      }),
    ).toEqual({
      source: "description",
      locationName: "Enterprise Theatre, EC5",
      buildingCode: "EC5",
    });
  });

  it("falls back to a source lookup message when no location can be found", () => {
    expect(
      resolveEventLocation({
        locationName: "Location not provided",
        description: "A general campus talk with more details later.",
      }),
    ).toEqual({
      source: "missing",
      locationName: "See source for location",
    });
  });
});

describe("formatEventLocation", () => {
  it("uses the description fallback when the structured location is missing", () => {
    expect(
      formatEventLocation({
        locationName: "Location not provided",
        description:
          "Join us in Black and Gold Room, SLC 2144 for networking and pizza.",
      }),
    ).toBe("Black and Gold Room, SLC 2144");
  });

  it("shows a source lookup message when the location cannot be resolved", () => {
    expect(
      formatEventLocation({
        locationName: "Location not provided",
        description: "More details coming soon.",
      }),
    ).toBe("See source for location");
  });
});
