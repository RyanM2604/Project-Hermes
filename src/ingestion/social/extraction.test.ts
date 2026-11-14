import { describe, expect, it, vi } from "vitest";
import {
  createSocialExtractor,
  extractedPostSchema,
  normalizeExtractedEvent,
  type ExtractedPost,
  type SocialExtractorClient,
} from "./extraction";

const posterEvent: ExtractedPost["events"][number] = {
  title: "Cheese night",
  description: "Meet the Cheese Club in the SLC.",
  startLocal: "2026-11-05T18:00",
  endLocal: null,
  locationName: "SLC 2144",
  imageIndex: 0,
  evidence: { start: "Slide 1: November 5, 2026 at 6 PM", location: "Slide 1: SLC 2144" },
  conflicts: [],
};
const post: ExtractedPost = { disposition: "events", events: [posterEvent], reason: null };
const input = { caption: "See the poster!", postedAt: "2026-11-01T17:00:00Z", accountName: "Cheese Club", images: [{ dataUrl: "data:image/png;base64,AAAA" }] };
const context = { postedAt: input.postedAt, now: new Date("2026-11-04T12:00:00Z") };

describe("structured social extraction", () => {
  it("accepts several events announced in a carousel", () => {
    expect(extractedPostSchema.parse({ ...post, events: [posterEvent, { ...posterEvent, title: "Games night", imageIndex: 1 }] }).events).toHaveLength(2);
  });

  it("sends ordered image inputs with untrusted caption context and a strict schema", async () => {
    const create = vi.fn().mockResolvedValue({ status: "completed", output_text: JSON.stringify(post), usage: { input_tokens: 80, output_tokens: 120 } });
    const result = await createSocialExtractor({ client: { responses: { create } }, model: "test-model" }).extract(input);
    expect(result).toEqual({ status: "extracted", data: post, model: "test-model", inputTokens: 80, outputTokens: 120 });
    const request = create.mock.calls[0][0];
    expect(request.instructions).toContain("untrusted");
    expect(request.instructions).toContain("America/Toronto");
    expect(request.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(request.input[0].content).toContainEqual({ type: "input_image", image_url: input.images[0].dataUrl, detail: "high" });
    expect(request.input[0].content[0].text).toContain(input.postedAt);
    expect(request.store).toBe(false);
  });

  it("does not call the provider without credentials or a supplied client", async () => {
    expect(await createSocialExtractor({ apiKey: "" }).extract(input)).toEqual({ status: "failed", code: "missing-api-key" });
  });

  it.each([
    [{ output_text: "not-json" }, "invalid-output"],
    [{ status: "incomplete", output_text: JSON.stringify(post) }, "incomplete"],
    [{ output: [{ content: [{ type: "refusal", refusal: "Cannot process" }] }] }, "refused"],
    [{ output_text: JSON.stringify({ ...post, events: [{ ...posterEvent, imageIndex: 10 }] }) }, "invalid-image-index"],
    [{ output_text: JSON.stringify({ ...post, events: [] }) }, "invalid-output"],
  ])("returns a constrained failure for invalid or refused output", async (response, code) => {
    const create = vi.fn().mockResolvedValue(response);
    expect(await createSocialExtractor({ client: { responses: { create } } }).extract(input)).toEqual({ status: "failed", code });
  });

  it("holds more than ten images rather than dropping slides", async () => {
    const create = vi.fn();
    expect(await createSocialExtractor({ client: { responses: { create } } }).extract({ ...input, images: Array(11).fill(input.images[0]) })).toEqual({ status: "failed", code: "too-many-images" });
    expect(create).not.toHaveBeenCalled();
  });

  it("sanitizes provider errors", async () => {
    const create = vi.fn().mockRejectedValue(new Error("private provider detail"));
    expect(await createSocialExtractor({ client: { responses: { create } } }).extract(input)).toEqual({ status: "failed", code: "provider-error" });
  });

  it("aborts a slow provider and returns a timeout", async () => {
    const create = vi.fn<SocialExtractorClient["responses"]["create"]>((_request, options) => new Promise<never>((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))));
    expect(await createSocialExtractor({ client: { responses: { create } }, timeoutMs: 5 }).extract(input)).toEqual({ status: "failed", code: "timeout" });
  });
});

describe("normalizeExtractedEvent", () => {
  it("uses Toronto local time and explicitly flags an estimated end", () => {
    expect(normalizeExtractedEvent(posterEvent, context)).toMatchObject({ ok: true, event: { startTime: "2026-11-05T23:00:00.000Z", endTime: "2026-11-06T01:00:00.000Z", endTimeEstimated: true } });
  });

  it("preserves an explicit overnight end", () => {
    expect(normalizeExtractedEvent({ ...posterEvent, startLocal: "2026-11-05T23:00", endLocal: "2026-11-06T01:00" }, context)).toMatchObject({ ok: true, event: { endTimeEstimated: false, endTime: "2026-11-06T06:00:00.000Z" } });
  });

  it.each([
    { startLocal: null },
    { startLocal: "2026-02-30T18:00" },
    { startLocal: "2026-11-05" },
    { locationName: null },
    { locationName: "TBA" },
    { evidence: { start: null, location: "Slide 1: SLC" } },
    { conflicts: ["Caption says Friday; poster says Saturday"] },
    { endLocal: "2026-11-05T17:00" },
  ])("holds missing or conflicting facts: %o", (change) => {
    expect(normalizeExtractedEvent({ ...posterEvent, ...change }, context).ok).toBe(false);
  });

  it("rejects nonexistent and ambiguous DST local times", () => {
    for (const startLocal of ["2027-03-14T02:30", "2027-11-07T01:30"]) {
      expect(normalizeExtractedEvent({ ...posterEvent, startLocal }, context)).toEqual({ ok: false, reason: "invalid-or-ambiguous-start" });
    }
  });

  it("holds relative evidence without a reliable post timestamp", () => {
    expect(normalizeExtractedEvent({ ...posterEvent, evidence: { ...posterEvent.evidence, start: "Tomorrow at 6 PM" } }, { ...context, postedAt: null })).toEqual({ ok: false, reason: "relative-date-without-posted-at" });
  });

  it("does not publish ended events", () => {
    expect(normalizeExtractedEvent(posterEvent, { ...context, now: new Date("2026-11-07T00:00:00Z") })).toEqual({ ok: false, reason: "event-ended" });
  });
  it("allows validated ended events when archiving is explicitly enabled", () => {
    expect(normalizeExtractedEvent(posterEvent, { ...context, now: new Date("2026-11-07T00:00:00Z"), allowPast: true })).toMatchObject({ ok: true, event: { title: posterEvent.title } });
  });

});
