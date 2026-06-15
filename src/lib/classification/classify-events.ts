import {
  CLASSIFICATION_PROMPT_VERSION,
} from "./prompt";
import {
  createFallbackClassification,
  type FallbackClassificationInput,
} from "./fallback";
import { sanitizeClassification } from "./guardrails";
import type { Classification } from "./schema";
import type { OpenAIClassifierResult } from "./openai-classifier";

export interface ClassificationCandidate extends FallbackClassificationInput {
  eventId: string;
}

export interface ClassificationRepository {
  getClassificationCandidate(
    eventId: string,
  ): Promise<ClassificationCandidate | null>;
  saveClassification(
    eventId: string,
    input: {
      classification: Classification;
      model: string;
      promptVersion: string;
      status: "classified" | "fallback";
    },
  ): Promise<void>;
}

export interface ClassificationClassifier {
  classify(
    input: FallbackClassificationInput,
  ): Promise<OpenAIClassifierResult>;
}

export interface ClassifyEventsOptions {
  classifier: ClassificationClassifier;
  eventIds: readonly string[];
  repository: ClassificationRepository;
  promptVersion?: string;
}

export interface ClassifyEventsResult {
  attemptedCount: number;
  classifiedCount: number;
  fallbackCount: number;
  skippedCount: number;
  failedCount: number;
}

const CONCURRENCY = 2;

async function processCandidate(
  candidate: ClassificationCandidate,
  options: Pick<ClassifyEventsOptions, "classifier" | "repository"> & {
    promptVersion: string;
  },
): Promise<"classified" | "fallback"> {
  const classificationResult = await options.classifier.classify(
    candidate,
  );

  if (classificationResult.status === "classified") {
    const trusted = sanitizeClassification(
      candidate,
      classificationResult.classification,
    );

    if (!trusted) {
      await options.repository.saveClassification(candidate.eventId, {
        classification: createFallbackClassification(candidate),
        model: classificationResult.model,
        promptVersion: options.promptVersion,
        status: "fallback",
      });

      return "fallback";
    }

    await options.repository.saveClassification(candidate.eventId, {
      classification: trusted,
      model: classificationResult.model,
      promptVersion: options.promptVersion,
      status: "classified",
    });

    return "classified";
  }

  await options.repository.saveClassification(candidate.eventId, {
    classification: createFallbackClassification(candidate),
    model: classificationResult.model,
    promptVersion: options.promptVersion,
    status: "fallback",
  });

  return "fallback";
}

export async function classifyEvents(
  options: ClassifyEventsOptions,
): Promise<ClassifyEventsResult> {
  const result: ClassifyEventsResult = {
    attemptedCount: 0,
    classifiedCount: 0,
    fallbackCount: 0,
    skippedCount: 0,
    failedCount: 0,
  };
  const promptVersion = options.promptVersion ?? CLASSIFICATION_PROMPT_VERSION;
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < options.eventIds.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const eventId = options.eventIds[currentIndex];

      try {
        const candidate = await options.repository.getClassificationCandidate(
          eventId,
        );

        if (!candidate) {
          result.skippedCount += 1;
          continue;
        }

        result.attemptedCount += 1;
        const status = await processCandidate(candidate, {
          classifier: options.classifier,
          repository: options.repository,
          promptVersion,
        });

        if (status === "classified") {
          result.classifiedCount += 1;
        } else {
          result.fallbackCount += 1;
        }
      } catch {
        result.failedCount += 1;
      }
    }
  }

  const workerCount = Math.min(CONCURRENCY, options.eventIds.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return result;
}

export { CLASSIFICATION_PROMPT_VERSION };
