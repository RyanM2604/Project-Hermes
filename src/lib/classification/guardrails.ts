import type { EventTag } from "@/types/event";

import { parseEventTag } from "@/lib/events/filters";
import { socialSubTags } from "@/lib/events/social-tags";

import { classificationSchema, type Classification } from "./schema";
import type { FallbackClassificationInput } from "./fallback";

const CAREER_EVIDENCE = /\b(career fair|co-?op|coop|internship|intern|resume|résumé|job|jobs|hiring|recruit(?:ing)?|networking|interview|employer|professional development)\b/i;
const HACK_EVIDENCE = /\b(hackathon|hack[- ]?dev|developer|development|coding|code|software|programming|technical)\b/i;
const STARTUP_EVIDENCE = /\b(startup|start-up|pitch|founder|founders|venture|demo day|investor|incubator)\b/i;
const LEISURE_CONTEXT = /\b(game night|watch party|boat cruise|cruise|sports?|baseball|blue jays|rangers|picnic|beach|campfire|social club|trivia|outing|trip|tour)\b/i;
const SOCIAL_EVIDENCE = /\b(hangout|hang out|social hour|social event|social night|social mixer|mingle|casual meetup|board games?|game night|trivia|cards?|uno|catan|chess|paint night|crafts?|arts?|diy|bake|make and take|hike|hiking|outdoor|picnic|trail walk|park|beach|party|club night|pub crawl|night out|yoga|meditation|wellness|mindfulness|movie night|watch party|film screening|movie|tv watch|bonfire|campfire)\b/i;

const RISKY_TAGS = new Set<EventTag>([
  "career-coop",
  "hack-dev",
  "startup-pitch",
  "chill-social",
  ...socialSubTags,
]);

function normalizeText(input: FallbackClassificationInput): string {
  return [
    input.title,
    input.description,
    input.clubName,
    input.locationName,
  ]
    .join(" ")
    .trim();
}

function hasStrongEvidence(tag: EventTag, input: FallbackClassificationInput): boolean {
  const text = normalizeText(input);

  switch (tag) {
    case "career-coop":
      return CAREER_EVIDENCE.test(text) && !LEISURE_CONTEXT.test(text);
    case "hack-dev":
      return HACK_EVIDENCE.test(text);
    case "startup-pitch":
      return STARTUP_EVIDENCE.test(text) && !LEISURE_CONTEXT.test(text);
    case "chill-social":
      return SOCIAL_EVIDENCE.test(text);
    case "games":
      return /\b(board games?|game night|trivia|cards?|uno|catan|chess|bingo|quiz|poker)\b/i.test(
        text,
      );
    case "hangout":
      return /\b(hangout|hang out|social hour|mingle|meetup|meet up|casual meetup)\b/i.test(
        text,
      );
    case "arts-crafts":
      return /\b(paint night|crafts?|arts?|diy|bake|make and take)\b/i.test(text);
    case "outdoors":
      return /\b(hike|hiking|outdoor|picnic|trail walk|park|beach|bonfire|campfire)\b/i.test(
        text,
      );
    case "nightlife":
      return /\b(party|club night|pub crawl|night out|19\+)\b/i.test(text);
    case "wellness":
      return /\b(yoga|meditation|wellness|mindfulness|self-care|breathing)\b/i.test(
        text,
      );
    case "movie-tv":
      return /\b(movie night|watch party|film screening|movie|tv watch)\b/i.test(
        text,
      );
    default:
      return true;
  }
}

function isTrustedTag(
  tag: EventTag,
  input: FallbackClassificationInput,
  confidence?: number,
): boolean {
  if (!RISKY_TAGS.has(tag)) {
    return true;
  }

  if (confidence === undefined) {
    return hasStrongEvidence(tag, input);
  }

  return confidence >= 0.7 && hasStrongEvidence(tag, input);
}

function uniqueInOrder(tags: EventTag[]): EventTag[] {
  const seen = new Set<EventTag>();

  return tags.filter((tag) => {
    if (seen.has(tag)) {
      return false;
    }

    seen.add(tag);
    return true;
  });
}

export function filterTrustedTags(
  input: FallbackClassificationInput,
  tags: readonly EventTag[],
  confidence?: number,
): EventTag[] {
  return uniqueInOrder(
    tags.filter((tag) => isTrustedTag(tag, input, confidence)),
  );
}

export function sanitizeClassification(
  input: FallbackClassificationInput,
  classification: Classification,
): Classification | null {
  const tags = filterTrustedTags(input, classification.tags, classification.confidence);

  if (tags.length === 0) {
    return null;
  }

  const primaryTag = tags.includes(classification.primaryTag)
    ? classification.primaryTag
    : tags[0];

  const sanitized = classificationSchema.safeParse({
    ...classification,
    primaryTag,
    tags,
  });

  return sanitized.success ? sanitized.data : null;
}

export function isTrustedClassification(
  input: FallbackClassificationInput,
  classification: Classification,
): boolean {
  return sanitizeClassification(input, classification) !== null;
}
