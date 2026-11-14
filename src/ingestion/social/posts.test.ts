import { describe, expect, it } from "vitest";
import { normalizeSocialPosts, postContentHash, matchEventSlots, mediaIdentity } from "./posts";
const account = { instagramHandle: "club", clubName: "Club", profileUrl: "https://www.instagram.com/club/", active: true };
describe("social post identity", () => {
  it("keeps carousel children as parent media, never separate posts", () => {
    const posts = normalizeSocialPosts([{ shortCode: "one", caption: "Plans", timestamp: "2026-11-01T12:00:00Z", ownerUsername: "club", childPosts: [{ shortCode: "child", displayUrl: "https://cdn.example/slide.jpg" }] }], account);
    expect(posts).toHaveLength(1);
    expect(posts[0].media).toEqual(["https://cdn.example/slide.jpg"]);
  });
  it("ignores changing signed media query strings but detects captions and slide order", () => {
    const [post] = normalizeSocialPosts([{ shortCode: "one", caption: "Plans", displayUrl: "https://cdn.example/one.jpg?token=1" }], account);
    expect(postContentHash(post)).toBe(postContentHash({ ...post, media: ["https://cdn.example/one.jpg?token=2"] }));
    expect(postContentHash(post)).not.toBe(postContentHash({ ...post, caption: "New plans" }));
  });
  it("retains incomplete carousel metadata even when unavailable slides have no URL", () => {
    const [post] = normalizeSocialPosts([{ shortCode: "one", childPosts: [{ displayUrl: "https://cdn.example/first.jpg" }, { type: "Image" }] }], account);
    expect(post.incompleteMedia).toBe(true);
  });
  it("ignores Instagram CDN shard hosts while retaining actual asset paths", () => {
    expect(mediaIdentity("https://scontent-ord1.cdninstagram.com/v/image.jpg?token=one")).toBe(mediaIdentity("https://scontent-lga2.cdninstagram.com/v/image.jpg?token=two"));
    expect(mediaIdentity("https://scontent-ord1.cdninstagram.com/v/changed.jpg")).not.toBe(mediaIdentity("https://scontent-lga2.cdninstagram.com/v/image.jpg"));
    expect(mediaIdentity("https://one.example/image.jpg")).not.toBe(mediaIdentity("https://two.example/image.jpg"));
  });
  it("rejects wrong-account records and deduplicates parent results", () => {
    expect(normalizeSocialPosts([{ shortCode: "x", ownerUsername: "other" }, { shortCode: "y" }, { shortCode: "y" }], account)).toHaveLength(1);
  });
});
describe("event slot matching", () => {
  const old = [{ slot: 0, titleKey: "games night", localDate: "2026-11-05" }, { slot: 1, titleKey: "pizza", localDate: "2026-11-06" }];
  it("preserves identities when model output order changes and an event reschedules", () => {
    expect(matchEventSlots(old, [{ title: "Pizza", startTime: "2026-11-06T20:00:00Z" }, { title: "Games night", startTime: "2026-11-07T20:00:00Z" }])).toEqual([1, 0]);
  });
  it("holds ambiguous unmatched edits instead of creating duplicate events", () => {
    expect(() => matchEventSlots(old, [{ title: "Different event", startTime: "2026-11-09T20:00:00Z" }])).toThrow("ambiguous-event-mapping");
  });
});
