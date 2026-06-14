import { describe, expect, it } from "vitest";

import {
  FALLBACK_PRIMARY_TAG_PRIORITY,
  createFallbackClassification,
} from "../fallback";
import { classificationSchema } from "../schema";

describe("createFallbackClassification", () => {
  it("always returns a valid classification", () => {
    const fallback = createFallbackClassification({
      title: "Startup pitch and networking night",
      description: "Founders present ideas with live music.",
      clubName: "Velocity",
      locationName: "SLC",
      sourceTags: ["music", "not-supported"],
    });

    expect(classificationSchema.parse(fallback)).toEqual(fallback);
  });

  it("merges valid source tags with existing keyword-derived tags", () => {
    const fallback = createFallbackClassification({
      title: "Developer workshop",
      description: "A hands-on coding session.",
      clubName: "Tech Club",
      locationName: "DC",
      sourceTags: ["free-food", "free-food", "not-supported"],
    });

    expect(fallback.tags).toEqual(["hack-dev", "free-food"]);
    expect(fallback.vibes).toContain("focused");
    expect(fallback.audiences).toContain("technical");
    expect(fallback.format).toBe("workshop");
  });

  it("uses the documented priority for a stable primary tag", () => {
    expect(FALLBACK_PRIMARY_TAG_PRIORITY).toEqual([
      "hack-dev",
      "career-coop",
      "startup-pitch",
      "music",
      "reels",
      "free-food",
      "chill-social",
    ]);

    const event = {
      title: "Hackathon",
      description: "Build something.",
      clubName: "Builders",
      locationName: "E7",
    };

    const first = createFallbackClassification({
      ...event,
      sourceTags: ["chill-social", "music"],
    });
    const second = createFallbackClassification({
      ...event,
      sourceTags: ["music", "chill-social"],
    });

    expect(first.primaryTag).toBe("hack-dev");
    expect(second).toEqual(first);
  });

  it("uses chill-social at low confidence when no tags can be derived", () => {
    const fallback = createFallbackClassification({
      title: "Campus Gathering",
      description: "More details coming soon.",
      clubName: "Campus Group",
      locationName: "SLC",
      sourceTags: [],
    });

    expect(fallback).toMatchObject({
      primaryTag: "chill-social",
      tags: ["chill-social"],
      vibes: ["social", "relaxed"],
      audiences: ["all-students"],
      format: "social",
      confidence: 0.2,
    });
    expect(classificationSchema.safeParse(fallback).success).toBe(true);
  });
});
