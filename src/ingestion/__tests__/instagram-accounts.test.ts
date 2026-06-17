import { describe, expect, it } from "vitest";

import { instagramAccounts } from "../sources/instagram-accounts";

describe("instagramAccounts", () => {
  it("exports public profile entries for club ingestion", () => {
    expect(instagramAccounts).toEqual([
      {
        clubName: "UW Cheese Club",
        instagramHandle: "uwcheeseclub",
        profileUrl: "https://www.instagram.com/uwcheeseclub/",
        active: true,
        priority: 1,
      },
    ]);
  });
});
