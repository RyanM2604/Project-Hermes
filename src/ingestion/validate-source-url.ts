const DEFAULT_TIMEOUT_MS = 5_000;
const CONFIRMED_DEAD_STATUSES = new Set([404, 410]);

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface ValidateSourceUrlOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

async function probeSourceUrl(
  sourceUrl: string,
  fetchImpl: FetchLike,
  method: "GET" | "HEAD",
  signal: AbortSignal,
): Promise<Response> {
  return fetchImpl(sourceUrl, {
    method,
    redirect: "follow",
    headers: {
      ...(method === "GET" ? { range: "bytes=0-0" } : {}),
      "user-agent": "Project-Hermes-Event-Ingestion/0.1",
    },
    signal,
  });
}

export async function validateSourceUrl(
  sourceUrl: string,
  options: ValidateSourceUrlOptions = {},
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    const headResponse = await probeSourceUrl(
      sourceUrl,
      fetchImpl,
      "HEAD",
      controller.signal,
    );

    if (!CONFIRMED_DEAD_STATUSES.has(headResponse.status)) {
      return true;
    }

    const getResponse = await probeSourceUrl(
      sourceUrl,
      fetchImpl,
      "GET",
      controller.signal,
    );

    return !CONFIRMED_DEAD_STATUSES.has(getResponse.status);
  } catch {
    // Transient failures must not remove otherwise valid source-backed events.
    return true;
  } finally {
    clearTimeout(timeout);
  }
}
