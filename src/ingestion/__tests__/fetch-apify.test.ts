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

describe("capped paid collection", () => {
  it("sends date and charge limits, preserves details, and reports stable actual cost", async () => {
    const { fetchApifyCollection } = await import("../fetch-apify");
    const run = { id: "run-one", status: "SUCCEEDED", defaultDatasetId: "dataset-one", finishedAt: new Date(Date.now() - 20_000).toISOString(), usageTotalUsd: 0.0023 };
    const onStarted = vi.fn();
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (init?.method === "POST") {
        expect(url.searchParams.get("maxTotalChargeUsd")).toBe("0.04");
        expect(JSON.parse(String(init.body))).toMatchObject({ onlyPostsNewerThan: "2026-11-14", skipPinnedPosts: true, dataDetailLevel: "detailedData" });
      }
      return new Response(JSON.stringify(url.pathname.includes("datasets") ? [{ shortCode: "one", childPosts: [{ displayUrl: "https://example.org/image.jpg" }] }] : { data: run }));
    });
    const result = await fetchApifyCollection({ id: "instagram-clubs", url: "https://www.instagram.com/club/", acceptedContentTypes: [], parse: () => [] }, { apiToken: "test", maxTotalChargeUsd: 0.04, onlyPostsNewerThan: "2026-11-14", fetchImpl, onStarted });
    expect(result).toMatchObject({ received: 1, costSettled: true, run: { usageTotalUsd: 0.0023 }, posts: [{ shortCode: "one", childPosts: expect.any(Array) }] });
    expect(onStarted).toHaveBeenCalledOnce();
  });
  it("resumes an already-paid run without sending another POST", async () => {
    const { fetchApifyCollection } = await import("../fetch-apify");
    const run = { id: "run-one", status: "SUCCEEDED", defaultDatasetId: "dataset-one", finishedAt: new Date(Date.now() - 20_000).toISOString(), usageTotalUsd: 0 };
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).not.toBe("POST");
      return new Response(JSON.stringify(String(url).includes("datasets") ? [] : { data: run }));
    });
    await fetchApifyCollection({ id: "instagram-clubs", url: "https://www.instagram.com/club/", acceptedContentTypes: [], parse: () => [] }, { apiToken: "test", runId: "run-one", maxTotalChargeUsd: 0.04, fetchImpl, onStarted: vi.fn() });
  });
  it("does not retry a POST when its outcome is unknown", async () => {
    const { fetchApifyCollection } = await import("../fetch-apify");
    const fetchImpl = vi.fn().mockRejectedValue(new Error("connection-lost"));
    await expect(fetchApifyCollection({ id: "instagram-clubs", url: "https://www.instagram.com/club/", acceptedContentTypes: [], parse: () => [] }, { apiToken: "test", maxTotalChargeUsd: 0.04, fetchImpl, onStarted: vi.fn() })).rejects.toThrow("connection-lost");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
