import { describe, expect, it, vi } from "vitest";

import {
  fetchScrapeFlyInstagramText,
  fetchScrapeFlyText,
} from "../fetch-scrapfly";

const source = {
  id: "instagram-clubs" as const,
  url: "https://www.instagram.com/uwcheeseclub/",
  acceptedContentTypes: ["text/html"] as const,
  parse: () => [],
};

describe("fetchScrapeFlyText", () => {
  it("requests the scrapfly scrape endpoint and returns the rendered content", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));

      expect(url.origin).toBe("https://api.scrapfly.io");
      expect(url.pathname).toBe("/scrape");
      expect(url.searchParams.get("key")).toBe("test-key");
      expect(url.searchParams.get("url")).toBe(source.url);
      expect(url.searchParams.get("render_js")).toBe("true");
      expect(url.searchParams.get("asp")).toBe("true");

      return new Response(
        JSON.stringify({
          result: {
            content: "<html><body>instagram</body></html>",
          },
        }),
        {
          headers: { "content-type": "application/json" },
        },
      );
    });

    await expect(
      fetchScrapeFlyText(source, {
        apiKey: "test-key",
        fetchImpl,
      }),
    ).resolves.toContain("instagram");
  });

  it("fails closed when the api key is missing", async () => {
    await expect(fetchScrapeFlyText(source, { fetchImpl: vi.fn() })).rejects.toThrow(
      /Missing SCRAPEFLY_API_KEY/,
    );
  });

  it("fetches an instagram profile and its linked post pages", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("/uwcheeseclub/")) {
        return new Response(
          `<!doctype html><html><head></head><body>
            <a href="https://www.instagram.com/p/DZpt0I1ESPa/">Post</a>
            <script>window._sharedData = {"entry_data":{"ProfilePage":[{"graphql":{"user":{"edge_owner_to_timeline_media":{"edges":[{"node":{"shortcode":"DZpt0I1ESPa","edge_media_to_caption":{"edges":[{"node":{"text":"UW Cheese Club Fall Social\\nJoin us on June 20, 2026 at 7 PM in SLC for free pizza and games."}}]},"taken_at_timestamp":1750279200,"display_url":"https://example.com/post.jpg","location":{"name":"SLC Great Hall"}}}]}}}}]}};</script>
          </body></html>`,
          { headers: { "content-type": "text/html" } },
        );
      }

      return new Response(
        `<!doctype html><html><head></head><body>
          <script>window._sharedData = {"entry_data":{"PostPage":[{"graphql":{"shortcode_media":{"shortcode":"DZpt0I1ESPa","edge_media_to_caption":{"edges":[{"node":{"text":"UW Cheese Club Fall Social\\nJoin us on June 20, 2026 at 7 PM in SLC for free pizza and games."}}]},"taken_at_timestamp":1750279200,"display_url":"https://example.com/post.jpg","location":{"name":"SLC Great Hall"}}}}]}};</script>
        </body></html>`,
        { headers: { "content-type": "text/html" } },
      );
    });

    const content = await fetchScrapeFlyInstagramText(source, {
      apiKey: "test-key",
      fetchImpl,
    });

    expect(content).toContain("DZpt0I1ESPa");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
