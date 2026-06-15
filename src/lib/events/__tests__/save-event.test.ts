import { describe, expect, it, vi } from "vitest";

import {
  handleSaveEvent,
  type SavedEventRepository,
} from "../save-event";

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

const eventId = "event-source-backed";
const user = { id: "user-123" };
const eventExists = async (candidateEventId: string) =>
  candidateEventId === eventId || candidateEventId === "event-live";

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
      eventExists,
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
      eventExists,
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
      eventExists,
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
      eventExists,
      getUser: async () => user,
      repository,
    };

    await handleSaveEvent(options);
    const result = await handleSaveEvent(options);

    expect(result).toEqual({ body: { saved: true }, status: 200 });
    expect(saved.size).toBe(1);
  });

  it("accepts a live event ID supplied by the event repository", async () => {
    const { repository } = createRepository();

    const result = await handleSaveEvent({
      action: "save",
      eventId: "event-live",
      eventExists,
      getUser: async () => user,
      repository,
    });

    expect(result).toEqual({ body: { saved: true }, status: 200 });
  });

  it("rejects event IDs missing from the event repository", async () => {
    const { repository, saved } = createRepository();

    const result = await handleSaveEvent({
      action: "save",
      eventId: "missing-event",
      eventExists,
      getUser: async () => user,
      repository,
    });

    expect(result).toEqual({ body: { error: "Event not found" }, status: 404 });
    expect(saved.size).toBe(0);
  });

  it("propagates event repository outages before writing", async () => {
    const { repository, saved } = createRepository();
    const outage = new Error("event database unavailable");
    const failingEventExists = vi.fn(async () => {
      throw outage;
    });

    await expect(
      handleSaveEvent({
        action: "save",
        eventId,
        eventExists: failingEventExists,
        getUser: async () => user,
        repository,
      }),
    ).rejects.toBe(outage);
    expect(saved.size).toBe(0);
  });

  it("returns a route-level service error without writing during an event repository outage", async () => {
    const outage = Object.assign(
      new Error("database unavailable at db.internal.example:5432"),
      { code: "P1001" },
    );
    routeMocks.eventExists.mockRejectedValueOnce(outage);
    routeMocks.getUser.mockResolvedValueOnce({ data: { user } });
    const { PUT } = await import("@/app/api/events/[id]/save/route");

    const response = await PUT(new Request("https://example.com"), {
      params: Promise.resolve({ id: eventId }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to update saved event",
    });
    expect(routeMocks.from).not.toHaveBeenCalled();
  });
});
