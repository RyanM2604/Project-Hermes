import { describe, expect, it, vi } from "vitest";

import type { ClassificationPromptInput } from "../prompt";

const promptInput: ClassificationPromptInput = {
  title: "Technical Interview Workshop",
  description: "Practice interviews with peers.",
  clubName: "Engineering Society",
  locationName: "E5 6006",
  sourceTags: ["career-coop", "hack-dev"],
};

describe("createOpenAIClassifier", () => {
  it("returns a validated classification from structured output", async () => {
    const create = vi.fn(async () => ({
      output_text: JSON.stringify({
        primaryTag: "hack-dev",
        tags: ["hack-dev", "career-coop"],
        vibes: ["focused", "professional"],
        audiences: ["technical", "career-focused"],
        format: "workshop",
        confidence: 0.92,
        rationale: "A technical career workshop.",
      }),
    }));

    const { createOpenAIClassifier } = await import("../openai-classifier");
    const classifier = createOpenAIClassifier({
      apiKey: "test-api-key",
      client: { responses: { create } },
      model: "test-model",
    });

    await expect(classifier.classify(promptInput)).resolves.toMatchObject({
      status: "classified",
      model: "test-model",
      classification: {
        primaryTag: "hack-dev",
        tags: ["hack-dev", "career-coop"],
      },
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        text: {
          format: expect.objectContaining({
            type: "json_schema",
          }),
        },
      }),
      expect.any(Object),
    );
  });

  it("returns unavailable without calling OpenAI when the API key is missing", async () => {
    const create = vi.fn();
    const { createOpenAIClassifier } = await import("../openai-classifier");
    const classifier = createOpenAIClassifier({
      client: { responses: { create } },
      model: "test-model",
    });

    await expect(classifier.classify(promptInput)).resolves.toEqual({
      status: "unavailable",
      code: "missing-api-key",
      model: "test-model",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("retries with the fallback model when the configured model is unavailable", async () => {
    const modelError = Object.assign(new Error("model unavailable"), {
      status: 400,
      code: "model_not_found",
    });
    const create = vi
      .fn()
      .mockRejectedValueOnce(modelError)
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          primaryTag: "hack-dev",
          tags: ["hack-dev"],
          vibes: ["focused"],
          audiences: ["technical"],
          format: "workshop",
          confidence: 0.9,
          rationale: "A technical workshop.",
        }),
      });

    const { createOpenAIClassifier } = await import("../openai-classifier");
    const classifier = createOpenAIClassifier({
      apiKey: "test-api-key",
      client: { responses: { create } },
      fallbackModel: "fallback-model",
      model: "missing-model",
    });

    await expect(classifier.classify(promptInput)).resolves.toMatchObject({
      status: "classified",
      model: "fallback-model",
    });
    expect(create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ model: "missing-model" }),
      expect.any(Object),
    );
    expect(create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ model: "fallback-model" }),
      expect.any(Object),
    );
  });

  it("returns a constrained failure for invalid structured output", async () => {
    const create = vi.fn(async () => ({
      output_text: JSON.stringify({
        primaryTag: "not-a-tag",
        tags: ["not-a-tag"],
        vibes: ["focused"],
        audiences: ["technical"],
        format: "workshop",
        confidence: 0.5,
        rationale: "Not a valid classification.",
      }),
    }));

    const { createOpenAIClassifier } = await import("../openai-classifier");
    const classifier = createOpenAIClassifier({
      apiKey: "test-api-key",
      client: { responses: { create } },
      model: "test-model",
    });

    await expect(classifier.classify(promptInput)).resolves.toEqual({
      status: "invalid-output",
      code: "invalid-output",
      model: "test-model",
    });
  });

  it("sanitizes provider failures and timeout failures", async () => {
    const providerCreate = vi.fn(async () => {
      throw new Error("private response body");
    });
    const timeoutCreate = vi.fn(async () => {
      const error = new Error("operation aborted");
      error.name = "AbortError";
      throw error;
    });

    const { createOpenAIClassifier } = await import("../openai-classifier");
    const providerClassifier = createOpenAIClassifier({
      apiKey: "test-api-key",
      client: { responses: { create: providerCreate } },
      model: "test-model",
    });
    const timeoutClassifier = createOpenAIClassifier({
      apiKey: "test-api-key",
      client: { responses: { create: timeoutCreate } },
      model: "test-model",
      timeoutMs: 1,
    });

    await expect(providerClassifier.classify(promptInput)).resolves.toEqual({
      status: "unavailable",
      code: "provider-error",
      model: "test-model",
    });
    await expect(timeoutClassifier.classify(promptInput)).resolves.toEqual({
      status: "unavailable",
      code: "timeout",
      model: "test-model",
    });
  });
});
