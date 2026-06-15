import { deriveTags } from "@/ingestion/sources/utils";
import { parseEventTag } from "@/lib/events/filters";
import { socialSubTags } from "@/lib/events/social-tags";
import type { EventTag } from "@/types/event";

import { filterTrustedTags } from "./guardrails";
import { classificationSchema, type Classification } from "./schema";

export const FALLBACK_PRIMARY_TAG_PRIORITY = [
  "hack-dev",
  "career-coop",
  "startup-pitch",
  "music",
  "reels",
  "free-food",
  ...socialSubTags,
  "chill-social",
] as const satisfies readonly EventTag[];

export interface FallbackClassificationInput {
  title: string;
  description: string;
  clubName: string;
  locationName: string;
  sourceTags: readonly string[];
}

const PRIMARY_TAG_METADATA: Readonly<
  Record<
    EventTag,
    {
      audiences: Classification["audiences"];
      confidence: number;
      format: Classification["format"];
      rationale: string;
      vibes: Classification["vibes"];
    }
  >
> = {
  "free-food": {
    audiences: ["all-students"],
    confidence: 0.6,
    format: "meal",
    rationale: "The event centers on food or refreshments.",
    vibes: ["social", "relaxed"],
  },
  "hack-dev": {
    audiences: ["technical", "undergraduate"],
    confidence: 0.8,
    format: "workshop",
    rationale: "The event looks technical or workshop-like.",
    vibes: ["focused", "professional"],
  },
  "career-coop": {
    audiences: ["career-focused", "undergraduate"],
    confidence: 0.8,
    format: "networking",
    rationale: "The event appears tied to careers or co-op.",
    vibes: ["professional", "focused"],
  },
  "chill-social": {
    audiences: ["all-students"],
    confidence: 0.2,
    format: "social",
    rationale: "The event is best treated as a casual campus social.",
    vibes: ["social", "relaxed"],
  },
  games: {
    audiences: ["all-students"],
    confidence: 0.65,
    format: "social",
    rationale: "The event centers on games or playful competition.",
    vibes: ["social", "relaxed"],
  },
  hangout: {
    audiences: ["all-students"],
    confidence: 0.55,
    format: "social",
    rationale: "The event looks like a casual hangout.",
    vibes: ["social", "relaxed"],
  },
  "arts-crafts": {
    audiences: ["all-students"],
    confidence: 0.65,
    format: "social",
    rationale: "The event centers on arts, crafts, or making things.",
    vibes: ["creative", "relaxed"],
  },
  outdoors: {
    audiences: ["all-students"],
    confidence: 0.65,
    format: "social",
    rationale: "The event looks outdoor or nature-oriented.",
    vibes: ["social", "energetic"],
  },
  nightlife: {
    audiences: ["all-students"],
    confidence: 0.65,
    format: "social",
    rationale: "The event looks like a nightlife or party experience.",
    vibes: ["social", "energetic"],
  },
  wellness: {
    audiences: ["all-students"],
    confidence: 0.65,
    format: "social",
    rationale: "The event centers on wellness or mindfulness.",
    vibes: ["relaxed", "social"],
  },
  "movie-tv": {
    audiences: ["all-students"],
    confidence: 0.65,
    format: "social",
    rationale: "The event centers on watching movies or TV together.",
    vibes: ["social", "relaxed"],
  },
  music: {
    audiences: ["performers", "all-students"],
    confidence: 0.7,
    format: "performance",
    rationale: "The event centers on music or live performance.",
    vibes: ["creative", "energetic"],
  },
  reels: {
    audiences: ["performers", "all-students"],
    confidence: 0.7,
    format: "performance",
    rationale: "The event looks media- or showcase-oriented.",
    vibes: ["creative", "energetic"],
  },
  "startup-pitch": {
    audiences: ["founders", "career-focused"],
    confidence: 0.75,
    format: "competition",
    rationale: "The event appears to be startup or pitch oriented.",
    vibes: ["energetic", "focused"],
  },
};

function uniqueInOrder(tags: EventTag[]): EventTag[] {
  const seen = new Set<EventTag>();
  const ordered: EventTag[] = [];

  for (const tag of tags) {
    if (!seen.has(tag)) {
      seen.add(tag);
      ordered.push(tag);
    }
  }

  return ordered;
}

function priorityIndex(tag: EventTag): number {
  return FALLBACK_PRIMARY_TAG_PRIORITY.indexOf(tag);
}

function sortByPriority(tags: EventTag[]): EventTag[] {
  return [...tags].sort((left, right) => priorityIndex(left) - priorityIndex(right));
}

function derivePrimaryTag(tags: EventTag[]): EventTag {
  return sortByPriority(tags)[0] ?? "chill-social";
}

function collectTags(input: FallbackClassificationInput): EventTag[] {
  const sourceTags = input.sourceTags.flatMap((tag) => {
    const parsed = parseEventTag(tag);

    return parsed ? [parsed] : [];
  });
  const derivedTags = deriveTags(
    input.title,
    input.description,
    input.clubName,
    input.locationName,
  );
  const tags = uniqueInOrder([...derivedTags, ...sourceTags]);
  const trustedTags = filterTrustedTags(input, tags);

  if (trustedTags.length > 0) {
    const ordered = sortByPriority(trustedTags);
    const hasSocialSubTag = ordered.some((tag) =>
      (socialSubTags as readonly EventTag[]).includes(tag),
    );

    if (hasSocialSubTag && !ordered.includes("chill-social")) {
      ordered.push("chill-social");
    }

    return ordered;
  }

  return ["chill-social"];
}

export function createFallbackClassification(
  input: FallbackClassificationInput,
): Classification {
  const tags = collectTags(input);
  const primaryTag = derivePrimaryTag(tags);
  const metadata = PRIMARY_TAG_METADATA[primaryTag];

  return classificationSchema.parse({
    primaryTag,
    tags,
    vibes: metadata.vibes,
    audiences: metadata.audiences,
    format: metadata.format,
    confidence: metadata.confidence,
    rationale: metadata.rationale,
  });
}
