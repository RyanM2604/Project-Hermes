import { describe, expect, it } from "vitest";

import type { NormalizedEventCandidate } from "@/lib/events/adapters";

import { createEventContentHash } from "../content-hash";

const candidate: NormalizedEventCandidate = {
  source: "wusa-events",
  sourceUrl: "https://wusa.ca/event/free-food-social",
  sourceFingerprint: "a".repeat(64),
  title: "Free Food Social",
  description: "Meet other students.",
  clubName: "WUSA",
  startTime: "2026-06-18T21:00:00.000Z",
  endTime: "2026-06-18T23:00:00.000Z",
  locationName: "SLC Great Hall",
  buildingCode: "SLC",
  tags: ["free-food", "chill-social"],
  imageUrl: "https://wusa.ca/images/free-food-social.png",
  isFreeFood: true,
};

function untrustedCandidate(
  overrides: Record<string, unknown>,
): NormalizedEventCandidate {
  // Ingestion adapters can receive malformed runtime strings before validation.
  return { ...candidate, ...overrides } as NormalizedEventCandidate;
}

describe("createEventContentHash", () => {
  it("returns a lowercase SHA-256 hex hash", () => {
    expect(createEventContentHash(candidate)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("matches the stable canonical candidate hash", () => {
    expect(createEventContentHash(candidate)).toBe(
      "04b9ff837faeb182bb4393f27aec7e27badf3c57932aace50b882f968597e425",
    );
  });

  it("ignores fields that are not classification-relevant", () => {
    expect(
      createEventContentHash({
        ...candidate,
        source: "uwaterloo-events",
        sourceUrl: "https://changed.example/event",
        sourceFingerprint: "b".repeat(64),
        startTime: "2027-01-01T00:00:00.000Z",
        endTime: "2027-01-01T01:00:00.000Z",
        buildingCode: "PAC",
        imageUrl: "https://changed.example/image.png",
        isFreeFood: false,
      }),
    ).toBe(createEventContentHash(candidate));
  });

  it.each([
    ["title", { title: "Changed title" }],
    ["description", { description: "Changed description" }],
    ["club name", { clubName: "Changed club" }],
    ["location", { locationName: "Changed location" }],
    ["source-derived tags", { tags: ["music"] }],
  ] satisfies [string, Partial<NormalizedEventCandidate>][])(
    "includes %s",
    (_field, override) => {
      expect(createEventContentHash({ ...candidate, ...override })).not.toBe(
        createEventContentHash(candidate),
      );
    },
  );

  it("sorts source-derived tags before hashing", () => {
    expect(
      createEventContentHash({
        ...candidate,
        tags: ["chill-social", "free-food"],
      }),
    ).toBe(createEventContentHash(candidate));
  });

  it("normalizes whitespace in source-derived tags", () => {
    expect(
      createEventContentHash(
        untrustedCandidate({
          tags: ["  free-food ", "\tchill-social\n"],
        }),
      ),
    ).toBe(createEventContentHash(candidate));
  });

  it("normalizes whitespace in classification-relevant text", () => {
    expect(
      createEventContentHash({
        ...candidate,
        title: "  Free   Food\nSocial  ",
        description: "\tMeet   other\nstudents. ",
        clubName: " WUSA\n",
        locationName: " SLC\tGreat   Hall ",
      }),
    ).toBe(createEventContentHash(candidate));
  });

  it("normalizes Unicode composition in classification-relevant content", () => {
    expect(
      createEventContentHash(
        untrustedCandidate({
          title: "Café Social",
          tags: ["café"],
        }),
      ),
    ).toBe(
      createEventContentHash(
        untrustedCandidate({
          title: "Cafe\u0301 Social",
          tags: ["cafe\u0301"],
        }),
      ),
    );
  });
});
