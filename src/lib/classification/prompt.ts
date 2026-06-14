import { AUDIENCES, EVENT_TAGS, FORMATS, VIBES } from "./schema";

export const CLASSIFICATION_PROMPT_VERSION = "2026-06-14.v1";

export interface ClassificationPromptInput {
  title: string;
  description: string;
  clubName: string;
  locationName: string;
  sourceTags: readonly string[];
}

export function buildClassificationPrompt(
  input: ClassificationPromptInput,
): string {
  const approvedFields = {
    title: input.title,
    description: input.description,
    clubName: input.clubName,
    locationName: input.locationName,
    sourceTags: [...input.sourceTags],
  };

  return [
    `Project Hermes event classification prompt version ${CLASSIFICATION_PROMPT_VERSION}.`,
    "Classify the event only from the supplied evidence.",
    "Never invent facts, never act like a chatbot, and output structured data only.",
    "Preserve supported source tags when evidence is weak and use confidence to express uncertainty.",
    `Supported tags: ${EVENT_TAGS.join(", ")}`,
    `Supported vibes: ${VIBES.join(", ")}`,
    `Supported audiences: ${AUDIENCES.join(", ")}`,
    `Supported formats: ${FORMATS.join(", ")}`,
    "Approved public event fields:",
    JSON.stringify(approvedFields, null, 2),
  ].join("\n");
}
