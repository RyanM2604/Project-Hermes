import { describe, expect, it, vi } from "vitest";

import type { ClassificationCandidate } from "../classify-events";
import { classifyEvents } from "../classify-events";

const candidate: ClassificationCandidate = {
  eventId: "event-a",
  title: "Technical Interview Workshop",
  description: "Practice interviews with peers.",
  clubName: "Engineering Society",
  locationName: "E5 6006",
  sourceTags: ["career-coop", "hack-dev"],
};

const weakCareerCandidate: ClassificationCandidate = {
  eventId: "event-b",
  title: "Toronto Blue Jays vs Texas Rangers Viewing",
  description: "Catch the away game with friends.",
  clubName: "Campus Social Club",
  locationName: "Bingemans",
  sourceTags: ["career-coop"],
};

const weakSocialCandidate: ClassificationCandidate = {
  eventId: "event-c",
  title: "Campus Hangout",
  description: "Drop by for a casual meetup.",
  clubName: "Campus Social Club",
  locationName: "SLC",
  sourceTags: [],
};

function createRepository() {
  return {
    getClassificationCandidate: vi.fn(),
    saveClassification: vi.fn(),
  };
}

function createClassifier() {
  return {
    classify: vi.fn(),
  };
}

describe("classifyEvents", () => {
  it("persists valid provider classification for pending events", async () => {
    const repository = createRepository();
    const classifier = createClassifier();

    repository.getClassificationCandidate.mockResolvedValue(candidate);
    classifier.classify.mockResolvedValue({
      model: "gpt-5.1-mini",
      status: "classified",
      classification: {
        primaryTag: "hack-dev",
        tags: ["hack-dev", "career-coop"],
        vibes: ["focused", "professional"],
        audiences: ["technical", "career-focused"],
        format: "workshop",
        confidence: 0.93,
        rationale: "A technical career workshop.",
      },
    });

    const result = await classifyEvents({
      repository: repository as never,
      classifier: classifier as never,
      eventIds: ["event-a"],
    });

    expect(repository.saveClassification).toHaveBeenCalledWith(
      "event-a",
      expect.objectContaining({
        model: "gpt-5.1-mini",
        status: "classified",
      }),
    );
    expect(result.classifiedCount).toBe(1);
  });

  it("persists fallback classification when provider is unavailable", async () => {
    const repository = createRepository();
    const classifier = createClassifier();

    repository.getClassificationCandidate.mockResolvedValue(candidate);
    classifier.classify.mockResolvedValue({
      model: "gpt-5.1-mini",
      status: "unavailable",
      code: "missing-api-key",
    });

    const result = await classifyEvents({
      repository: repository as never,
      classifier: classifier as never,
      eventIds: ["event-a"],
    });

    expect(repository.saveClassification).toHaveBeenCalledWith(
      "event-a",
      expect.objectContaining({
        model: "gpt-5.1-mini",
        status: "fallback",
      }),
    );
    expect(result.fallbackCount).toBe(1);
  });

  it("skips events that are no longer pending", async () => {
    const repository = createRepository();
    const classifier = createClassifier();

    repository.getClassificationCandidate.mockResolvedValue(null);

    const result = await classifyEvents({
      repository: repository as never,
      classifier: classifier as never,
      eventIds: ["event-a"],
    });

    expect(classifier.classify).not.toHaveBeenCalled();
    expect(result.skippedCount).toBe(1);
  });

  it("falls back when a provider classification uses weak career wording", async () => {
    const repository = createRepository();
    const classifier = createClassifier();

    repository.getClassificationCandidate.mockResolvedValue(weakCareerCandidate);
    classifier.classify.mockResolvedValue({
      model: "gpt-5.1-mini",
      status: "classified",
      classification: {
        primaryTag: "career-coop",
        tags: ["career-coop"],
        vibes: ["professional"],
        audiences: ["career-focused"],
        format: "networking",
        confidence: 0.95,
        rationale: "Looks like a career event.",
      },
    });

    const result = await classifyEvents({
      repository: repository as never,
      classifier: classifier as never,
      eventIds: ["event-b"],
    });

    expect(repository.saveClassification).toHaveBeenCalledWith(
      "event-b",
      expect.objectContaining({
        model: "gpt-5.1-mini",
        status: "fallback",
        classification: expect.objectContaining({
          primaryTag: "chill-social",
        }),
      }),
    );
    expect(result.fallbackCount).toBe(1);
  });

  it("keeps weak social events in chill-social without forcing a sub-tag", async () => {
    const repository = createRepository();
    const classifier = createClassifier();

    repository.getClassificationCandidate.mockResolvedValue(weakSocialCandidate);
    classifier.classify.mockResolvedValue({
      model: "gpt-5.1-mini",
      status: "classified",
      classification: {
        primaryTag: "chill-social",
        tags: ["chill-social"],
        vibes: ["social"],
        audiences: ["all-students"],
        format: "social",
        confidence: 0.62,
        rationale: "Casual campus hangout.",
      },
    });

    const result = await classifyEvents({
      repository: repository as never,
      classifier: classifier as never,
      eventIds: ["event-c"],
    });

    expect(repository.saveClassification).toHaveBeenCalledWith(
      "event-c",
      expect.objectContaining({
        status: "classified",
        classification: expect.objectContaining({
          primaryTag: "chill-social",
          tags: ["chill-social"],
        }),
      }),
    );
    expect(result.classifiedCount).toBe(1);
  });
});
