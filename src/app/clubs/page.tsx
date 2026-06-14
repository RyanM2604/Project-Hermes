import { Compass, HeartHandshake, UsersRound } from "lucide-react";

import { ComingSoonPage } from "@/components/layout/ComingSoonPage";

export default function ClubsPage() {
  return (
    <ComingSoonPage
      accent="violet"
      eyebrow="Clubs are coming soon"
      title="Find the people building your campus."
      description="Explore Waterloo clubs by what they actually do, see what is active right now, and find your next community without digging through scattered directories."
      visual="clubs"
      highlights={[
        {
          icon: Compass,
          title: "Discover",
          description: "Browse clubs by interests, energy, and activity.",
        },
        {
          icon: UsersRound,
          title: "See activity",
          description: "Know which communities are active this term.",
        },
        {
          icon: HeartHandshake,
          title: "Join easily",
          description: "Move from discovery to your first event quickly.",
        },
      ]}
    />
  );
}
