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
  it("promotes a structured Apify post item into an event candidate", () => {
    const results = source.parse(
      JSON.stringify([
        {
          shortCode: "DZpt0I1ESPa",
          caption:
            "UW Cheese Club Fall Social\nJoin us on June 20, 2026 at 7 PM in SLC for free pizza and games.",
          timestamp: "2026-06-20T19:00:00.000Z",
          locationName: "SLC Great Hall",
          displayUrl: "https://example.com/post.jpg",
          url: "https://www.instagram.com/p/DZpt0I1ESPa/",
        },
        {
          shortCode: "ignore-me",
          caption: "Just a normal post",
          timestamp: "2026-06-20T19:00:00.000Z",
        },
      ]),
    );

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
        reason: "missing-required-field",
      },
    });
  });

  it("infers relative dates from Cheese Club style captions", () => {
    const results = source.parse(
      JSON.stringify([
        {
          shortCode: "today-post",
          caption:
            "Cheese Club today! 5pm QNC 1502! Come relax and cool down with some delicious cheese!",
          timestamp: "2026-05-19T17:27:15.000Z",
          locationName: "QNC 1502",
          url: "https://www.instagram.com/p/today-post/",
        },
        {
          shortCode: "tomorrow-post",
          caption:
            "Cheese Club takes over everything tomorrow. Come join us muahahahaha!!",
          timestamp: "2026-06-01T23:53:53.000Z",
          locationName: "QNC 1502",
          url: "https://www.instagram.com/p/tomorrow-post/",
        },
      ]),
    );

    expect(results[0]).toMatchObject({
      ok: true,
      event: {
        startTime: "2026-05-19T21:00:00.000Z",
        locationName: "QNC 1502",
      },
    });
    expect(results[1]).toMatchObject({
      ok: true,
      event: {
        startTime: "2026-06-02T23:53:53.000Z",
        locationName: "QNC 1502",
      },
    });
  });

  it("extracts a stable fingerprint for the promoted post", () => {
    const results = source.parse(
      JSON.stringify([
        {
          shortCode: "DZpt0I1ESPa",
          caption:
            "UW Cheese Club Fall Social\nJoin us on June 20, 2026 at 7 PM in SLC for free pizza and games.",
          timestamp: "2026-06-20T19:00:00.000Z",
          locationName: "SLC Great Hall",
        },
      ]),
    );

    expect(results[0].ok && results[0].event.sourceFingerprint).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });
});
