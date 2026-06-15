import { afterEach, describe, expect, it, vi } from "vitest";

describe("public app origin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the configured public app URL origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.hermes.example/signup");
    const { getPublicAppOrigin } = await import("../public-origin");

    expect(getPublicAppOrigin()).toBe("https://app.hermes.example");
  });

  it("rejects localhost origins in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    const { getPublicAppOrigin } = await import("../public-origin");

    expect(() => getPublicAppOrigin()).toThrow(
      "NEXT_PUBLIC_APP_URL must not point to localhost in production",
    );
  });
});
