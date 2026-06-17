import { describe, expect, it } from "vitest";

import {
  buildSeedRsvpRows,
  buildSeedUsers,
  getSeedRoster,
  formatDisplayName,
  formatSeedEmail,
} from "./seed-uwaterloo-users";

describe("seed uwaterloo users", () => {
  it("formats seed emails and display names", () => {
    expect(formatSeedEmail("rmaudgal", 1, "uwaterloo.ca")).toBe(
      "rmaudgal+001@uwaterloo.ca",
    );
    expect(formatDisplayName("Ryan Maudgalya Seed", 7)).toBe(
      "Ryan Maudgalya Seed 007",
    );
  });

  it("builds deterministic seed users", () => {
    const users = buildSeedUsers({
      password: "test-password",
    });

    expect(users).toHaveLength(100);
    expect(users[0]).toEqual({
      email: "apatel@uwaterloo.com",
      displayName: "Aarav Patel",
      password: "test-password",
    });
    expect(users[99]).toEqual({
      email: "rnarayanan@uwaterloo.com",
      displayName: "Rishi Narayanan",
      password: "test-password",
    });
  });

  it("exposes the seed roster with .com emails", () => {
    expect(getSeedRoster(3)).toEqual([
      {
        displayName: "Aarav Patel",
        email: "apatel@uwaterloo.com",
        password: "UWaterlooSeed!2026",
      },
      {
        displayName: "Maya Chen",
        email: "mchen@uwaterloo.com",
        password: "UWaterlooSeed!2026",
      },
      {
        displayName: "Ethan Wong",
        email: "ewong@uwaterloo.com",
        password: "UWaterlooSeed!2026",
      },
    ]);
  });

  it("builds unique RSVP rows across users and events", () => {
    const rows = buildSeedRsvpRows(
      [{ id: "user-1" }, { id: "user-2" }],
      ["event-1", "event-2"],
      {
        count: 4,
        now: () => new Date("2026-06-16T12:00:00.000Z"),
        rng: (() => {
          const values = [
            0.05, 0.05, 0.1,
            0.95, 0.05, 0.2,
            0.05, 0.95, 0.3,
            0.95, 0.95, 0.4,
          ];
          let index = 0;

          return () => {
            const value = values[index] ?? 0.5;
            index += 1;
            return value;
          };
        })(),
      },
    );

    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((row) => `${row.userId}:${row.eventId}`)).size).toBe(
      4,
    );
    expect(rows.map((row) => row.updatedAt)).toEqual([
      "2026-06-16T12:00:00.000Z",
      "2026-06-16T12:00:00.000Z",
      "2026-06-16T12:00:00.000Z",
      "2026-06-16T12:00:00.000Z",
    ]);
  });

  it("rejects requests that exceed the available unique RSVP pairs", () => {
    expect(() =>
      buildSeedRsvpRows([{ id: "user-1" }], ["event-1"], { count: 2 }),
    ).toThrow(/Cannot generate 2 unique RSVPs/);
  });
});
