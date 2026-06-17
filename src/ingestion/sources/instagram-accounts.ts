export interface InstagramAccount {
  clubName: string;
  instagramHandle: string;
  profileUrl: string;
  active: boolean;
  priority?: number;
}

export const instagramAccounts: readonly InstagramAccount[] = [
  {
    clubName: "UW Cheese Club",
    instagramHandle: "uwcheeseclub",
    profileUrl: "https://www.instagram.com/uwcheeseclub/",
    active: true,
    priority: 1,
  },
] as const;
