import { describe, expect, it } from "vitest";

import { createSourceFingerprint, parseRequiredDate } from "../utils";

describe("createSourceFingerprint", () => {
  it("creates stable fingerprints ignoring surrounding source ID whitespace", () => {
    const fingerprint = createSourceFingerprint("wusa-events", "event-123");

    expect(createSourceFingerprint("wusa-events", "  event-123 \n")).toBe(
      fingerprint,
    );
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("parseRequiredDate", () => {
  it("converts a valid date to ISO", () => {
    expect(parseRequiredDate("2026-09-14T18:00:00-04:00")).toBe(
      "2026-09-14T22:00:00.000Z",
    );
  });

  it("returns null for a malformed date", () => {
    expect(parseRequiredDate("not-a-date")).toBeNull();
  });
});
