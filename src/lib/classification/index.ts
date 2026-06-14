export {
  AUDIENCES,
  EVENT_TAGS,
  FORMATS,
  VIBES,
  classificationSchema,
} from "./schema";
export {
  CLASSIFICATION_PROMPT_VERSION,
  buildClassificationPrompt,
} from "./prompt";
export {
  FALLBACK_PRIMARY_TAG_PRIORITY,
  createFallbackClassification,
} from "./fallback";
export {
  createOpenAIClassifier,
  type OpenAIClassifierClient,
  type OpenAIClassifierOptions,
  type OpenAIClassifierResult,
  type OpenAIClassifierUnavailableCode,
} from "./openai-classifier";
