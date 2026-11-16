import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createSocialRepository } from "./repository";

describe("social media URL recovery", () => {
  it.each(["pending", "failed"])("requeues a %s media failure when collection refreshes the CDN URL", async status => {
    const oldUrl = "https://instagram.old.fna.fbcdn.net/photo.jpg?token=old";
    const newUrl = "https://instagram.new.fna.fbcdn.net/photo.jpg?token=new";
    const post = { id: "post", shortcode: "abc", accountHandle: "club", accountName: "Club", sourceUrl: "https://www.instagram.com/p/abc/", caption: "Games", postedAt: null, media: [oldUrl] };
    const updateMany = vi.fn<(args: { data: Record<string, unknown> }) => Promise<{ count: number }>>(async () => ({ count: 1 }));
    const client = { socialPost: { findUnique: vi.fn(async () => ({ ...post, mediaUrls: [oldUrl], extractionVersion: "v1", status, lastError: "image-preparation-failed", updatedAt: new Date(), extraction: { saved: true } })), updateMany } } as unknown as PrismaClient;
    const repo = createSocialRepository(client);
    await repo.collect({ ...post, media: [newUrl] }, "v1");
    expect(updateMany.mock.calls[0][0].data).toMatchObject({ mediaUrls: [newUrl], status: "pending", attempts: 0, nextRetryAt: null, lastError: null });
    expect(updateMany.mock.calls[0][0].data).not.toHaveProperty("extraction");
    updateMany.mockClear();
    await repo.collect(post, "v1");
    expect(updateMany.mock.calls[0][0].data).not.toHaveProperty("status");
  });
});
