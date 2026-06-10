import { describe, expect, it } from "vitest";

import {
  handleSaveEvent,
  type SavedEventRepository,
} from "../save-event";

const eventId = "event-mathsoc-pizza-night";
const user = { id: "user-123" };

function createRepository() {
  const saved = new Set<string>();

  const repository: SavedEventRepository = {
    async isSaved(userId, candidateEventId) {
      return saved.has(`${userId}:${candidateEventId}`);
    },
    async save(userId, candidateEventId) {
      saved.add(`${userId}:${candidateEventId}`);
    },
    async unsave(userId, candidateEventId) {
      saved.delete(`${userId}:${candidateEventId}`);
    },
  };

  return { repository, saved };
}

describe("save event", () => {
  it("rejects unauthenticated requests", async () => {
    const { repository } = createRepository();

    const result = await handleSaveEvent({
      action: "save",
      eventId,
      getUser: async () => null,
      repository,
    });

    expect(result).toEqual({
      body: { error: "Authentication required" },
      status: 401,
    });
  });

  it("saves an event for the authenticated user", async () => {
    const { repository, saved } = createRepository();

    const result = await handleSaveEvent({
      action: "save",
      eventId,
      getUser: async () => user,
      repository,
    });

    expect(result).toEqual({ body: { saved: true }, status: 200 });
    expect(saved.has(`${user.id}:${eventId}`)).toBe(true);
  });

  it("unsaves an event for the authenticated user", async () => {
    const { repository, saved } = createRepository();
    saved.add(`${user.id}:${eventId}`);

    const result = await handleSaveEvent({
      action: "unsave",
      eventId,
      getUser: async () => user,
      repository,
    });

    expect(result).toEqual({ body: { saved: false }, status: 200 });
    expect(saved.has(`${user.id}:${eventId}`)).toBe(false);
  });

  it("keeps duplicate saves idempotent", async () => {
    const { repository, saved } = createRepository();
    const options = {
      action: "save" as const,
      eventId,
      getUser: async () => user,
      repository,
    };

    await handleSaveEvent(options);
    const result = await handleSaveEvent(options);

    expect(result).toEqual({ body: { saved: true }, status: 200 });
    expect(saved.size).toBe(1);
  });
});
