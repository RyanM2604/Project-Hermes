import { describe, expect, it } from "vitest";

import { socialSubTags } from "../social-tags";

describe("social tags", () => {
  it("exposes the shared social sub-tags in a stable order", () => {
    expect(socialSubTags).toEqual([
      "games",
      "hangout",
      "arts-crafts",
      "outdoors",
      "nightlife",
      "wellness",
      "movie-tv",
    ]);
  });
});
