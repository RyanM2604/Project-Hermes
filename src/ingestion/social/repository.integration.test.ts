import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createSocialRepository, reconcileCanonicalEvents } from "./repository";
import { normalizeSocialPosts } from "./posts";
import { createSourceFingerprint } from "@/lib/events/adapters";
import { createPrismaEventPersistenceRepository, persistEvents } from "@/lib/events/persistence";
import type { NormalizedEventCandidate } from "@/lib/events/adapters";
const url = process.env.HERMES_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const client = new PrismaClient({ datasources: { db: { url: url ?? "postgresql://127.0.0.1:55487/hermes_ingestion_test" } } });
const account = { instagramHandle: "club", clubName: "Club", profileUrl: "https://www.instagram.com/club/", active: true };
const [post] = normalizeSocialPosts([{ shortCode: "one", caption: "Games" }], account);
const fingerprint = createSourceFingerprint("instagram-clubs", "club:one")!;
const candidate: NormalizedEventCandidate = { source: "instagram-clubs", sourceFingerprint: fingerprint, sourceUrl: post.sourceUrl, title: "Games", description: "Play games", clubName: "Club", startTime: "2030-11-05T23:00:00.000Z", endTime: "2030-11-06T01:00:00.000Z", locationName: "SLC", tags: ["games"], isFreeFood: false, endTimeEstimated: true };
suite("social repository against isolated Postgres", () => {
  beforeAll(async () => {
    const target = new URL(url!);
    if (target.hostname !== "127.0.0.1" || !target.pathname.endsWith("_test")) throw new Error("integration-test-requires-isolated-local-database");
    await client.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS public.saved_events (user_id text, event_id text, created_at timestamptz DEFAULT now(), UNIQUE(user_id,event_id))');
    await client.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS public.event_rsvps (user_id text, event_id text, status text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(user_id,event_id))');
  });
  beforeEach(async () => {
    await client.socialPost.deleteMany(); await client.interaction.deleteMany(); await client.event.deleteMany();
    await client.$executeRawUnsafe('TRUNCATE public.saved_events,public.event_rsvps');
  });
  afterAll(async () => { await client.$disconnect(); });
  async function claim() { const repo = createSocialRepository(client); await repo.collect(post, "v1"); return { repo, claimed: (await repo.claim("club", new Date()))! }; }
  it("allows only one concurrent worker to claim a post and fences stale owners", async () => {
    const repo = createSocialRepository(client); await repo.collect(post, "v1");
    const claims = await Promise.all([repo.claim("club", new Date()), repo.claim("club", new Date())]);
    expect(claims.filter(Boolean)).toHaveLength(1); const old = claims.find(Boolean)!;
    await client.socialPost.update({ where: { id: post.id }, data: { leaseUntil: new Date(0) } });
    const fresh = (await repo.claim("club", new Date()))!;
    await expect(repo.finish(old, "ready")).rejects.toThrow("lease-lost");
    await repo.finish(fresh, "ready");
  });
  it("does not overwrite a leased post during collection and resets changed content afterward", async () => {
    const { repo, claimed } = await claim();
    await repo.collect({ ...post, caption: "Changed" }, "v1");
    expect((await client.socialPost.findUniqueOrThrow({ where: { id: post.id } })).caption).toBe("Games");
    await repo.saveExtraction(claimed, { test: true }, { inputTokens: 5, outputTokens: 3 }, "v1");
    await repo.finish(claimed, "ready"); await repo.collect({ ...post, caption: "Changed" }, "v1");
    expect(await client.socialPost.findUniqueOrThrow({ where: { id: post.id } })).toMatchObject({ status: "pending", extraction: null, caption: "Changed" });
  });
  it("preserves the legacy slot0 mapping before a multi-event extraction", async () => {
    await persistEvents([candidate], createPrismaEventPersistenceRepository(client));
    const { repo } = await claim();
    expect(await repo.mappings(post.id)).toEqual([expect.objectContaining({ slot: 0, titleKey: "games", eventId: `event-${fingerprint}` })]);
  });
  it("reuses event IDs on publication retries and an official source adopts an earlier social event", async () => {
    const { repo, claimed } = await claim();
    const publication = { slot: 0, candidate, imageIndex: null, imagePending: false };
    const [id] = await repo.publish(claimed, [publication]);
    expect(await repo.publish(claimed, [publication])).toEqual([id]);
    const official = { ...candidate, source: "wusa-events" as const, sourceFingerprint: "f".repeat(64), sourceUrl: "https://wusa.ca/event/games", endTimeEstimated: undefined };
    expect((await persistEvents([official], createPrismaEventPersistenceRepository(client))).persistedEventIds).toEqual([id]);
    expect(await client.event.count()).toBe(1);
    expect(await client.event.findUniqueOrThrow({ where: { id } })).toMatchObject({ source: "wusa-events", endTimeEstimated: false });
  });
  it("stops image retries after three attempts", async () => {
    const { repo, claimed } = await claim();
    await repo.finish(claimed, "pending", "image-storage-pending");
    for (let i = 0; i < 2; i++) {
      await client.socialPost.update({ where: { id: post.id }, data: { nextRetryAt: new Date(0) } });
      const next = (await repo.claim("club", new Date()))!; await repo.finish(next, "pending", "image-storage-pending");
    }
    expect(await client.socialPost.findUniqueOrThrow({ where: { id: post.id } })).toMatchObject({ status: "failed", attempts: 3 });
  });
  it("keeps bucket URLs on repeated official refreshes", async () => {
    const official = { ...candidate, source: "wusa-events" as const, sourceFingerprint: "f".repeat(64), imageUrl: "https://wusa.ca/photo.jpg?token=1" };
    const repository = createPrismaEventPersistenceRepository(client);
    const [id] = (await persistEvents([official], repository)).persistedEventIds;
    await client.event.update({ where: { id }, data: { imageUrl: "https://example.supabase.co/storage/v1/object/public/event-images/hash.webp" } });
    await persistEvents([{ ...official, imageUrl: "https://wusa.ca/photo.jpg?token=2" }], repository);
    expect((await client.event.findUniqueOrThrow({ where: { id } })).imageUrl).toContain("supabase.co");
  });
  it("reconciles preexisting duplicates and preserves latest RSVP/save references", async () => {
    const repo = createPrismaEventPersistenceRepository(client); const [socialId] = (await persistEvents([candidate], repo)).persistedEventIds;
    const social = await client.event.findUniqueOrThrow({ where: { id: socialId } });
    await client.event.create({ data: { ...social, id: "official", source: "wusa-events", sourceFingerprint: "e".repeat(64) } });
    await client.$executeRaw`INSERT INTO public.saved_events (user_id,event_id) VALUES ('user',${socialId})`;
    await client.$executeRaw`INSERT INTO public.event_rsvps (user_id,event_id,status,updated_at) VALUES ('user',${socialId},'going','2030-01-01'),('user','official','interested','2029-01-01')`;
    expect(await reconcileCanonicalEvents(client)).toBe(1);
    expect(await client.event.findUniqueOrThrow({ where: { id: socialId } })).toMatchObject({ supersededById: "official" });
    expect(await client.$queryRaw`SELECT event_id,status FROM public.event_rsvps`).toEqual([{ event_id: "official", status: "going" }]);
    expect(await client.$queryRaw`SELECT event_id FROM public.saved_events`).toEqual([{ event_id: "official" }]);
  });
  it("revalidates duplicate signatures under the publication lock", async () => {
    const [socialId] = (await persistEvents([candidate], createPrismaEventPersistenceRepository(client))).persistedEventIds;
    const social = await client.event.findUniqueOrThrow({ where: { id: socialId } });
    await client.event.create({ data: { ...social, id: "official", source: "wusa-events", sourceFingerprint: "e".repeat(64) } });
    let changed = false;
    const concurrentClient = new Proxy(client, { get(target, property) {
      if (property === "$transaction") return async (operation: Parameters<PrismaClient["$transaction"]>[0]) => {
        if (!changed) { changed = true; await client.event.update({ where: { id: socialId }, data: { title: "Different event now" } }); }
        return client.$transaction(operation as never);
      };
      const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value;
    } });
    expect(await reconcileCanonicalEvents(concurrentClient)).toBe(0);
    expect((await client.event.findUniqueOrThrow({ where: { id: socialId } })).supersededById).toBeNull();
  });

  it("keeps completed extraction through CDN shard and identity-rule changes, but invalidates a changed asset", async () => {
    const repo = createSocialRepository(client);
    const observed = { ...post, media: ["https://scontent-ord1.cdninstagram.com/v/photo.jpg?token=one"] };
    await repo.collect(observed, "v1");
    const claimed = (await repo.claim("club", new Date()))!;
    await repo.saveExtraction(claimed, { saved: true }, { inputTokens: 4, outputTokens: 2 }, "v1");
    await repo.finish(claimed, "held", "event-ended");
    await client.socialPost.update({ where: { id: post.id }, data: { contentHash: "older-cache-key-format" } });
    await repo.collect({ ...observed, media: ["https://scontent-lga2.cdninstagram.com/v/photo.jpg?token=two"] }, "v1");
    expect(await client.socialPost.findUniqueOrThrow({ where: { id: post.id } })).toMatchObject({ status: "held", extraction: { saved: true } });
    expect(await repo.claim("club", new Date())).toBeNull();
    await repo.collect({ ...observed, media: ["https://scontent-lga2.cdninstagram.com/v/different.jpg"] }, "v1");
    expect(await client.socialPost.findUniqueOrThrow({ where: { id: post.id } })).toMatchObject({ status: "pending", extraction: null });
  });

});
