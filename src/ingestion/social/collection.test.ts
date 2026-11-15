import { describe, expect, it } from "vitest";
import { collectionWindow } from "./collection";
const now = new Date("2026-11-15T12:00:00Z");
describe("collection windows", () => {
  it("bootstraps a bounded week, then overlaps the last successful observation by six hours", () => {
    expect(collectionWindow(null, null, now).since.toISOString()).toBe("2026-11-08T12:00:00.000Z");
    expect(collectionWindow(new Date("2026-11-14T12:00:00Z"), new Date("2026-11-14T12:00:00Z"), now)).toEqual({ review: false, since: new Date("2026-11-14T06:00:00Z") });
    expect(collectionWindow(new Date("2026-11-14T12:00:00Z"), new Date("2026-11-01T12:00:00Z"), now)).toEqual({ review: true, since: new Date("2026-11-08T12:00:00Z") });
    expect(collectionWindow(new Date("2026-11-01T12:00:00Z"), null, now).since.toISOString()).toBe("2026-11-01T06:00:00.000Z");
  });
});
