import { describe, expect, it, vi } from "vitest";

import {
  logInteraction,
  type InteractionRepository,
} from "../log-interaction";

const validPayload = {
  action: "open",
  eventId: "event-mathsoc-pizza-night",
  metadata: { source: "event_feed" },
} as const;

function createRepository() {
  const create = vi.fn<InteractionRepository["create"]>();

  return {
    create,
    repository: { create } satisfies InteractionRepository,
  };
}

describe("log interaction", () => {
  it("logs a valid interaction for an authenticated user", async () => {
    const { create, repository } = createRepository();

    const result = await logInteraction({
      getUser: async () => ({ id: "user-123" }),
      payload: validPayload,
      repository,
    });

    expect(result).toEqual({ status: 204 });
    expect(create).toHaveBeenCalledWith({
      action: "open",
      anonymousSessionId: null,
      eventId: "event-mathsoc-pizza-night",
      metadata: { source: "event_feed" },
      userId: "user-123",
    });
  });

  it("logs a valid anonymous interaction", async () => {
    const { create, repository } = createRepository();

    const result = await logInteraction({
      getUser: async () => null,
      payload: {
        ...validPayload,
        anonymousSessionId: "session_123",
      },
      repository,
    });

    expect(result).toEqual({ status: 204 });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        anonymousSessionId: "session_123",
        userId: null,
      }),
    );
  });

  it("rejects invalid interaction actions", async () => {
    const { create, repository } = createRepository();

    const result = await logInteraction({
      getUser: async () => ({ id: "user-123" }),
      payload: { ...validPayload, action: "click" },
      repository,
    });

    expect(result).toEqual({
      body: { error: "Invalid interaction payload" },
      status: 400,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("requires an anonymous session for logged-out visitors", async () => {
    const { create, repository } = createRepository();

    const result = await logInteraction({
      getUser: async () => null,
      payload: validPayload,
      repository,
    });

    expect(result).toEqual({
      body: { error: "Anonymous session ID is required" },
      status: 400,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects metadata containing a raw email", async () => {
    const { create, repository } = createRepository();

    const result = await logInteraction({
      getUser: async () => ({ id: "user-123" }),
      payload: {
        ...validPayload,
        metadata: { note: "Contact student@uwaterloo.ca after the event" },
      },
      repository,
    });

    expect(result.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns 204 when non-critical persistence fails", async () => {
    const { create, repository } = createRepository();
    create.mockRejectedValue(new Error("database unavailable"));

    const result = await logInteraction({
      getUser: async () => ({ id: "user-123" }),
      payload: validPayload,
      repository,
    });

    expect(result).toEqual({ status: 204 });
  });

  it("returns 204 when auth lookup fails", async () => {
    const { create, repository } = createRepository();

    const result = await logInteraction({
      getUser: async () => {
        throw new Error("auth unavailable");
      },
      payload: validPayload,
      repository,
    });

    expect(result).toEqual({ status: 204 });
    expect(create).not.toHaveBeenCalled();
  });
});
