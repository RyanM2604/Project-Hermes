import { describe, expect, it, vi } from "vitest";

import { fetchSourceText, IngestionFetchError } from "../fetch-source";
import type { IngestionSource } from "../types";

const source: IngestionSource = {
  id: "wusa-events",
  url: "https://wusa.ca/events/?ical=1",
  acceptedContentTypes: ["text/calendar"],
  parse: () => [],
};

describe("fetchSourceText", () => {
  it("returns text from an accepted response", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("BEGIN:VCALENDAR", {
        headers: { "content-type": "text/calendar; charset=UTF-8" },
      }),
    );

    await expect(fetchSourceText(source, { fetchImpl })).resolves.toBe(
      "BEGIN:VCALENDAR",
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      source.url,
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": expect.stringContaining("Project-Hermes"),
        }),
      }),
    );
  });

  it.each([
    [new Response("no", { status: 429 }), "http-error"],
    [
      new Response("<html></html>", {
        headers: { "content-type": "text/html" },
      }),
      "unexpected-content-type",
    ],
  ])("throws a constrained error without exposing payloads", async (response, code) => {
    const request = fetchSourceText(source, {
      fetchImpl: async () => response,
    });

    await expect(request).rejects.toMatchObject({ code });
    await expect(request).rejects.not.toThrow(/<html>|no/);
  });

  it("rejects oversized responses", async () => {
    const request = fetchSourceText(source, {
      fetchImpl: async () =>
        new Response("12345", {
          headers: { "content-type": "text/calendar" },
        }),
      maxBytes: 4,
    });

    await expect(request).rejects.toMatchObject({
      code: "response-too-large",
    });
  });

  it("converts aborted requests into timeout errors", async () => {
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );

    const request = fetchSourceText(source, { fetchImpl, timeoutMs: 1 });

    await expect(request).rejects.toBeInstanceOf(IngestionFetchError);
    await expect(request).rejects.toMatchObject({ code: "timeout" });
  });
});
