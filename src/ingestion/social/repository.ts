import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type SocialPost, type SocialEventMapping, type SocialMedia } from "@prisma/client";
import type { NormalizedEventCandidate } from "@/lib/events/adapters";
import { createSourceFingerprint } from "@/lib/events/adapters";
import { createEventContentHash } from "@/lib/events/content-hash";
import { createPrismaEventPersistenceRepository, persistSourceLocation } from "@/lib/events/persistence";
import { hash, localDate, titleKey, postContentHash, type SocialPostInput } from "./posts";

export type ClaimedPost = SocialPost & { leaseToken: string };
export interface MediaRecord { id: string; identity: string; sourceUrl: string; contentHash: string; storagePath: string | null; publicUrl: string | null }
export type SocialMapping = SocialEventMapping & { unverifiedLegacy?: boolean };
export interface Publication { slot: number; candidate: NormalizedEventCandidate; imageIndex: number | null; imagePending: boolean }
export interface SocialRepository {
  collect(post: SocialPostInput, version: string): Promise<void>;
  claim(account: string | undefined, now: Date, activeHandles?: string[]): Promise<ClaimedPost | null>;
  mappings(postId: string): Promise<SocialMapping[]>;
  media(postId: string): Promise<SocialMedia[]>;
  saveMedia(post: ClaimedPost, value: MediaRecord): Promise<void>;
  saveExtraction(post: ClaimedPost, extraction: unknown, usage: { inputTokens: number; outputTokens: number; model?: string }, version: string): Promise<void>;
  publish(post: ClaimedPost, publications: Publication[]): Promise<string[]>;
  finish(post: ClaimedPost, status: "ready" | "held" | "ignored" | "pending", reason?: string): Promise<void>;
  fail(post: ClaimedPost, code: string, now: Date): Promise<void>;
}
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export function createSocialRepository(client: PrismaClient): SocialRepository {
  async function requireLease(transaction: Prisma.TransactionClient, post: ClaimedPost) {
    const claimed = await transaction.socialPost.updateMany({ where: { id: post.id, leaseToken: post.leaseToken, leaseUntil: { gt: new Date() } }, data: { leaseUntil: new Date(Date.now() + 10 * 60_000) } });
    if (claimed.count !== 1) throw new Error("lease-lost");
  }
  return {
    async collect(post, version) {
      const contentHash = postContentHash(post);
      const old = await client.socialPost.findUnique({ where: { id: post.id } });
      // Recompute the previous observation using the current identity rules so
      // cache-key improvements do not invalidate already successful extraction.
      const previousHash = old ? postContentHash({ ...post, caption: old.caption, postedAt: old.postedAt?.toISOString() ?? null, media: old.mediaUrls, incompleteMedia: old.incompleteMedia }) : null;
      const changed = previousHash !== contentHash || old?.extractionVersion !== version;
      // CDN hosts and signatures expire without changing the underlying asset.
      // Fresh URLs can recover media failures without discarding saved extraction.
      const refreshedMediaFailure = old && ["pending", "failed"].includes(old.status)
        && ["image-preparation-failed", "image-storage-pending"].includes(old.lastError ?? "")
        && post.media.some((url, index) => url !== old.mediaUrls[index]);
      const common = { shortcode: post.shortcode, accountHandle: post.accountHandle, accountName: post.accountName, sourceUrl: post.sourceUrl, caption: post.caption, postedAt: post.postedAt ? new Date(post.postedAt) : null, mediaUrls: post.media, incompleteMedia: post.incompleteMedia ?? false, contentHash };
      if (!old) {
        try { await client.socialPost.create({ data: { id: post.id, ...common, extractionVersion: version } }); }
        catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error; }
        return;
      }
      await client.socialPost.updateMany({ where: { id: post.id, updatedAt: old.updatedAt, OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }] }, data: { ...common, ...(changed ? { status: "pending", extraction: Prisma.DbNull, extractionVersion: version, attempts: 0, nextRetryAt: null, leaseToken: null, leaseUntil: null, lastError: null } : refreshedMediaFailure || old.lastError === "event-ended" ? { status: "pending", attempts: 0, nextRetryAt: null, lastError: null } : {}) } });
    },
    async claim(account, now, activeHandles) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const post = await client.socialPost.findFirst({ where: { ...(account ? { accountHandle: account } : activeHandles ? { accountHandle: { in: activeHandles } } : {}), status: { in: ["pending", "processing"] }, AND: [{ OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] }, { OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] }] }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
        if (!post) return null;
        const leaseToken = randomUUID();
        const claimed = await client.socialPost.updateMany({ where: { id: post.id, updatedAt: post.updatedAt, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] }, data: { status: "processing", leaseToken, leaseUntil: new Date(now.getTime() + 10 * 60_000) } });
        if (claimed.count === 1) return { ...post, status: "processing", leaseToken };
      }
      return null;
    },
    async mappings(postId) {
      const mappings = await client.socialEventMapping.findMany({ where: { postId }, orderBy: { slot: "asc" } });
      if (mappings.length) return mappings;
      const post = await client.socialPost.findUniqueOrThrow({ where: { id: postId } });
      const fingerprint = createSourceFingerprint("instagram-clubs", `${post.accountHandle}:${post.shortcode}`)!;
      const legacy = await client.event.findUnique({ where: { sourceFingerprint: fingerprint } });
      return legacy ? [{ id: hash(`${postId}:0`), postId, slot: 0, titleKey: titleKey(legacy.title), localDate: localDate(legacy.startTime.toISOString()), candidate: {}, eventId: legacy.id, imageIndex: null, imagePending: false, unverifiedLegacy: !!post.postedAt && legacy.startTime.getTime() === post.postedAt.getTime() && /^(?:see source for location|location not provided|unknown|tba|tbd)$/i.test(legacy.locationName.trim()) }] : [];
    },
    media: (postId) => client.socialMedia.findMany({ where: { postId } }),
    async saveMedia(post, value) {
      await client.$transaction(async (tx) => {
        await requireLease(tx, post);
        await tx.socialMedia.upsert({ where: { postId_identity: { postId: post.id, identity: value.identity } }, create: { ...value, postId: post.id }, update: { ...value } });
      });
    },
    async saveExtraction(post, extraction, usage, version) {
      const saved = await client.socialPost.updateMany({ where: { id: post.id, leaseToken: post.leaseToken, leaseUntil: { gt: new Date() } }, data: { extraction: json(extraction), extractionVersion: version, extractionModel: usage.model, inputTokens: { increment: usage.inputTokens }, outputTokens: { increment: usage.outputTokens }, leaseUntil: new Date(Date.now() + 10 * 60_000) } });
      if (!saved.count) throw new Error("lease-lost");
    },
    async publish(post, publications) {
      // Serialize publication against other posts: canonical matches and mapping writes are atomic.
      return client.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(80411233)`;
        await requireLease(tx, post);
        const ids: string[] = [];
        for (const publication of publications) {
          const { candidate, slot } = publication;
          const old = await tx.socialEventMapping.findUnique({ where: { postId_slot: { postId: post.id, slot } } });
          const fingerprint = createSourceFingerprint("instagram-clubs", `${post.accountHandle}:${post.shortcode}${slot === 0 ? "" : `:event:${slot}`}`)!;
          const own = await tx.event.findUnique({ where: { sourceFingerprint: fingerprint } });
          const key = titleKey(candidate.title);
          const possible = await tx.event.findMany({ where: { startTime: new Date(candidate.startTime), supersededById: null }, orderBy: { createdAt: "asc" } });
          const canonical = possible.find((event) => titleKey(event.title) === key && titleKey(event.locationName) === titleKey(candidate.locationName) && event.source !== "instagram-clubs") ?? possible.find((event) => titleKey(event.title) === key && titleKey(event.locationName) === titleKey(candidate.locationName));
          const linked = old?.eventId ? await tx.event.findUnique({ where: { id: old.eventId } }) : null;
          const retained = canonical ?? linked ?? own;
          let eventId: string;
          if (retained && retained.sourceFingerprint !== fingerprint) {
            eventId = retained.id;
            if (own && own.id !== retained.id) {
              await tx.event.update({ where: { id: own.id }, data: { supersededById: retained.id } });
              await mergeReferences(tx, own.id, retained.id);
              await tx.socialEventMapping.updateMany({ where: { eventId: own.id }, data: { eventId: retained.id } });
            }
            if (titleKey(retained.title) !== key || retained.startTime.toISOString() !== candidate.startTime || titleKey(retained.locationName) !== titleKey(candidate.locationName)) throw new Error("canonical-source-conflict");
            if (!retained.imageUrl && candidate.imageUrl) await tx.event.update({ where: { id: eventId }, data: { imageUrl: candidate.imageUrl } });
          } else {
            eventId = retained?.id ?? `event-${fingerprint}`;
            const contentHash = createEventContentHash(candidate);
            const values = { source: candidate.source, sourceUrl: candidate.sourceUrl, sourceFingerprint: fingerprint, title: candidate.title, description: candidate.description, clubName: candidate.clubName, startTime: new Date(candidate.startTime), endTime: new Date(candidate.endTime), endTimeEstimated: candidate.endTimeEstimated ?? false, locationName: candidate.locationName, buildingCode: candidate.buildingCode ?? null, sourceTags: candidate.tags, isFreeFood: candidate.isFreeFood, contentHash, ...(candidate.imageUrl ? { imageUrl: candidate.imageUrl } : {}), ...(retained?.contentHash !== contentHash ? { classificationStatus: "pending" as const } : {}) };
            await tx.event.upsert({ where: { sourceFingerprint: fingerprint }, create: { id: eventId, ...values }, update: values });
          }
          if (!retained || retained.source === "instagram-clubs") await persistSourceLocation(tx, eventId, candidate);
          const values = { titleKey: key, localDate: localDate(candidate.startTime), candidate: json(candidate), eventId, imageIndex: publication.imageIndex, imagePending: publication.imagePending };
          await tx.socialEventMapping.upsert({ where: { postId_slot: { postId: post.id, slot } }, create: { id: hash(`${post.id}:${slot}`), postId: post.id, slot, ...values }, update: values });
          ids.push(eventId);
        }
        return [...new Set(ids)];
      }, { timeout: 30_000 });
    },
    async finish(post, status, reason) {
      const result = await client.socialPost.updateMany({ where: { id: post.id, leaseToken: post.leaseToken, leaseUntil: { gt: new Date() } }, data: { status: status === "pending" && post.attempts >= 2 ? "failed" : status, leaseToken: null, leaseUntil: null, lastError: reason ?? null, attempts: status === "pending" ? post.attempts + 1 : 0, nextRetryAt: status === "pending" ? new Date(Date.now() + 60_000 * 2 ** post.attempts) : null } });
      if (!result.count) throw new Error("lease-lost");
    },
    async fail(post, code, now) {
      const attempts = post.attempts + 1;
      await client.socialPost.updateMany({ where: { id: post.id, leaseToken: post.leaseToken }, data: { attempts, status: attempts >= 3 ? "failed" : "pending", nextRetryAt: new Date(now.getTime() + Math.min(60_000 * 2 ** (attempts - 1), 3600_000)), leaseToken: null, leaseUntil: null, lastError: code.slice(0, 100) } });
    },
  };
}

// A helper for official-source image backfill; event facts are never rewritten here.
export async function updateEventImage(client: PrismaClient, eventId: string, expectedUrl: string | null, publicUrl: string, contentHash?: string) {
  return client.event.updateMany({ where: { id: eventId, imageUrl: expectedUrl }, data: { imageUrl: publicUrl, imageContentHash: contentHash } });
}
export { createPrismaEventPersistenceRepository };

/** Retire pre-existing duplicate cards without deleting IDs used by saved links. */
export async function reconcileCanonicalEvents(client: PrismaClient) {
  const events = await client.event.findMany({ where: { endTime: { gte: new Date() }, supersededById: null }, orderBy: { createdAt: "asc" } });
  const groups = new Map<string, typeof events>();
  for (const event of events) {
    const key = `${titleKey(event.title)}|${event.startTime.toISOString()}|${titleKey(event.locationName)}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  let merged = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    await client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(80411233)`;
      // Snapshot groups can become stale while a manual worker is rescheduling.
      // Only merge rows that still share a signature after acquiring the lock.
      const current = await tx.event.findMany({ where: { id: { in: group.map((event) => event.id) }, supersededById: null }, orderBy: { createdAt: "asc" } });
      const currentGroups = new Map<string, typeof current>();
      for (const event of current) {
        const key = `${titleKey(event.title)}|${event.startTime.toISOString()}|${titleKey(event.locationName)}`;
        currentGroups.set(key, [...(currentGroups.get(key) ?? []), event]);
      }
      for (const matches of currentGroups.values()) {
        if (matches.length < 2) continue;
        const retained = matches.find((event) => event.source !== "instagram-clubs") ?? matches[0];
        for (const duplicate of matches) {
          if (duplicate.id === retained.id) continue;
          await tx.event.updateMany({ where: { id: duplicate.id, supersededById: null }, data: { supersededById: retained.id } });
          await mergeReferences(tx, duplicate.id, retained.id);
          await tx.socialEventMapping.updateMany({ where: { eventId: duplicate.id }, data: { eventId: retained.id } });
          if (!retained.imageUrl && duplicate.imageUrl) await tx.event.update({ where: { id: retained.id }, data: { imageUrl: duplicate.imageUrl } });
          merged++;
        }
      }
    });
  }
  return merged;
}

async function mergeReferences(tx: Prisma.TransactionClient, oldId: string, newId: string) {
  await tx.interaction.updateMany({ where: { eventId: oldId }, data: { eventId: newId } });
  const tables = await tx.$queryRaw<Array<{ saved: string | null; rsvps: string | null }>>`SELECT to_regclass('public.saved_events')::text AS saved, to_regclass('public.event_rsvps')::text AS rsvps`;
  if (tables[0]?.saved) {
    await tx.$executeRaw`INSERT INTO public.saved_events (user_id,event_id,created_at) SELECT user_id,${newId},created_at FROM public.saved_events WHERE event_id=${oldId} ON CONFLICT (user_id,event_id) DO NOTHING`;
    await tx.$executeRaw`DELETE FROM public.saved_events WHERE event_id=${oldId}`;
  }
  if (tables[0]?.rsvps) {
    await tx.$executeRaw`INSERT INTO public.event_rsvps (user_id,event_id,status,created_at,updated_at) SELECT user_id,${newId},status,created_at,updated_at FROM public.event_rsvps WHERE event_id=${oldId} ON CONFLICT (user_id,event_id) DO UPDATE SET status=EXCLUDED.status,updated_at=EXCLUDED.updated_at WHERE EXCLUDED.updated_at > event_rsvps.updated_at`;
    await tx.$executeRaw`DELETE FROM public.event_rsvps WHERE event_id=${oldId}`;
  }
}
