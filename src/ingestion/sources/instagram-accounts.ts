import sources from "./instagram-accounts.json";

export interface InstagramAccount {
  clubName: string;
  instagramHandle: string;
  profileUrl: string;
  active: boolean;
  priority?: number;
}

// Keep this list in the repository so scheduled ingestion uses the same sources.
export const instagramAccounts: readonly InstagramAccount[] = sources;
