import type { SocialSubTag } from "@/lib/events/social-tags";

export type EventTag =
  | "free-food"
  | "hack-dev"
  | "career-coop"
  | "general"
  | "chill-social"
  | SocialSubTag
  | "music"
  | "reels"
  | "startup-pitch";

export type BuildingCode =
  | "AL"
  | "DC"
  | "E5"
  | "EC5"
  | "E7"
  | "FED"
  | "MC"
  | "PAC"
  | "QNC"
  | "SCH"
  | "SLC"
  | "TC";

export interface HermesEvent {
  id: string;
  title: string;
  description: string;
  clubName: string;
  startTime: string;
  endTime: string;
  locationName: string;
  buildingCode?: BuildingCode;
  tags: EventTag[];
  primaryTag?: EventTag;
  imageUrl?: string;
  endTimeEstimated?: boolean;
  sourceUrl: string;
  isFreeFood: boolean;
  createdAt: string;
}
