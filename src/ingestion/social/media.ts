import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
export interface PreparedImage { bytes: Buffer; dataUrl: string; contentHash: string }
interface ResolvedAddress { address: string; family: number }
export interface ImageResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: AsyncIterable<Uint8Array>;
  cancel(): void;
}
export interface PrepareImageOptions {
  resolve?: (hostname: string) => Promise<ResolvedAddress[]>;
  request?: (url: URL, address: ResolvedAddress, signal: AbortSignal) => Promise<ImageResponse>;
  timeoutMs?: number;
}

/** Only globally routable addresses may be used as source-image destinations. */
export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a,b,c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
  }
  if (isIP(address) === 6) {
    const value = address.toLowerCase();
    // Conservatively admit global-unicast only, excluding documentation, protocol,
    // transition, benchmarking, ORCHID and IPv4-mapped ranges.
    if (!/^[23][0-9a-f]{0,3}:/.test(value)) return false;
    const first = parseInt(value.split(":")[0], 16);
    const second = parseInt(value.split(":")[1] || "0", 16);
    if (first < 0x2000 || first > 0x3fff) return false;
    if (first === 0x2002 || (first === 0x2001 && second <= 0x1ff) || (first === 0x2001 && second === 0xdb8) || first === 0x3fff) return false;
    return true;
  }
  return false;
}
function safeUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("unsafe-image-url"); }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || (isIP(hostname) && !isPublicAddress(hostname))) throw new Error("unsafe-image-url");
  return url;
}
function nativeRequest(url: URL, address: ResolvedAddress, signal: AbortSignal): Promise<ImageResponse> {
  return new Promise((resolve, reject) => {
    // Connect to the validated literal address. TLS still verifies the original
    // hostname and Host still selects that hostname; DNS cannot rebind at connect.
    const req = httpsRequest({ protocol: "https:", hostname: address.address, family: address.family, port: 443, servername: url.hostname.replace(/^\[|\]$/g, ""), path: `${url.pathname}${url.search}`, method: "GET", headers: { Host: url.host, Accept: "image/jpeg,image/png,image/webp", "User-Agent": "Hermes-Event-Ingestion/1.0" }, signal, agent: false }, response => {
      resolve({ status: response.statusCode ?? 0, headers: response.headers, body: response, cancel: () => response.destroy() });
    });
    req.once("error", reject);
    req.end();
  });
}
async function download(urlValue: string, options: PrepareImageOptions, signal: AbortSignal): Promise<Buffer> {
  let url = safeUrl(urlValue);
  for (let redirects = 0; redirects <= 3; redirects++) {
    signal.throwIfAborted();
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await (options.resolve ?? (name => lookup(name, { all: true, verbatim: true })))(hostname);
    if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error("unsafe-image-address");
    signal.throwIfAborted();
    const response = await (options.request ?? nativeRequest)(url, addresses[0], signal);
    try {
      if ([301,302,303,307,308].includes(response.status)) {
        if (redirects === 3) throw new Error("image-redirect-limit");
        const location = response.headers.location;
        if (typeof location !== "string") throw new Error("invalid-image-redirect");
        url = safeUrl(new URL(location, url).href);
        continue;
      }
      if (response.status !== 200) throw new Error("image-http-error");
      const length = response.headers["content-length"];
      if (typeof length === "string" && Number(length) > MAX_IMAGE_BYTES) throw new Error("image-too-large");
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const value of response.body) {
        signal.throwIfAborted();
        const chunk = Buffer.from(value);
        size += chunk.length;
        if (size > MAX_IMAGE_BYTES) throw new Error("image-too-large");
        chunks.push(chunk);
      }
      return Buffer.concat(chunks, size);
    } finally { response.cancel(); }
  }
  throw new Error("image-redirect-limit");
}
export async function prepareImage(url: string, options: PrepareImageOptions = {}): Promise<PreparedImage> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("image-timeout")); }, options.timeoutMs ?? 15_000); });
  try {
    return await Promise.race([(async () => {
      const input = await download(url, options, controller.signal);
      let metadata;
      try { metadata = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, animated: false }).metadata(); } catch { throw new Error("invalid-image"); }
      if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new Error("unsupported-image-format");
      let bytes: Buffer;
      try { bytes = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, animated: false }).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(); } catch { throw new Error("invalid-image"); }
      if (bytes.length > MAX_IMAGE_BYTES) throw new Error("image-too-large");
      return { bytes, dataUrl: `data:image/webp;base64,${bytes.toString("base64")}`, contentHash: createHash("sha256").update(bytes).digest("hex") };
    })(), timeout]);
  } finally { clearTimeout(timer); controller.abort(); }
}

interface StorageError { statusCode?: string | number; status?: string | number }
export interface MediaStorageClient {
  storage: {
    from(bucket: string): {
      upload(path: string, bytes: Buffer, options: { contentType: string; cacheControl: string; upsert: boolean }): Promise<{ error: StorageError | null }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
    createBucket(name: string, options: { public: boolean; allowedMimeTypes: string[]; fileSizeLimit: number }): Promise<{ error: StorageError | null }>;
    getBucket(name: string): Promise<{ data: { public: boolean; allowed_mime_types?: string[] | null; file_size_limit?: number | null } | null; error: StorageError | null }>;
  };
}
export interface ImageStorageOptions { client?: MediaStorageClient; bucket?: string; supabaseUrl?: string }
function storageConfig(options: ImageStorageOptions) {
  const value = options.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error("missing-storage-config");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("invalid-storage-config"); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("invalid-storage-config");
  const bucket = options.bucket ?? process.env.EVENT_IMAGES_BUCKET ?? "event-images";
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(bucket)) throw new Error("invalid-storage-bucket");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!options.client && !key) throw new Error("missing-storage-config");
  const client = options.client ?? createClient(url.origin, key!, { auth: { persistSession: false, autoRefreshToken: false } }) as unknown as MediaStorageClient;
  return { client, bucket, origin: url.origin };
}
const conflict = (error: StorageError | null) => error && Number(error.statusCode ?? error.status) === 409;
export async function storeImage(image: PreparedImage, options: ImageStorageOptions = {}): Promise<{ storagePath: string; publicUrl: string }> {
  if (!/^[a-f0-9]{64}$/.test(image.contentHash) || createHash("sha256").update(image.bytes).digest("hex") !== image.contentHash) throw new Error("invalid-image-hash");
  const { client, bucket, origin } = storageConfig(options);
  const storagePath = `${image.contentHash}.webp`;
  const target = client.storage.from(bucket);
  const { error } = await target.upload(storagePath, image.bytes, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (error && !conflict(error)) throw new Error("image-upload-failed");
  const publicUrl = target.getPublicUrl(storagePath).data.publicUrl;
  const expected = `${origin}/storage/v1/object/public/${bucket}/${storagePath}`;
  if (publicUrl !== expected) throw new Error("invalid-storage-url");
  return { storagePath, publicUrl };
}
export async function createEventImageBucket(options: ImageStorageOptions = {}): Promise<void> {
  const { client, bucket } = storageConfig(options);
  const { error } = await client.storage.createBucket(bucket, { public: true, allowedMimeTypes: ["image/webp"], fileSizeLimit: MAX_IMAGE_BYTES });
  if (!error) return;
  if (!conflict(error)) throw new Error("image-bucket-create-failed");
  const existing = await client.storage.getBucket(bucket);
  if (existing.error || !existing.data?.public) throw new Error("existing-image-bucket-not-public");
}
