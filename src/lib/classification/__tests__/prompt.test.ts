import { describe, expect, it } from "vitest";

import {
  CLASSIFICATION_PROMPT_VERSION,
  buildClassificationPrompt,
} from "../prompt";
import {
  AUDIENCES,
  EVENT_TAGS,
  FORMATS,
  VIBES,
} from "../schema";

describe("buildClassificationPrompt", () => {
  it("includes a fixed version, supported vocabulary, and public event fields", () => {
    const prompt = buildClassificationPrompt({
      title: "Technical Interview Workshop",
      description: "Practice interviews with peers.",
      clubName: "Engineering Society",
      locationName: "E5 6006",
      sourceTags: ["career-coop", "hack-dev"],
    });

    expect(prompt).toContain(CLASSIFICATION_PROMPT_VERSION);
    for (const value of [...EVENT_TAGS, ...VIBES, ...AUDIENCES, ...FORMATS]) {
      expect(prompt).toContain(value);
    }
    expect(prompt).toContain("Technical Interview Workshop");
    expect(prompt).toContain("Practice interviews with peers.");
    expect(prompt).toContain("Engineering Society");
    expect(prompt).toContain("E5 6006");
  });

  it("explicitly constrains evidence, uncertainty, source tags, and output", () => {
    const prompt = buildClassificationPrompt({
      title: "Campus Event",
      description: "Details coming soon.",
      clubName: "Campus Club",
      locationName: "SLC",
      sourceTags: ["chill-social"],
    }).toLowerCase();

    expect(prompt).toContain("only from the supplied evidence");
    expect(prompt).toContain("never invent facts");
    expect(prompt).toContain("preserve supported source tags");
    expect(prompt).toContain("confidence");
    expect(prompt).toContain("structured data only");
  });

  it("serializes only approved public fields", () => {
    const prompt = buildClassificationPrompt({
      title: "Public title",
      description: "Public description",
      clubName: "Public organizer",
      locationName: "Public location",
      sourceTags: [],
      userId: "private-user-id",
      email: "private@example.com",
      interactions: ["save", "rsvp"],
      authToken: "private-token",
    } as Parameters<typeof buildClassificationPrompt>[0] & {
      userId: string;
      email: string;
      interactions: string[];
      authToken: string;
    });

    expect(prompt).not.toContain("private-user-id");
    expect(prompt).not.toContain("private@example.com");
    expect(prompt).not.toContain("private-token");
    expect(prompt).not.toContain('"interactions"');
    expect(prompt.toLowerCase()).not.toContain("chatgpt");
    expect(prompt.toLowerCase()).not.toContain("persona");
  });
});
