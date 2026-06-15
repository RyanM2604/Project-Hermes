import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { Classification } from "../schema";
import { createPrismaClassificationRepository } from "../prisma-repository";

const classification: Classification = {
  primaryTag: "hack-dev",
  tags: ["hack-dev", "career-coop"],
  vibes: ["focused", "professional"],
  audiences: ["technical", "career-focused"],
  format: "workshop",
  confidence: 0.92,
  rationale: "A technical career workshop.",
};

function createClient() {
  const eventClassification = {
    upsert: vi.fn(),
  };
  const event = {
    findFirst: vi.fn(),
    update: vi.fn(),
  };
  const transaction = { eventClassification, event };
  const client = {
    event,
    $transaction: vi.fn(async (operation: (tx: typeof transaction) => unknown) =>
      operation(transaction),
    ),
  };

  return { client, event, eventClassification, transaction };
}

describe("createPrismaClassificationRepository", () => {
  it("reads only pending and retry candidates", async () => {
    const { client, event } = createClient();
    event.findFirst.mockResolvedValue({
      id: "event-a",
      title: "Technical Interview Workshop",
      description: "Practice interviews with peers.",
      clubName: "Engineering Society",
      locationName: "E5 6006",
      sourceTags: ["career-coop", "hack-dev"],
    });
    const repository = createPrismaClassificationRepository(
      client as unknown as Pick<PrismaClient, "$transaction" | "event">,
    );

    await expect(repository.getClassificationCandidate("event-a")).resolves.toEqual(
      {
        eventId: "event-a",
        title: "Technical Interview Workshop",
        description: "Practice interviews with peers.",
        clubName: "Engineering Society",
        locationName: "E5 6006",
        sourceTags: ["career-coop", "hack-dev"],
      },
    );

    expect(event.findFirst).toHaveBeenCalledWith({
      where: {
        id: "event-a",
        classificationStatus: { in: ["pending", "retry"] },
      },
      select: {
        id: true,
        title: true,
        description: true,
        clubName: true,
        locationName: true,
        sourceTags: true,
      },
    });
  });

  it("persists classification and status in one transaction", async () => {
    const { client, event, eventClassification } = createClient();
    const repository = createPrismaClassificationRepository(
      client as unknown as Pick<PrismaClient, "$transaction" | "event">,
    );

    await repository.saveClassification("event-a", {
      classification,
      model: "gpt-5.1-mini",
      promptVersion: "2026-06-14.v1",
      status: "fallback",
    });

    expect(client.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(eventClassification.upsert).toHaveBeenCalledWith({
      where: { eventId: "event-a" },
      create: {
        eventId: "event-a",
        promptVersion: "2026-06-14.v1",
        model: "gpt-5.1-mini",
        primaryTag: "hack-dev",
        tags: ["hack-dev", "career-coop"],
        vibes: ["focused", "professional"],
        audiences: ["technical", "career-focused"],
        format: "workshop",
        confidence: 0.92,
        rationale: "A technical career workshop.",
      },
      update: {
        promptVersion: "2026-06-14.v1",
        model: "gpt-5.1-mini",
        primaryTag: "hack-dev",
        tags: ["hack-dev", "career-coop"],
        vibes: ["focused", "professional"],
        audiences: ["technical", "career-focused"],
        format: "workshop",
        confidence: 0.92,
        rationale: "A technical career workshop.",
      },
    });
    expect(event.update).toHaveBeenCalledWith({
      where: { id: "event-a" },
      data: { classificationStatus: "fallback" },
    });
  });
});
