import { describe, expect, it } from "vitest";

import { liveEventSources } from "../sources/registry";

describe("liveEventSources", () => {
  it("includes public Instagram sources when configured", () => {
    expect(
      liveEventSources.some((source) => source.url.includes("instagram.com")),
    ).toBe(true);
  });
});
