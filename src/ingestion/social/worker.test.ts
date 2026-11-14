import { describe, expect, it, vi } from "vitest";
import { runSocialIngestion } from "./worker";
import type { SocialRepository, ClaimedPost } from "./repository";
const event = { title: "Games", description: "Games at SLC", startLocal: "2026-11-05T18:00", endLocal: null, locationName: "SLC", imageIndex: null, evidence: { start: "November 5, 2026, 6pm", location: "SLC" }, conflicts: [] };
function setup(extraction: unknown = null) {
  const post = { id: "post", shortcode: "x", accountHandle: "club", accountName: "Club", sourceUrl: "https://www.instagram.com/p/x/", caption: "Games", postedAt: new Date("2026-11-01T12:00:00Z"), mediaUrls: [], extraction, attempts: 0, leaseToken: "lease" } as unknown as ClaimedPost;
  const repository: SocialRepository = { collect: vi.fn(), claim: vi.fn().mockResolvedValueOnce(post).mockResolvedValue(null), mappings: vi.fn(async () => []), media: vi.fn(async () => []), saveMedia: vi.fn(), saveExtraction: vi.fn(), publish: vi.fn(async () => ["event-one"]), finish: vi.fn(), fail: vi.fn() };
  const extract = vi.fn(async () => ({ status: "extracted" as const, data: { disposition: "events" as const, events: [event], reason: null }, model: "test", inputTokens: 10, outputTokens: 20 }));
  return { repository, extract, post };
}
describe("durable social worker", () => {
  it("validates, publishes, and classifies a supported event", async () => {
    const { repository, extract } = setup(); const classify = vi.fn(async () => undefined);
    const result = await runSocialIngestion({ repository, extractor: { extract }, accounts: [], now: () => new Date("2026-11-04T12:00:00Z"), classify });
    expect(repository.publish).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ slot: 0, candidate: expect.objectContaining({ endTimeEstimated: true, locationName: "SLC" }) })]);
    expect(result.published).toBe(1); expect(classify).toHaveBeenCalledWith(["event-one"]);
  });
  it("reuses saved extraction after an interrupted publication", async () => {
    const { repository, extract } = setup({ disposition: "events", events: [event], reason: null });
    await runSocialIngestion({ repository, extractor: { extract }, accounts: [], now: () => new Date("2026-11-04T12:00:00Z") });
    expect(extract).not.toHaveBeenCalled(); expect(repository.publish).toHaveBeenCalledOnce();
  });
  it("holds missing dates without inserting events", async () => {
    const { repository, extract } = setup({ disposition: "events", events: [{ ...event, startLocal: null }], reason: null });
    await runSocialIngestion({ repository, extractor: { extract }, accounts: [], now: () => new Date("2026-11-04T12:00:00Z") });
    expect(extract).not.toHaveBeenCalled(); expect(repository.publish).not.toHaveBeenCalled(); expect(repository.finish).toHaveBeenCalledWith(expect.anything(), "held", expect.any(String));
  });
  it("does not write during dry-run", async () => {
    const { repository, extract } = setup();
    await runSocialIngestion({ repository, extractor: { extract }, accounts: [], dryRun: true });
    expect(repository.claim).not.toHaveBeenCalled(); expect(repository.collect).not.toHaveBeenCalled();
  });
  it("records provider failures for retry, preserving previously published events", async () => {
    const { repository, post } = setup();
    const extract = vi.fn(async () => ({ status: "failed" as const, code: "provider-error" }));
    await runSocialIngestion({ repository, extractor: { extract }, accounts: [], now: () => new Date("2026-11-04T12:00:00Z") });
    expect(repository.fail).toHaveBeenCalledWith(post, "provider-error", expect.any(Date)); expect(repository.publish).not.toHaveBeenCalled();
  });
  it("publishes supported caption details when image preparation fails and queues media retry", async () => {
    const { repository, extract, post } = setup(); post.mediaUrls = ["https://cdn.example/broken.jpg"];
    const result = await runSocialIngestion({ repository, extractor: { extract }, accounts: [], prepareImage: async () => { throw new Error("image-http-error"); }, now: () => new Date("2026-11-04T12:00:00Z") });
    expect(repository.publish).toHaveBeenCalledOnce(); expect(repository.saveExtraction).not.toHaveBeenCalled();
    expect(repository.finish).toHaveBeenCalledWith(post, "pending", "image-storage-pending"); expect(result.imagePending).toBe(1);
  });
  it("holds incomplete carousels instead of silently scanning a subset", async () => {
    const { repository, extract, post } = setup(); post.incompleteMedia = true;
    await runSocialIngestion({ repository, extractor: { extract }, accounts: [] });
    expect(extract).not.toHaveBeenCalled(); expect(repository.publish).not.toHaveBeenCalled(); expect(repository.finish).toHaveBeenCalledWith(post, "held", "too-many-images");
  });
  it("uses the live disposition gates in dry-run", async () => {
    const { repository } = setup();
    const result = await runSocialIngestion({ repository, dryRun: true, accounts: [{ instagramHandle: "club", clubName: "Club", profileUrl: "https://www.instagram.com/club/", active: true }], fetchPosts: async () => [{ shortCode: "cancelled" }], extractor: { extract: async () => ({ status: "extracted", data: { disposition: "cancelled", events: [event], reason: "Cancelled" }, model: "test", inputTokens: 0, outputTokens: 0 }) } });
    expect(result.published).toBe(0); expect(result.held).toBe(1); expect(repository.collect).not.toHaveBeenCalled();
  });

  it("holds differently named gatherings at the same time and place instead of duplicating detail slides", async () => {
    const { repository, extract } = setup({ disposition: "events", events: [event, { ...event, title: "Games menu details" }], reason: null });
    const result = await runSocialIngestion({ repository, extractor: { extract }, accounts: [], now: () => new Date("2026-11-04T12:00:00Z") });
    expect(repository.publish).not.toHaveBeenCalled(); expect(result.reasons["ambiguous-same-time-events"]).toBe(1);
  });
  it("collapses identical gatherings repeated across slides", async () => {
    const { repository, extract } = setup({ disposition: "events", events: [event, event], reason: null });
    await runSocialIngestion({ repository, extractor: { extract }, accounts: [], now: () => new Date("2026-11-04T12:00:00Z") });
    expect(repository.publish).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ slot: 0 })]);
  });

  it("archives an otherwise valid ended event without changing its actual date", async () => {
    const { repository, extract } = setup({ disposition: "events", events: [event], reason: null });
    await runSocialIngestion({ repository, extractor: { extract }, accounts: [], now: () => new Date("2026-11-07T12:00:00Z") });
    expect(repository.publish).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ candidate: expect.objectContaining({ startTime: "2026-11-05T23:00:00.000Z" }) })]);
    expect(extract).not.toHaveBeenCalled();
  });

  it("corrects a posting-time placeholder when one verified event belongs to the same legacy post", async () => {
    const { repository, extract } = setup({ disposition: "events", events: [event], reason: null });
    repository.mappings = async () => [{ slot: 0, titleKey: "old caption title", localDate: "2026-11-01", unverifiedLegacy: true } as never];
    await runSocialIngestion({ repository, extractor: { extract }, accounts: [], now: () => new Date("2026-11-07T12:00:00Z") });
    expect(repository.publish).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ slot: 0 })]);
  });

  it("accepts a configured source list larger than the former 25-account cap", async () => {
    const { repository } = setup();
    const accounts = Array.from({ length: 59 }, (_, i) => ({ instagramHandle: `club${i}`, clubName: `Club ${i}`, profileUrl: `https://www.instagram.com/club${i}/`, active: true, priority: i % 3 }));
    const fetchPosts = vi.fn<NonNullable<Parameters<typeof runSocialIngestion>[0]["fetchPosts"]>>(async () => []);
    const result = await runSocialIngestion({ repository, accounts, dryRun: true, fetchPosts });
    expect(result.accounts).toHaveLength(59);
    expect(fetchPosts).toHaveBeenCalledTimes(59);
    expect(fetchPosts.mock.calls[0][0].url).toBe("https://www.instagram.com/club0/");
    expect(fetchPosts.mock.calls[1][0].url).toBe("https://www.instagram.com/club3/");
    expect(repository.collect).not.toHaveBeenCalled();
  });

});
