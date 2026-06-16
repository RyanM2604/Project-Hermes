import type { PrismaClient } from "@prisma/client";

import type { Classification } from "./schema";
import type { ClassificationCandidate, ClassificationRepository } from "./classify-events";

interface ClassificationReadClient {
  event: {
    findFirst(args: {
      where: {
        id: string;
        classificationStatus: {
          in: Array<"pending" | "retry">;
        };
      };
      select: {
        id: true;
        title: true;
        description: true;
        clubName: true;
        locationName: true;
        sourceTags: true;
      };
    }): Promise<{
      id: string;
      title: string;
      description: string;
      clubName: string;
      locationName: string;
      sourceTags: string[];
    } | null>;
    findUnique(args: {
      where: {
        id: string;
      };
      select: {
        id: true;
        title: true;
        description: true;
        clubName: true;
        locationName: true;
        sourceTags: true;
      };
    }): Promise<{
      id: string;
      title: string;
      description: string;
      clubName: string;
      locationName: string;
      sourceTags: string[];
    } | null>;
    update(args: {
      where: { id: string };
      data: { classificationStatus: "classified" | "fallback" };
    }): Promise<unknown>;
  };
}

interface ClassificationWriteTransaction {
  eventClassification: {
    upsert(args: {
      where: { eventId: string };
      create: {
        eventId: string;
        promptVersion: string;
        model: string;
        primaryTag: Classification["primaryTag"];
        tags: Classification["tags"];
        vibes: Classification["vibes"];
        audiences: Classification["audiences"];
        format: Classification["format"];
        confidence: Classification["confidence"];
        rationale: Classification["rationale"];
      };
      update: {
        promptVersion: string;
        model: string;
        primaryTag: Classification["primaryTag"];
        tags: Classification["tags"];
        vibes: Classification["vibes"];
        audiences: Classification["audiences"];
        format: Classification["format"];
        confidence: Classification["confidence"];
        rationale: Classification["rationale"];
      };
    }): Promise<unknown>;
  };
  event: {
    update(args: {
      where: { id: string };
      data: { classificationStatus: "classified" | "fallback" };
    }): Promise<unknown>;
  };
}

interface ClassificationWriteClient {
  $transaction<T>(
    operation: (transaction: ClassificationWriteTransaction) => Promise<T> | T,
  ): Promise<T>;
}

export function createPrismaClassificationRepository(
  client: ClassificationReadClient & ClassificationWriteClient,
): ClassificationRepository {
  return {
    async getClassificationCandidate(eventId, options) {
      const select = {
        id: true,
        title: true,
        description: true,
        clubName: true,
        locationName: true,
        sourceTags: true,
      } as const;
      const record = options?.includeClassified
        ? await client.event.findUnique({
            where: { id: eventId },
            select,
          })
        : await client.event.findFirst({
            where: {
              id: eventId,
              classificationStatus: {
                in: ["pending", "retry"],
              },
            },
            select,
          });

      return record
        ? {
            eventId: record.id,
            title: record.title,
            description: record.description,
            clubName: record.clubName,
            locationName: record.locationName,
            sourceTags: record.sourceTags,
          }
        : null;
    },

    async saveClassification(eventId, input) {
      await client.$transaction(async (transaction) => {
        await transaction.eventClassification.upsert({
          where: { eventId },
          create: {
            eventId,
            promptVersion: input.promptVersion,
            model: input.model,
            primaryTag: input.classification.primaryTag,
            tags: input.classification.tags,
            vibes: input.classification.vibes,
            audiences: input.classification.audiences,
            format: input.classification.format,
            confidence: input.classification.confidence,
            rationale: input.classification.rationale,
          },
          update: {
            promptVersion: input.promptVersion,
            model: input.model,
            primaryTag: input.classification.primaryTag,
            tags: input.classification.tags,
            vibes: input.classification.vibes,
            audiences: input.classification.audiences,
            format: input.classification.format,
            confidence: input.classification.confidence,
            rationale: input.classification.rationale,
          },
        });

        await transaction.event.update({
          where: { id: eventId },
          data: { classificationStatus: input.status },
        });
      });
    },
  };
}

export type { ClassificationCandidate, ClassificationRepository };
export type { Classification } from "./schema";

export function createPrismaClassificationRepositoryForClient(
  client: PrismaClient,
): ClassificationRepository {
  return createPrismaClassificationRepository(client as never);
}
