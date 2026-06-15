import { describe, expect, it, vi } from "vitest";

import { validateSourceUrl } from "../validate-source-url";

describe("validateSourceUrl", () => {
  it.each([404, 410])("rejects confirmed dead source URLs with status %s", async (status) => {
    const fetchImpl = vi.fn(async () => new Response(null, { status }));

    await expect(
      validateSourceUrl("https://example.com/dead", { fetchImpl }),
    ).resolves.toBe(false);
  });

  it.each([200, 301, 403, 405, 429, 500])(
    "keeps source URLs that are not confirmed dead with status %s",
    async (status) => {
      const fetchImpl = vi.fn(async () => new Response(null, { status }));

      await expect(
        validateSourceUrl("https://example.com/event", { fetchImpl }),
      ).resolves.toBe(true);
    },
  );

  it("keeps source URLs when probing fails transiently", async () => {
    await expect(
      validateSourceUrl("https://example.com/event", {
        fetchImpl: async () => {
          throw new Error("private network details");
        },
      }),
    ).resolves.toBe(true);
  });

  it("keeps source URLs when HEAD is unsupported but GET succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(
      validateSourceUrl("https://example.com/event", { fetchImpl }),
    ).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://example.com/event",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
