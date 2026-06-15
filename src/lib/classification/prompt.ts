import { AUDIENCES, EVENT_TAGS, FORMATS, VIBES } from "./schema";

export const CLASSIFICATION_PROMPT_VERSION = "2026-06-15.v1";

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
    "Only use career-coop when the evidence clearly shows career, co-op, internship, recruiting, interview, networking, or employer language.",
    "Only use hack-dev when the evidence clearly shows hackathon, coding, development, software, programming, technical workshop, or developer language.",
    "Use social sub-tags (games, hangout, arts-crafts, outdoors, nightlife, wellness, movie-tv) when the activity is clear; otherwise use chill-social alone.",
    "When a social sub-tag fits, include both the sub-tag and chill-social in tags and prefer the sub-tag as primaryTag.",
    `Supported tags: ${EVENT_TAGS.join(", ")}`,
    `Supported vibes: ${VIBES.join(", ")}`,
    `Supported audiences: ${AUDIENCES.join(", ")}`,
    `Supported formats: ${FORMATS.join(", ")}`,
    "Approved public event fields:",
    JSON.stringify(approvedFields, null, 2),
  ].join("\n");
}
