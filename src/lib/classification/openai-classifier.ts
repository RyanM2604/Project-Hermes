import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  buildClassificationPrompt,
  type ClassificationPromptInput,
} from "./prompt";
import {
  AUDIENCES,
  EVENT_TAGS,
  FORMATS,
  VIBES,
  classificationSchema,
  type Classification,
} from "./schema";

export type OpenAIClassifierUnavailableCode =
  | "missing-api-key"
  | "provider-error"
  | "timeout";

export type OpenAIClassifierResult =
  | {
      model: string;
      classification: Classification;
      status: "classified";
    }
  | {
      model: string;
      code: OpenAIClassifierUnavailableCode;
      status: "unavailable";
    }
  | {
      model: string;
      code: "invalid-output";
      status: "invalid-output";
    };

interface OpenAIResponsesClient {
  create(
    request: {
      input: string;
      instructions: string;
      model: string;
      response_format?: unknown;
    },
    options?: {
      signal?: AbortSignal;
    },
  ): Promise<{
    output_text?: string;
  }>;
}

export interface OpenAIClassifierClient {
  responses: OpenAIResponsesClient;
}

export interface OpenAIClassifierOptions {
  apiKey?: string;
  client?: OpenAIClassifierClient;
  model?: string;
  timeoutMs?: number;
}

const DEFAULT_MODEL = "gpt-5.1-mini";
const DEFAULT_TIMEOUT_MS = 15_000;

const openAIClassificationResponseSchema = z.object({
  primaryTag: z.enum(EVENT_TAGS),
  tags: z.array(z.enum(EVENT_TAGS)).min(1).max(5),
  vibes: z.array(z.enum(VIBES)).max(3),
  audiences: z.array(z.enum(AUDIENCES)).max(3),
  format: z.enum(FORMATS),
  confidence: z.number().min(0).max(1),
  rationale: z.string().trim().min(1).max(240),
});

function parseTimeoutMs(value: string | undefined): number {
  if (!value) {
    return DEFAULT_TIMEOUT_MS;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function createOpenAIClient(apiKey: string): OpenAIClassifierClient {
  return new OpenAI({
    apiKey,
  }) as unknown as OpenAIClassifierClient;
}

function parseClassification(outputText: string): Classification | null {
  try {
    const parsed = JSON.parse(outputText);
    const result = classificationSchema.safeParse(parsed);

    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function createOpenAIClassifier(options: OpenAIClassifierOptions = {}) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const model =
    options.model ?? process.env.OPENAI_CLASSIFICATION_MODEL ?? DEFAULT_MODEL;
  const timeoutMs =
    options.timeoutMs ??
    parseTimeoutMs(process.env.OPENAI_CLASSIFICATION_TIMEOUT_MS);
  const client = options.client ?? (apiKey ? createOpenAIClient(apiKey) : undefined);

  return {
    async classify(
      input: ClassificationPromptInput,
    ): Promise<OpenAIClassifierResult> {
      if (!apiKey) {
        return {
          model,
          code: "missing-api-key",
          status: "unavailable",
        };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await client!.responses.create(
          {
            input: buildClassificationPrompt(input),
            instructions:
              "Return a single JSON object that matches the Hermes event classification schema.",
            model,
            response_format: zodTextFormat(
              openAIClassificationResponseSchema,
              "hermes_event_classification",
            ),
          },
          {
            signal: controller.signal,
          },
        );

        const classification = parseClassification(response.output_text ?? "");

        if (!classification) {
          return {
            model,
            code: "invalid-output",
            status: "invalid-output",
          };
        }

        return {
          model,
          classification,
          status: "classified",
        };
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) {
          return {
            model,
            code: "timeout",
            status: "unavailable",
          };
        }

        return {
          model,
          code: "provider-error",
          status: "unavailable",
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
