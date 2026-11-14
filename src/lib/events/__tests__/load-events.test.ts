import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { loadFreshEvents } from "../load-events";
describe("loadFreshEvents", () => {
  it("reads persisted events exactly once and never runs ingestion", async () => {
    const getEvents = vi.fn(async () => []);
    const refresh = vi.fn();
    await expect(loadFreshEvents({ getEvents, refresh })).resolves.toEqual([]);
    expect(getEvents).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });
  it("propagates database failures without starting paid collection", async () => {
    const refresh = vi.fn();
    await expect(loadFreshEvents({ getEvents: async () => { throw new Error("database-down"); }, refresh })).rejects.toThrow("database-down");
    expect(refresh).not.toHaveBeenCalled();
  });
});
