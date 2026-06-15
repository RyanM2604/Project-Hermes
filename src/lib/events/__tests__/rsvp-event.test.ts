import { describe, expect, it } from "vitest";

import { handleRsvpEvent, type RsvpEventRepository } from "../rsvp-event";

const eventId = "event-mathsoc-pizza-night";
const user = { id: "user-123" };

function createRepository() {
  const rsvps = new Map<string, "going" | "interested" | "cancelled">();

  const repository: RsvpEventRepository = {
    async getStatus(userId, candidateEventId) {
      return rsvps.get(`${userId}:${candidateEventId}`) ?? null;
    },
    async setStatus(userId, candidateEventId, status) {
      rsvps.set(`${userId}:${candidateEventId}`, status);
    },
  };

  return { repository, rsvps };
}

describe("rsvp event", () => {
  it("rejects unauthenticated requests", async () => {
    const { repository } = createRepository();

    const result = await handleRsvpEvent({
      eventId,
      getUser: async () => null,
      repository,
      status: "going",
    });

    expect(result).toEqual({
      body: { error: "Authentication required" },
      status: 401,
    });
  });

  it("returns the current RSVP status", async () => {
    const { repository, rsvps } = createRepository();
    rsvps.set(`${user.id}:${eventId}`, "interested");

    const result = await handleRsvpEvent({
      eventId,
      getUser: async () => user,
      repository,
    });

    expect(result).toEqual({ body: { status: "interested" }, status: 200 });
  });

  it("sets a going RSVP", async () => {
    const { repository, rsvps } = createRepository();

    const result = await handleRsvpEvent({
      eventId,
      getUser: async () => user,
      repository,
      status: "going",
    });

    expect(result).toEqual({ body: { status: "going" }, status: 200 });
    expect(rsvps.get(`${user.id}:${eventId}`)).toBe("going");
  });

  it("is idempotent when the same RSVP is set twice", async () => {
    const { repository, rsvps } = createRepository();
    const options = {
      eventId,
      getUser: async () => user,
      repository,
      status: "interested" as const,
    };

    await handleRsvpEvent(options);
    const result = await handleRsvpEvent(options);

    expect(result).toEqual({ body: { status: "interested" }, status: 200 });
    expect(rsvps.size).toBe(1);
  });

  it("accepts cancelled as a valid status", async () => {
    const { repository, rsvps } = createRepository();

    const result = await handleRsvpEvent({
      eventId,
      getUser: async () => user,
      repository,
      status: "cancelled",
    });

    expect(result).toEqual({ body: { status: "cancelled" }, status: 200 });
    expect(rsvps.get(`${user.id}:${eventId}`)).toBe("cancelled");
  });
});
