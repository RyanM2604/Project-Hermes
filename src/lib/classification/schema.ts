import { z } from "zod";

export const EVENT_TAGS = [
  "free-food",
  "hack-dev",
  "career-coop",
  "chill-social",
  "music",
  "reels",
  "startup-pitch",
] as const;

export const VIBES = [
  "focused",
  "social",
  "creative",
  "energetic",
  "relaxed",
  "professional",
] as const;

export const AUDIENCES = [
  "all-students",
  "undergraduate",
  "graduate",
  "technical",
  "career-focused",
  "founders",
  "performers",
] as const;

export const FORMATS = [
  "workshop",
  "social",
  "talk",
  "competition",
  "performance",
  "meal",
  "networking",
  "other",
] as const;

const eventTagSchema = z.enum(EVENT_TAGS);
const vibeSchema = z.enum(VIBES);
const audienceSchema = z.enum(AUDIENCES);
const formatSchema = z.enum(FORMATS);

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export const classificationSchema = z
  .object({
    primaryTag: eventTagSchema,
    tags: z.array(eventTagSchema).min(1).max(5).transform(dedupe),
    vibes: z.array(vibeSchema).max(3).transform(dedupe),
    audiences: z.array(audienceSchema).max(3).transform(dedupe),
    format: formatSchema,
    confidence: z.number().min(0).max(1),
    rationale: z.string().trim().min(1).max(240),
  })
  .refine((value) => value.tags.includes(value.primaryTag), {
    message: "primaryTag must appear in tags",
    path: ["primaryTag"],
  });

export type Classification = z.infer<typeof classificationSchema>;
export type EventTagClassification = (typeof EVENT_TAGS)[number];
export type Vibe = (typeof VIBES)[number];
export type Audience = (typeof AUDIENCES)[number];
export type EventFormat = (typeof FORMATS)[number];
