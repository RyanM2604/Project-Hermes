export type EventTag =
  | "free-food"
  | "hack-dev"
  | "career-coop"
  | "chill-social"
  | "music"
  | "reels"
  | "startup-pitch";

export type BuildingCode =
  | "AL"
  | "DC"
  | "E5"
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
  sourceUrl?: string;
  isFreeFood: boolean;
  createdAt: string;
}
