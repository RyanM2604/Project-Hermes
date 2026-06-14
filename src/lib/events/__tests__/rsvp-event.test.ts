import { describe, expect, it, vi } from "vitest";

import { handleRsvpEvent, type RsvpEventRepository } from "../rsvp-event";

const routeMocks = vi.hoisted(() => ({
  eventExists: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/events/repository", () => ({
  eventExists: routeMocks.eventExists,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: routeMocks.getUser },
    from: routeMocks.from,
  }),
}));

const eventId = "event-mathsoc-pizza-night";
const user = { id: "user-123" };
const eventExists = async (candidateEventId: string) =>
  candidateEventId === eventId || candidateEventId === "event-live";

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
      eventExists,
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
      eventExists,
      getUser: async () => user,
      repository,
    });

    expect(result).toEqual({ body: { status: "interested" }, status: 200 });
  });

  it("sets a going RSVP", async () => {
    const { repository, rsvps } = createRepository();

    const result = await handleRsvpEvent({
      eventId,
      eventExists,
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
      eventExists,
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
      eventExists,
      getUser: async () => user,
      repository,
      status: "cancelled",
    });

    expect(result).toEqual({ body: { status: "cancelled" }, status: 200 });
    expect(rsvps.get(`${user.id}:${eventId}`)).toBe("cancelled");
  });

  it("accepts a live event ID supplied by the event repository", async () => {
    const { repository } = createRepository();

    const result = await handleRsvpEvent({
      eventId: "event-live",
      eventExists,
      getUser: async () => user,
      repository,
      status: "going",
    });

    expect(result).toEqual({ body: { status: "going" }, status: 200 });
  });

  it("rejects event IDs missing from the event repository", async () => {
    const { repository, rsvps } = createRepository();

    const result = await handleRsvpEvent({
      eventId: "missing-event",
      eventExists,
      getUser: async () => user,
      repository,
      status: "going",
    });

    expect(result).toEqual({ body: { error: "Event not found" }, status: 404 });
    expect(rsvps.size).toBe(0);
  });

  it("propagates event repository outages before writing", async () => {
    const { repository, rsvps } = createRepository();
    const outage = new Error("event database unavailable");
    const failingEventExists = vi.fn(async () => {
      throw outage;
    });

    await expect(
      handleRsvpEvent({
        eventId,
        eventExists: failingEventExists,
        getUser: async () => user,
        repository,
        status: "going",
      }),
    ).rejects.toBe(outage);
    expect(rsvps.size).toBe(0);
  });

  it("returns a route-level service error without writing during an event repository outage", async () => {
    const outage = Object.assign(
      new Error("database unavailable at db.internal.example:5432"),
      { code: "P1001" },
    );
    routeMocks.eventExists.mockRejectedValueOnce(outage);
    routeMocks.getUser.mockResolvedValueOnce({ data: { user } });
    const { PUT } = await import("@/app/api/events/[id]/rsvp/route");

    const response = await PUT(
      new Request("https://example.com", {
        body: JSON.stringify({ status: "going" }),
        method: "PUT",
      }),
      { params: Promise.resolve({ id: eventId }) },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to update RSVP",
    });
    expect(routeMocks.from).not.toHaveBeenCalled();
  });
});
