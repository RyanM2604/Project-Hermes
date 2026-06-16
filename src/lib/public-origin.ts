const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function isLocalhostOrigin(origin: string) {
  try {
    return LOCALHOST_HOSTNAMES.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function getPublicAppOrigin() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredUrl) {
    const origin = new URL(configuredUrl).origin;

    if (process.env.NODE_ENV === "production" && isLocalhostOrigin(origin)) {
      throw new Error("NEXT_PUBLIC_APP_URL must not point to localhost in production");
    }

    return origin;
  }

  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing NEXT_PUBLIC_APP_URL in production");
  }

  return "https://example.com";
}
