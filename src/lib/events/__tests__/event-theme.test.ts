import { describe, expect, it } from "vitest";

import type { EventTag, HermesEvent } from "@/types/event";

import { getEventTheme, getEventThemeForEvent } from "../event-theme";

const supportedTags: EventTag[] = [
  "free-food",
  "hack-dev",
  "career-coop",
  "chill-social",
  "music",
  "reels",
  "startup-pitch",
];

describe("getEventTheme", () => {
  it.each(supportedTags)("returns a deterministic theme for %s", (tag) => {
    expect(getEventTheme(tag)).toEqual(getEventTheme(tag));
    expect(getEventTheme(tag).label).not.toBe("Campus event");
  });

  it("uses the same visual family for music and reels", () => {
    expect(getEventTheme("music").motif).toBe("wave");
    expect(getEventTheme("reels").motif).toBe("wave");
    expect(getEventTheme("music").mediaClassName).toBe(
      getEventTheme("reels").mediaClassName,
    );
  });

  it("returns the neutral theme for missing and unsupported tags", () => {
    expect(getEventTheme()).toEqual(getEventTheme("not-a-tag"));
    expect(getEventTheme().label).toBe("Campus event");
  });

  it("prefers the persisted primary tag and falls back to the first tag", () => {
    const event = {
      primaryTag: "career-coop",
      tags: ["free-food", "career-coop"],
    } as HermesEvent;

    expect(getEventThemeForEvent(event).label).toBe("Career & co-op");
    expect(
      getEventThemeForEvent({ ...event, primaryTag: undefined }).label,
    ).toBe("Free food");
  });
});
