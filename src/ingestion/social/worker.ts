import { ApifyAccountUnavailableError, fetchApifyInstagramPosts } from "../fetch-apify";
import { createInstagramSource } from "../sources/instagram-public";
import { instagramAccounts, type InstagramAccount } from "../sources/instagram-accounts";
import { deriveTags } from "../sources/utils";
import { resolveEventLocation } from "@/lib/events/location";
import { normalizedEventCandidateSchema } from "../schema";
import { createSocialExtractor, extractedPostSchema, normalizeExtractedEvent, EXTRACTION_VERSION } from "./extraction";
import { hash, matchEventSlots, mediaIdentity, normalizeSocialPosts, titleKey, type SocialPostInput } from "./posts";
import type { ClaimedPost, Publication, SocialRepository } from "./repository";
import type { PreparedImage } from "./media";

export interface SocialRunSummary {
  accounts: { handle: string; collected: number; failed: boolean; skipped?: boolean; reason?: string }[];
  complete?: boolean;
  processed: number; published: number; held: number; ignored: number; failed: number; imagePending: number;
  inputTokens: number; outputTokens: number; uploadedImages: number; eventIds: string[];
  reasons: Record<string, number>; dryRun: boolean;
  eligible?: number;
  evaluations?: Array<{ sourceUrl: string; disposition: string; events: Array<{ title: string; startTime?: string; locationName?: string; heldReason?: string }> }>;
}
export interface SocialWorkerOptions {
  repository: SocialRepository;
  extractor?: Pick<ReturnType<typeof createSocialExtractor>, "extract">;
  accounts?: readonly InstagramAccount[];
  account?: string;
  collectPosts?: boolean;
  dryRun?: boolean;
  now?: () => Date;
  budgetMs?: number;
  fetchPosts?: typeof fetchApifyInstagramPosts;
  prepareImage?: (url: string) => Promise<PreparedImage>;
  storeImage?: (image: PreparedImage) => Promise<{ storagePath: string; publicUrl: string }>;
  classify?: (ids: string[]) => Promise<unknown>;
  onProgress?: (progress: { stage: string; account?: string; collected?: number; processed?: number; reason?: string }) => void;
}
const addReason = (result: SocialRunSummary, reason: string) => { result.reasons[reason] = (result.reasons[reason] ?? 0) + 1; };

