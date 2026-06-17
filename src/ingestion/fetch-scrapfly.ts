import { load } from "cheerio";

import type { IngestionSource } from "./types";

const DEFAULT_ENDPOINT = "https://api.scrapfly.io/scrape";

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface FetchScrapeFlyOptions {
  apiKey?: string;
  fetchImpl?: FetchLike;
}

interface ScrapeFlyResponse {
  content?: string;
  result?: {
    content?: string;
    html?: string;
    body?: string;
  };
}

function extractContent(payload: ScrapeFlyResponse): string | null {
  const candidates = [
    payload.content,
    payload.result?.content,
    payload.result?.html,
    payload.result?.body,
  ];

  return (
    candidates.find(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    ) ?? null
  );
}

function extractScriptContents(raw: string): string[] {
  const $ = load(raw);

  return $("script")
    .map((_, element) => $(element).text())
    .get()
    .map((text) => text.trim())
    .filter((text) => text.length > 0);
}

function extractInstagramPostUrls(raw: string, baseUrl: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  const addUrl = (href: string) => {
    try {
      const url = new URL(href, baseUrl);

      if (!url.hostname.endsWith("instagram.com")) {
        return;
      }

      const normalized = url.toString();

      if (seen.has(normalized)) {
        return;
      }

      seen.add(normalized);
      urls.push(normalized);
    } catch {
      // ignore invalid urls
    }
  };

  const $ = load(raw);

  $('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]')
    .map((_, element) => $(element).attr("href") ?? "")
    .get()
    .map((href) => href.trim())
    .filter((href) => href.length > 0)
    .forEach(addUrl);

  const regexes = [
    /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[^"' <>\]]+/g,
    /\/(?:p|reel|tv)\/[^"' <>\]]+/g,
    /"shortcode"\s*:\s*"([^"]+)"/g,
  ];

  for (const regex of regexes) {
    for (const match of raw.matchAll(regex)) {
      if (regex.source.includes("shortcode")) {
        addUrl(`https://www.instagram.com/p/${match[1]}/`);
      } else {
        addUrl(match[0]);
      }
    }
  }

  return urls;
}

function buildSyntheticInstagramDocument(htmlDocuments: readonly string[]): string {
  const scripts = htmlDocuments.flatMap((document) =>
    extractScriptContents(document).map((script) => `<script>${script}</script>`),
  );

  return `<!doctype html><html><head>${scripts.join("")}</head><body></body></html>`;
}

async function fetchScrapeFlyDocument(
  url: string,
  sourceId: string,
  options: FetchScrapeFlyOptions = {},
): Promise<string> {
  const apiKey = options.apiKey ?? process.env.SCRAPEFLY_API_KEY;

  if (!apiKey) {
    throw new Error(`Missing SCRAPEFLY_API_KEY for ${sourceId}`);
  }

  const endpoint = new URL(DEFAULT_ENDPOINT);
  endpoint.searchParams.set("key", apiKey);
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("render_js", "true");
  endpoint.searchParams.set("asp", "true");

  const response = await (options.fetchImpl ?? fetch)(endpoint, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`ScrapeFly request failed for ${sourceId}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (contentType.toLowerCase().includes("json")) {
    try {
      const payload = JSON.parse(body) as ScrapeFlyResponse;
      const content = extractContent(payload);

      if (!content) {
        throw new Error(`ScrapeFly response missing content for ${sourceId}`);
      }

      return content;
    } catch {
      throw new Error(`ScrapeFly response missing content for ${sourceId}`);
    }
  }

  if (body.trim().length === 0) {
    throw new Error(`ScrapeFly response missing content for ${sourceId}`);
  }

  return body;
}

export async function fetchScrapeFlyText(
  source: IngestionSource,
  options: FetchScrapeFlyOptions = {},
): Promise<string> {
  return fetchScrapeFlyDocument(source.url, source.id, options);
}

export async function fetchScrapeFlyInstagramText(
  source: IngestionSource,
  options: FetchScrapeFlyOptions = {},
): Promise<string> {
  const profileHtml = await fetchScrapeFlyDocument(source.url, source.id, options);
  const postUrls = extractInstagramPostUrls(profileHtml, source.url).slice(0, 8);

  if (postUrls.length === 0) {
    return buildSyntheticInstagramDocument([profileHtml]);
  }

  const postHtmls = await Promise.all(
    postUrls.map((url) => fetchScrapeFlyDocument(url, source.id, options)),
  );

  return buildSyntheticInstagramDocument([profileHtml, ...postHtmls]);
}
