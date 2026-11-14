import { createHash } from "node:crypto";
import type { ApifyInstagramPost } from "../fetch-apify";
import type { InstagramAccount } from "../sources/instagram-accounts";

export interface SocialPostInput {
  id: string;
  shortcode: string;
  accountHandle: string;
  accountName: string;
  sourceUrl: string;
  caption: string;
  postedAt: string | null;
  media: string[];
  incompleteMedia?: boolean;
}
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const titleKey = (value: string) => value.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export const localDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
export function mediaIdentity(value: string): string {
  const url = new URL(value);
  const instagramCdn = /(?:^|\.)(?:cdninstagram\.com|fbcdn\.net)$/.test(url.hostname);
  return `${instagramCdn ? "instagram-cdn:" : url.origin}${url.pathname}`;
}
export function postContentHash(post: SocialPostInput): string {
  return hash(JSON.stringify({ caption: post.caption.normalize("NFC").trim(), postedAt: post.postedAt, incompleteMedia: post.incompleteMedia ?? false, media: post.media.map(mediaIdentity) }));
}
function imageUrl(item: Record<string, unknown>): string | undefined {
  for (const value of [item.displayUrl, item.thumbnailUrl, item.imageUrl]) {
    if (typeof value !== "string") continue;
    try { if (new URL(value).protocol === "https:") return value; } catch { /* Ignore malformed upstream media. */ }
  }
}
export function normalizeSocialPosts(posts: ApifyInstagramPost[], account: InstagramAccount): SocialPostInput[] {
  const seen = new Set<string>();
  return posts.flatMap((post) => {
    const shortcode = post.shortCode ?? post.shortcode;
    if (!shortcode || !/^[\w-]+$/.test(shortcode) || seen.has(shortcode)) return [];
    if (post.ownerUsername && post.ownerUsername.toLowerCase() !== account.instagramHandle.toLowerCase()) return [];
    seen.add(shortcode);
    const children = (post.childPosts ?? []).filter((child): child is Record<string, unknown> => typeof child === "object" && child !== null && !Array.isArray(child));
    const childImages = children.map(imageUrl).filter((value): value is string => !!value);
    const urls = children.length ? childImages : post.images?.length ? post.images.filter((value) => { try { return new URL(value).protocol === "https:"; } catch { return false; } }) : [imageUrl(post)].filter((value): value is string => !!value);
    const time = post.timestamp ?? post.postedAt ?? post.createdAt;
    const date = time ? new Date(time) : null;
    return [{ id: hash(`instagram:${account.instagramHandle.toLowerCase()}:${shortcode}`), shortcode, accountHandle: account.instagramHandle.toLowerCase(), accountName: account.clubName, sourceUrl: `https://www.instagram.com/${post.type === "Video" ? "reel" : "p"}/${shortcode}/`, caption: post.caption ?? "", incompleteMedia: children.length > 10 || children.some((child) => !imageUrl(child)), postedAt: date && Number.isFinite(date.getTime()) ? date.toISOString() : null, media: [...new Set(urls)] }];
  });
}
export interface ExistingSlot { slot: number; titleKey: string; localDate: string }
export function matchEventSlots(old: ExistingSlot[], events: { title: string; startTime: string }[]): number[] {
  const used = new Set<number>();
  const matches = events.map((event) => {
    const key = titleKey(event.title);
    const exact = old.filter((item) => item.titleKey === key && item.localDate === localDate(event.startTime) && !used.has(item.slot));
    const candidates = exact.length ? exact : old.filter((item) => item.titleKey === key && !used.has(item.slot));
    if (candidates.length > 1) throw new Error("ambiguous-event-mapping");
    if (candidates.length === 1) { used.add(candidates[0].slot); return candidates[0].slot; }
    return null;
  });
  if (matches.includes(null) && old.some((item) => !used.has(item.slot))) throw new Error("ambiguous-event-mapping");
  let next = Math.max(-1, ...old.map((item) => item.slot)) + 1;
  return matches.map((slot) => slot ?? next++);
}
