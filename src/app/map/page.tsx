import { Clock3, MapPinned, Navigation } from "lucide-react";

import { ComingSoonPage } from "@/components/layout/ComingSoonPage";

export default function MapPage() {
  return (
    <ComingSoonPage
      accent="cyan"
      eyebrow="Campus map is coming soon"
      title="See what is happening around you."
      description="Discover nearby events, understand where they are happening, and find the quickest route from where you already are on campus."
      visual="map"
      highlights={[
        {
          icon: MapPinned,
          title: "Nearby events",
          description: "See worthwhile plans close to your current building.",
        },
        {
          icon: Navigation,
          title: "Campus routes",
          description: "Get clear directions between unfamiliar buildings.",
        },
        {
          icon: Clock3,
          title: "Happening now",
          description: "Spot events you can still make before they end.",
        },
      ]}
    />
  );
}
