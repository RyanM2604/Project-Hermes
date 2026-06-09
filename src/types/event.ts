export interface EventTag {
  id: string;
  name: string;
  slug: string;
}

export interface Venue {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isVerified: boolean;
}

export interface HermesEvent {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt?: string;
  club?: Club;
  venue?: Venue;
  tags: EventTag[];
  sourceUrl?: string;
}
