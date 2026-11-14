import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { prepareImage, storeImage, createEventImageBucket, isPublicAddress, type ImageResponse, type MediaStorageClient } from "./media";

const image = () => sharp({ create: { width: 20, height: 10, channels: 3, background: "red" } }).png().toBuffer();
const response = (bytes: Buffer, headers: Record<string,string> = {}, status = 200): ImageResponse => ({ status, headers, body: (async function* () { yield bytes; })(), cancel: vi.fn() });
const resolver = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);

describe("event media preparation", () => {
  it("pins the connection address and produces a content-addressed WebP", async () => {
    const request = vi.fn<NonNullable<NonNullable<Parameters<typeof prepareImage>[1]>["request"]>>(async () => response(await image(), { "content-type": "image/png" }));
    const prepared = await prepareImage("https://cdn.example/post.png", { resolve: resolver, request });
    expect(request.mock.calls[0][1]).toMatchObject({ address: "93.184.216.34", family: 4 });
    expect((await sharp(prepared.bytes).metadata()).format).toBe("webp");
    expect(prepared.contentHash).toBe(createHash("sha256").update(prepared.bytes).digest("hex"));
    expect(prepared.dataUrl).toBe(`data:image/webp;base64,${prepared.bytes.toString("base64")}`);
  });
  it("resizes without cropping or enlarging", async () => {
    const bytes = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "red" } }).jpeg().toBuffer();
    const prepared = await prepareImage("https://cdn.example/post.jpg", { resolve: resolver, request: async () => response(bytes) });
    expect(await sharp(prepared.bytes).metadata()).toMatchObject({ width: 1600, height: 800 });
  });
  it.each(["http://cdn.example/a", "https://name:pass@cdn.example/a", "https://cdn.example:8443/a", "https://127.0.0.1/a", "https://[::1]/a"])("rejects unsafe URL %s", async url => {
    await expect(prepareImage(url)).rejects.toThrow("unsafe-image-url");
  });
  it("rejects a hostname if any DNS answer is private", async () => {
    const request = vi.fn();
    await expect(prepareImage("https://cdn.example/a", { resolve: async () => [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }], request })).rejects.toThrow("unsafe-image-address");
    expect(request).not.toHaveBeenCalled();
  });
  it("validates redirect destinations before connecting", async () => {
    const request = vi.fn(async () => response(Buffer.alloc(0), { location: "https://127.0.0.1/private" }, 302));
    await expect(prepareImage("https://cdn.example/a", { resolve: resolver, request })).rejects.toThrow("unsafe-image-url");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("bounds redirect loops", async () => {
    const request = vi.fn(async () => response(Buffer.alloc(0), { location: "/again" }, 302));
    await expect(prepareImage("https://cdn.example/a", { resolve: resolver, request })).rejects.toThrow("image-redirect-limit");
    expect(request).toHaveBeenCalledTimes(4);
  });
  it("rejects oversized streaming bodies and misleading content lengths", async () => {
    await expect(prepareImage("https://cdn.example/a", { resolve: resolver, request: async () => response(Buffer.alloc(10 * 1024 * 1024 + 1)) })).rejects.toThrow("image-too-large");
    await expect(prepareImage("https://cdn.example/a", { resolve: resolver, request: async () => response(Buffer.alloc(1), { "content-length": "10485761" }) })).rejects.toThrow("image-too-large");
  });
  it("rejects invalid images and unsupported formats despite a valid MIME header", async () => {
    await expect(prepareImage("https://cdn.example/a", { resolve: resolver, request: async () => response(Buffer.from("not an image"), { "content-type": "image/png" }) })).rejects.toThrow("invalid-image");
    await expect(prepareImage("https://cdn.example/a", { resolve: resolver, request: async () => response(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>')) })).rejects.toThrow("unsupported-image-format");
  });
  it("limits DNS and transport time", async () => {
    await expect(prepareImage("https://cdn.example/a", { timeoutMs: 5, resolve: () => new Promise(() => {}), request: vi.fn() })).rejects.toThrow("image-timeout");
  });
  it.each(["0.0.0.0", "100.64.0.1", "192.0.2.1", "198.18.0.1", "203.0.113.2", "224.0.0.1", "::ffff:127.0.0.1", "2001:db8::1", "fc00::1", "fe80::1", "2002:7f00:1::", "2::1"])("rejects non-public address %s", value => expect(isPublicAddress(value)).toBe(false));
  it("accepts public IPv4 and IPv6", () => {
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
  });
});

function storage(error: unknown = null) {
  const upload = vi.fn(async () => ({ error }));
  const client = { storage: { from: vi.fn(() => ({ upload, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/event-images/${path}` } }) })), createBucket: vi.fn(async () => ({ error: null })), getBucket: vi.fn(async () => ({ data: { public: true }, error: null })) } };
  return { client: client as unknown as MediaStorageClient, upload, raw: client };
}
const prepared = async () => { const bytes = await sharp(await image()).webp().toBuffer(); return { bytes, dataUrl: `data:image/webp;base64,${bytes.toString("base64")}`, contentHash: createHash("sha256").update(bytes).digest("hex") }; };
describe("event image storage", () => {
  it("uses immutable content-addressed uploads and returns a public URL", async () => {
    const { client, upload } = storage(); const value = await prepared();
    const result = await storeImage(value, { client, supabaseUrl: "https://project.supabase.co" });
    expect(upload).toHaveBeenCalledWith(`${value.contentHash}.webp`, value.bytes, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    expect(result).toEqual({ storagePath: `${value.contentHash}.webp`, publicUrl: `https://project.supabase.co/storage/v1/object/public/event-images/${value.contentHash}.webp` });
  });
  it("reuses existing immutable objects on a conflict", async () => {
    const { client } = storage({ statusCode: "409" });
    await expect(storeImage(await prepared(), { client, supabaseUrl: "https://project.supabase.co" })).resolves.toHaveProperty("publicUrl");
  });
  it("does not swallow other upload errors", async () => {
    const { client } = storage({ statusCode: "403", message: "secret error" });
    await expect(storeImage(await prepared(), { client, supabaseUrl: "https://project.supabase.co" })).rejects.toThrow("image-upload-failed");
  });
  it("rejects a mismatched content hash", async () => {
    const { client } = storage();
    await expect(storeImage({ ...await prepared(), contentHash: "a".repeat(64) }, { client, supabaseUrl: "https://project.supabase.co" })).rejects.toThrow("invalid-image-hash");
  });
  it("rejects a returned public URL for a different origin", async () => {
    const { client } = storage();
    await expect(storeImage(await prepared(), { client, supabaseUrl: "https://other.supabase.co" })).rejects.toThrow("invalid-storage-url");
  });
  it("creates a restricted public bucket, and accepts an existing public bucket", async () => {
    const { client, raw } = storage();
    await createEventImageBucket({ client, supabaseUrl: "https://project.supabase.co" });
    expect(raw.storage.createBucket).toHaveBeenCalledWith("event-images", { public: true, allowedMimeTypes: ["image/webp"], fileSizeLimit: 10 * 1024 * 1024 });
    raw.storage.createBucket.mockResolvedValueOnce({ error: { statusCode: "409" } } as never);
    await expect(createEventImageBucket({ client, supabaseUrl: "https://project.supabase.co" })).resolves.toBeUndefined();
  });
});
