import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { createInstagramSource } from "../sources/instagram-public";

const fixture = readFileSync(
  new URL("../__fixtures__/instagram-public-profile.html", import.meta.url),
  "utf8",
);

const source = createInstagramSource({
  clubName: "UW Cheese Club",
  instagramHandle: "uwcheeseclub",
  profileUrl: "https://www.instagram.com/uwcheeseclub/",
  active: true,
  priority: 1,
});

describe("createInstagramSource", () => {
  it("promotes a clear public event post and rejects a non-event post", () => {
    const results = source.parse(fixture);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      ok: true,
      event: {
        source: "instagram-clubs",
        sourceUrl: "https://www.instagram.com/p/DZpt0I1ESPa/",
        clubName: "UW Cheese Club",
        title: "UW Cheese Club Fall Social",
        locationName: "SLC Great Hall",
        isFreeFood: true,
      },
    });
    expect(results[0].ok && results[0].event.tags).toEqual([
      "free-food",
      "games",
      "chill-social",
    ]);

    expect(results[1]).toMatchObject({
      ok: false,
      rejection: {
        source: "instagram-clubs",
        reason: "invalid-date",
      },
    });
  });

  it("extracts a stable fingerprint for the promoted post", () => {
    const results = source.parse(fixture);

    expect(results[0].ok && results[0].event.sourceFingerprint).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });
});