export async function runSocialIngestion(options: SocialWorkerOptions): Promise<SocialRunSummary> {
  const now = options.now ?? (() => new Date());
  const deadline = Date.now() + (options.budgetMs ?? 35 * 60_000);
  const extractor = options.extractor ?? createSocialExtractor({ deadline });
  const prepare = options.prepareImage ?? (async (url: string) => (await import("./media")).prepareImage(url));
  const store = options.storeImage ?? (async (image: PreparedImage) => (await import("./media")).storeImage(image));
  const result: SocialRunSummary = { accounts: [], processed: 0, published: 0, held: 0, ignored: 0, failed: 0, imagePending: 0, inputTokens: 0, outputTokens: 0, uploadedImages: 0, eventIds: [], reasons: {}, dryRun: !!options.dryRun, complete: true };
  const accounts = (options.accounts ?? instagramAccounts).filter((account) => account.active && (!options.account || account.instagramHandle.toLowerCase() === options.account.toLowerCase())).sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  if (options.account && !accounts.length) throw new Error("unknown-account");
  let cursor = 0;
  const dryPosts: SocialPostInput[] = [];
  async function collect() {
    while (cursor < accounts.length && Date.now() < deadline) {
      const account = accounts[cursor++];
      options.onProgress?.({ stage: "collecting", account: account.instagramHandle });
      try {
        const posts = normalizeSocialPosts(await (options.fetchPosts ?? fetchApifyInstagramPosts)(createInstagramSource(account), { resultsLimit: 12, skipPinnedPosts: false, dataDetailLevel: "detailedData" }), account);
        for (const post of posts) {
          if (options.dryRun) dryPosts.push(post);
          else await options.repository.collect(post, EXTRACTION_VERSION);
        }
        result.accounts.push({ handle: account.instagramHandle, collected: posts.length, failed: false });
        options.onProgress?.({ stage: "collected", account: account.instagramHandle, collected: posts.length });
      } catch (error) {
        const unavailable = error instanceof ApifyAccountUnavailableError;
        const reason = unavailable ? error.code : "account-collection-failed";
        result.accounts.push({ handle: account.instagramHandle, collected: 0, failed: !unavailable, ...(unavailable ? { skipped: true } : {}), reason });
        addReason(result, reason);
        options.onProgress?.({ stage: unavailable ? "account-unavailable" : "collection-failed", account: account.instagramHandle, reason });
      }
    }
  }
  if (options.collectPosts !== false) await Promise.all([collect(), collect()]);
  result.complete = cursor >= accounts.length || options.collectPosts === false;
  options.onProgress?.({ stage: "extracting", processed: 0 });
  if (options.dryRun) {
    result.eligible = 0;
    const evaluations: NonNullable<SocialRunSummary["evaluations"]> = [];
    result.evaluations = evaluations;
    // A dry-run evaluates source content without creating work records or uploading objects.
    let dryCursor = 0;
    async function evaluate() {
      while (dryCursor < dryPosts.length && Date.now() < deadline) {
        const post = dryPosts[dryCursor++];
        try {
          if (post.incompleteMedia || post.media.length > 10) { result.held++; addReason(result, "too-many-images"); continue; }
          const images: PreparedImage[] = [];
          let missingImages = false;
          for (const url of post.media) { try { images.push(await prepare(url)); } catch { missingImages = true; } }
          const extraction = await extractor.extract({ caption: post.caption, postedAt: post.postedAt, accountName: post.accountName, images });
          result.processed++;
          if (extraction.status === "failed") { result.failed++; addReason(result, extraction.code); continue; }
          result.inputTokens += extraction.inputTokens; result.outputTokens += extraction.outputTokens;
          const evaluation: NonNullable<SocialRunSummary["evaluations"]>[number] = { sourceUrl: post.sourceUrl, disposition: extraction.data.disposition, events: [] };
          evaluations.push(evaluation);
          if (missingImages) { result.imagePending++; addReason(result, "image-preparation-pending"); }
          if (missingImages && extraction.data.disposition !== "events") { result.failed++; addReason(result, "image-preparation-failed"); }
          else if (extraction.data.disposition === "not-event") result.ignored++;
          else if (extraction.data.disposition !== "events") { result.held++; addReason(result, extraction.data.disposition); }
          else for (const item of extraction.data.events) {
            const normalized = normalizeExtractedEvent(item, { postedAt: post.postedAt, now: now(), allowPast: true });
            if (!normalized.ok) { result.held++; addReason(result, normalized.reason); evaluation.events.push({ title: item.title, heldReason: normalized.reason }); }
            else { result.eligible = (result.eligible ?? 0) + 1; evaluation.events.push({ title: normalized.event.title, startTime: normalized.event.startTime, locationName: normalized.event.locationName }); }
          }
        } catch { result.failed++; addReason(result, "image-preparation-failed"); }
        finally {
          if (result.processed > 0 && result.processed % 10 === 0) options.onProgress?.({ stage: "extracting", processed: result.processed });
        }
      }
    }
    await Promise.all([evaluate(), evaluate()]);
    result.complete &&= dryCursor >= dryPosts.length;
    options.onProgress?.({ stage: result.complete ? "complete" : "deadline-reached", processed: result.processed });
    return result;
  }
  async function process(post: ClaimedPost) {
    result.processed++;
    if (post.incompleteMedia || post.mediaUrls.length > 10) { result.held++; addReason(result, "too-many-images"); await options.repository.finish(post, "held", "too-many-images"); return; }
    const existingMedia = await options.repository.media(post.id);
    const prepared = new Map<number, PreparedImage>();
    async function getImage(index: number) {
      if (index < 0 || index >= post.mediaUrls.length) throw new Error("invalid-image-index");
      if (prepared.has(index)) return prepared.get(index)!;
      const identity = mediaIdentity(post.mediaUrls[index]);
      const saved = existingMedia.find((image) => (image.identity === identity || mediaIdentity(image.sourceUrl) === identity) && image.publicUrl);
      const image = await prepare(saved?.publicUrl ?? post.mediaUrls[index]);
      prepared.set(index, image);
      return image;
    }
    let extraction = extractedPostSchema.safeParse(post.extraction);
    let unavailableImages = false;
    if (!extraction.success) {
      const images: PreparedImage[] = [];
      // Sequential media downloads bound memory to the number of slides in one post.
      const suppliedIndices: number[] = [];
      for (let i = 0; i < post.mediaUrls.length; i++) {
        try { images.push(await getImage(i)); suppliedIndices.push(i); }
        catch { unavailableImages = true; }
      }
      const response = await extractor.extract({ caption: post.caption, postedAt: post.postedAt?.toISOString() ?? null, accountName: post.accountName, images });
      if (response.status === "failed") throw new Error(response.code);
      result.inputTokens += response.inputTokens; result.outputTokens += response.outputTokens;
      const remapped = { ...response.data, events: response.data.events.map((event) => ({ ...event, imageIndex: event.imageIndex === null ? null : suppliedIndices[event.imageIndex] ?? null })) };
      if (!unavailableImages) await options.repository.saveExtraction(post, remapped, response, EXTRACTION_VERSION);
      extraction = extractedPostSchema.safeParse(remapped);
    }
    if (!extraction.success) throw new Error("invalid-output");
    const data = extraction.data;
    if (unavailableImages && data.disposition !== "events") throw new Error("image-preparation-failed");
    if (data.disposition !== "events" || data.events.length === 0) {
      const ignored = data.disposition === "not-event";
      if (ignored) result.ignored++; else result.held++;
      addReason(result, data.disposition);
      await options.repository.finish(post, ignored ? "ignored" : "held", data.disposition);
      return;
    }
    const normalized = data.events.map((item) => normalizeExtractedEvent(item, { postedAt: post.postedAt?.toISOString() ?? null, now: now(), allowPast: true }));
    const valid = [...new Map(normalized.flatMap((item) => item.ok ? [[`${titleKey(item.event.title)}|${item.event.startTime}|${titleKey(item.event.locationName)}`, item.event] as const] : [])).values()];
    const gatheringKeys = valid.map((event) => `${event.startTime}|${titleKey(event.locationName)}`);
    if (new Set(gatheringKeys).size !== gatheringKeys.length) {
      result.held++; addReason(result, "ambiguous-same-time-events");
      await options.repository.finish(post, "held", "ambiguous-same-time-events"); return;
    }
    const invalid = normalized.flatMap((item) => !item.ok ? [item.reason] : []);
    invalid.forEach((reason) => addReason(result, reason));
    const mappings = await options.repository.mappings(post.id);
    let slots: number[];
    try { slots = mappings.length === 1 && mappings[0].unverifiedLegacy && valid.length === 1 ? [mappings[0].slot] : matchEventSlots(mappings, valid); }
    catch { result.held++; addReason(result, "ambiguous-event-mapping"); await options.repository.finish(post, "held", "ambiguous-event-mapping"); return; }
    const publications: Publication[] = [];
    let imagePending = unavailableImages;
    if (unavailableImages) { result.imagePending++; addReason(result, "image-preparation-pending"); }
    for (let i = 0; i < valid.length; i++) {
      const event = valid[i];
      let imageUrl: string | undefined;
      let pending = unavailableImages;
      if (event.imageIndex !== null) {
        try {
          const sourceUrl = post.mediaUrls[event.imageIndex];
          if (!sourceUrl) throw new Error("invalid-image-index");
          const identity = mediaIdentity(sourceUrl);
          const cached = existingMedia.find((image) => (image.identity === identity || mediaIdentity(image.sourceUrl) === identity) && image.publicUrl);
          if (cached?.publicUrl) imageUrl = cached.publicUrl;
          else {
            const image = await getImage(event.imageIndex);
            const stored = await store(image);
            imageUrl = stored.publicUrl;
            await options.repository.saveMedia(post, { id: hash(`${post.id}:${identity}`), identity, sourceUrl, contentHash: image.contentHash, ...stored });
            result.uploadedImages++;
          }
        } catch { pending = true; imagePending = true; result.imagePending++; addReason(result, "image-storage-pending"); }
      }
      const location = resolveEventLocation({ locationName: event.locationName, description: event.description });
      const tags = deriveTags(event.title, event.description);
      const candidate = normalizedEventCandidateSchema.parse({ source: "instagram-clubs", sourceUrl: post.sourceUrl, sourceFingerprint: hash(`${post.id}:${slots[i]}`), title: event.title, description: event.description || event.title, clubName: post.accountName, startTime: event.startTime, endTime: event.endTime, endTimeEstimated: event.endTimeEstimated, locationName: location.locationName, buildingCode: location.buildingCode, tags, isFreeFood: tags.includes("free-food"), ...(imageUrl ? { imageUrl } : {}) });
      publications.push({ slot: slots[i], candidate, imageIndex: event.imageIndex, imagePending: pending });
    }
    if (publications.length) {
      const ids = await options.repository.publish(post, publications);
      result.eventIds.push(...ids); result.published += ids.length;
    }
    if (invalid.length) result.held++;
    await options.repository.finish(post, imagePending ? "pending" : invalid.length ? "held" : "ready", imagePending ? "image-storage-pending" : invalid[0]);
  }
  async function drain() {
    while (Date.now() < deadline) {
      const post = await options.repository.claim(options.account?.toLowerCase(), now(), accounts.map((account) => account.instagramHandle.toLowerCase()));
      if (!post) return;
      try { await process(post); }
      catch (error) {
        const message = error instanceof Error ? error.message : "processing-error";
        const code = /^(?:provider-error|timeout|missing-api-key|invalid-output|invalid-image-index|lease-lost|image-[\w-]+)$/.test(message) ? message : "processing-error";
        if (message === "canonical-source-conflict") { result.held++; addReason(result, message); await options.repository.finish(post, "held", message); }
        else { result.failed++; addReason(result, code); await options.repository.fail(post, code, now()); }
      }
      if (result.processed % 10 === 0) options.onProgress?.({ stage: "extracting", processed: result.processed });
    }
  }
  await Promise.all([drain(), drain()]);
  if (Date.now() >= deadline) result.complete = false;
  options.onProgress?.({ stage: result.complete ? "complete" : "deadline-reached", processed: result.processed });
  result.eventIds = [...new Set(result.eventIds)];
  if (result.eventIds.length && options.classify) await options.classify(result.eventIds);
  return result;
}
