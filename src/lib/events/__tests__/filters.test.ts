import { describe, expect, it } from "vitest";

import { filterEventsByTag, parseEventTag } from "../filters";
import { mockEvents } from "../mock-events";

describe("event filters", () => {
  it("parses supported tags from the URL", () => {
    expect(parseEventTag("free-food")).toBe("free-food");
    expect(parseEventTag("hack-dev")).toBe("hack-dev");
  });

  it("ignores unsupported or repeated tag parameters", () => {
    expect(parseEventTag("not-a-tag")).toBeUndefined();
    expect(parseEventTag(["free-food", "hack-dev"])).toBeUndefined();
    expect(parseEventTag(undefined)).toBeUndefined();
  });

  it("filters events by the selected tag", () => {
    const events = filterEventsByTag(mockEvents, "free-food");

    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.tags.includes("free-food"))).toBe(true);
  });

  it("returns all events when no tag is selected", () => {
    expect(filterEventsByTag(mockEvents, undefined)).toBe(mockEvents);
  });
});
