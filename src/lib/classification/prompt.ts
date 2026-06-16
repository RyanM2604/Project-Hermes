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
    "Be strict. Only use a tag when the event clearly fits it.",
    "Use at most 3 tags total.",
    "Prefer one primary tag and at most two supporting tags.",
    "Only use career-coop when the evidence clearly shows career, co-op, internship, recruiting, interview, networking, or employer language.",
    "Do not use career-coop for sports nights, boat cruises, casual hangouts, or general social events.",
    "Only use hack-dev when the evidence clearly shows hackathon, coding, development, software, programming, technical workshop, or developer language.",
    "Do not use startup-pitch for generic innovation, showcase, or competition language without founders, pitching, venture, incubators, or investors.",
    "Only use chill-social when the event is clearly a casual social plan.",
    "Use social sub-tags (games, hangout, arts-crafts, outdoors, nightlife, wellness, movie-tv) when the activity is clear; otherwise do not force a social sub-tag.",
    "Use general for real events that do not clearly fit a narrower category.",
    "Use confidence to express uncertainty, but do not use confidence to justify a tag without evidence.",
    "When a social sub-tag fits, include both the sub-tag and chill-social in tags and prefer the sub-tag as primaryTag.",
    `Supported tags: ${EVENT_TAGS.join(", ")}`,
    `Supported vibes: ${VIBES.join(", ")}`,
    `Supported audiences: ${AUDIENCES.join(", ")}`,
    `Supported formats: ${FORMATS.join(", ")}`,
    "Approved public event fields:",
    JSON.stringify(approvedFields, null, 2),
  ].join("\n");
}
