import { z } from "zod";

import { socialSubTags } from "@/lib/events/social-tags";

const eventSourceSchema = z.enum([
  "instagram-clubs",
  "uwaterloo-events",
  "wusa-events",
  "wusa-clubs",
]);
const eventTagSchema = z.enum([
  "free-food",
  "hack-dev",
  "career-coop",
  "general",
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
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    tags: z.array(eventTagSchema),
    imageUrl: httpUrlSchema.optional(),
    endTimeEstimated: z.boolean().optional(),
    isFreeFood: z.boolean(),
  })
  .superRefine((candidate, context) => {
    if ((candidate.latitude === undefined) !== (candidate.longitude === undefined)) {
      context.addIssue({ code: "custom", message: "Coordinates require both latitude and longitude", path: ["latitude"] });
    }
    if (new Date(candidate.endTime) < new Date(candidate.startTime)) {
      context.addIssue({
        code: "custom",
        message: "endTime must not be before startTime",
        path: ["endTime"],
      });
    }
  });
