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
      text?: {
        format: unknown;
      };
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
  fallbackModel?: string;
  model?: string;
  timeoutMs?: number;
}

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 15_000;

const openAIClassificationResponseSchema = z.object({
  primaryTag: z.enum(EVENT_TAGS),
  tags: z.array(z.enum(EVENT_TAGS)).min(1).max(3),
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

function isModelNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 400 &&
    "code" in error &&
    error.code === "model_not_found"
  );
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
  const fallbackModel = options.fallbackModel ?? DEFAULT_MODEL;
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
        const request = {
          input: buildClassificationPrompt(input),
          instructions:
            "Return a single JSON object that matches the Hermes event classification schema.",
          model,
          text: {
            format: zodTextFormat(
              openAIClassificationResponseSchema,
              "hermes_event_classification",
            ),
          },
        };
        let response: Awaited<ReturnType<OpenAIResponsesClient["create"]>>;
        let responseModel = model;

        try {
          response = await client!.responses.create(request, {
            signal: controller.signal,
          });
        } catch (error) {
          if (!isModelNotFoundError(error) || model === fallbackModel) {
            throw error;
          }

          responseModel = fallbackModel;
          response = await client!.responses.create(
            { ...request, model: fallbackModel },
            {
              signal: controller.signal,
            },
          );
        }

        const classification = parseClassification(response.output_text ?? "");

        if (!classification) {
          return {
            model: responseModel,
            code: "invalid-output",
            status: "invalid-output",
          };
        }

        return {
          model: responseModel,
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
