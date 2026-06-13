import type { IngestionErrorCode, IngestionSource } from "./types";

const DEFAULT_MAX_BYTES = 2_000_000;
const DEFAULT_TIMEOUT_MS = 15_000;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface FetchSourceOptions {
  fetchImpl?: FetchLike;
  maxBytes?: number;
  timeoutMs?: number;
}

export class IngestionFetchError extends Error {
  constructor(
    readonly code: IngestionErrorCode,
    readonly source: IngestionSource["id"],
  ) {
    super(`Ingestion fetch failed for ${source}: ${code}`);
    this.name = "IngestionFetchError";
  }
}

function acceptsContentType(source: IngestionSource, contentType: string): boolean {
  return source.acceptedContentTypes.some((accepted) =>
    contentType.toLowerCase().startsWith(accepted.toLowerCase()),
  );
}

export async function fetchSourceText(
  source: IngestionSource,
  options: FetchSourceOptions = {},
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await (options.fetchImpl ?? fetch)(source.url, {
      headers: {
        accept: source.acceptedContentTypes.join(", "),
        "user-agent": "Project-Hermes-Event-Ingestion/0.1",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new IngestionFetchError("http-error", source.id);
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!acceptsContentType(source, contentType)) {
      throw new IngestionFetchError("unexpected-content-type", source.id);
    }

    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const contentLength = Number(response.headers.get("content-length"));

    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new IngestionFetchError("response-too-large", source.id);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());

    if (bytes.byteLength > maxBytes) {
      throw new IngestionFetchError("response-too-large", source.id);
    }

    return new TextDecoder().decode(bytes);
  } catch (error) {
    if (error instanceof IngestionFetchError) {
      throw error;
    }

    if (
      controller.signal.aborted ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      throw new IngestionFetchError("timeout", source.id);
    }

    throw new IngestionFetchError("network-error", source.id);
  } finally {
    clearTimeout(timeout);
  }
}
