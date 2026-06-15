import { z } from "zod";

import { socialSubTags } from "@/lib/events/social-tags";

const eventSourceSchema = z.enum([
  "uwaterloo-events",
  "wusa-events",
  "wusa-clubs",
]);
const eventTagSchema = z.enum([
  "free-food",
  "hack-dev",
  "career-coop",
  "chill-social",
  "music",
  "reels",
  "startup-pitch",
  ...socialSubTags,
]);
const buildingCodeSchema = z.enum([
  "AL",
  "DC",
  "E5",
  "EC5",
  "E7",
  "FED",
  "MC",
  "PAC",
  "QNC",
  "SCH",
  "SLC",
  "TC",
]);

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const httpUrlSchema = z.string().url().refine(isHttpUrl);
const isoDateSchema = z.string().datetime({ offset: true });

export const normalizedEventCandidateSchema = z
  .object({
    source: eventSourceSchema,
    sourceUrl: httpUrlSchema,
    sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().min(1).max(20_000),
    clubName: z.string().trim().min(1).max(300),
    startTime: isoDateSchema,
    endTime: isoDateSchema,
    locationName: z.string().trim().min(1).max(500),
    buildingCode: buildingCodeSchema.optional(),
    tags: z.array(eventTagSchema),
    imageUrl: httpUrlSchema.optional(),
    isFreeFood: z.boolean(),
  })
  .superRefine((candidate, context) => {
    if (new Date(candidate.endTime) < new Date(candidate.startTime)) {
      context.addIssue({
        code: "custom",
        message: "endTime must not be before startTime",
        path: ["endTime"],
      });
    }
  });
