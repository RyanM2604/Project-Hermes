import { describe, expect, it, vi } from "vitest";

import { fetchApifyInstagramPosts } from "../fetch-apify";

describe("fetchApifyInstagramPosts", () => {
  it("posts to the Apify actor sync dataset endpoint with the configured token", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));

      expect(url.origin).toBe("https://api.apify.com");
      expect(url.pathname).toBe(
        "/v2/actors/apify~instagram-post-scraper/run-sync-get-dataset-items",
      );
      expect(url.searchParams.get("format")).toBe("json");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer test-token",
        "content-type": "application/json",
        accept: "application/json",
      });

      return new Response(JSON.stringify([{ shortCode: "abc123" }]), {
        headers: { "content-type": "application/json" },
      });
    });

    await expect(
      fetchApifyInstagramPosts(
        {
          id: "instagram-clubs",
          url: "https://www.instagram.com/uwcheeseclub/",
          acceptedContentTypes: ["application/json"],
          parse: () => [],
        },
        {
          apiToken: "test-token",
          fetchImpl,
        },
      ),
    ).resolves.toEqual([{ shortCode: "abc123" }]);
  });

  it("fails closed when the token is missing", async () => {
    await expect(
      fetchApifyInstagramPosts({
        id: "instagram-clubs",
        url: "https://www.instagram.com/uwcheeseclub/",
        acceptedContentTypes: ["application/json"],
        parse: () => [],
      }),
    ).rejects.toThrow(/Missing APIFY_TOKEN/);
  });
  it.each(["not json", "{}", '[{"error":"account unavailable"}]', '[{}]'])("fails closed on malformed or upstream-error datasets: %s", async (body) => {
    await expect(fetchApifyInstagramPosts({ id: "instagram-clubs", url: "https://www.instagram.com/club/", acceptedContentTypes: [], parse: () => [] }, { apiToken: "test-token", fetchImpl: async () => new Response(body) })).rejects.toThrow();
  });
  it.each([["not_found", "account-not-found"], ["no_items", "account-empty-or-private"]])("preserves the actionable source reason for %s", async (error, code) => {
    await expect(fetchApifyInstagramPosts({ id: "instagram-clubs", url: "https://www.instagram.com/club/", acceptedContentTypes: [], parse: () => [] }, { apiToken: "test-token", fetchImpl: async () => new Response(JSON.stringify([{ error, errorDescription: "private upstream details" }])) })).rejects.toMatchObject({ code, message: code });
  });
  it("accepts an explicitly empty dataset", async () => {
    await expect(fetchApifyInstagramPosts({ id: "instagram-clubs", url: "https://www.instagram.com/club/", acceptedContentTypes: [], parse: () => [] }, { apiToken: "test-token", fetchImpl: async () => new Response("[]") })).resolves.toEqual([]);
  });

});
