export const socialSubTags = [
  "games",
  "hangout",
  "arts-crafts",
  "outdoors",
  "nightlife",
  "wellness",
  "movie-tv",
] as const;

export type SocialSubTag = (typeof socialSubTags)[number];

export const socialSubTagLabels = {
  games: "Games",
  hangout: "Hangout",
  "arts-crafts": "Arts + Crafts",
  outdoors: "Outdoors",
  nightlife: "Nightlife",
  wellness: "Wellness",
  "movie-tv": "Movie + TV",
} as const satisfies Record<SocialSubTag, string>;

export function isSocialSubTag(tag: string): tag is SocialSubTag {
  return (socialSubTags as readonly string[]).includes(tag);
}

const topLevelTagLabels: Record<string, string> = {
  "free-food": "Free Food",
  "hack-dev": "Hack + Dev",
  "career-coop": "Career + Co-op",
  general: "General",
  "chill-social": "Chill + Social",
  music: "Music",
  reels: "Reels + Media",
  "startup-pitch": "Startup + Pitch",
};

export function formatEventTagLabel(tag: string): string {
  if (isSocialSubTag(tag)) {
    return socialSubTagLabels[tag];
  }

  return topLevelTagLabels[tag] ?? tag;
}

export function getEventSocialSubTag(
  tags: readonly string[],
): SocialSubTag | undefined {
  return tags.find((tag): tag is SocialSubTag => isSocialSubTag(tag));
}
