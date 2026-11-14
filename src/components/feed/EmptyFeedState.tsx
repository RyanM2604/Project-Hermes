import Link from "next/link";
import { eventFeedHref, type EventPeriod } from "@/lib/events/feed-period";

export function EmptyFeedState({ period = "upcoming" }: { period?: EventPeriod }) {
  return (
    <div className="hm-empty">
      <h3>{period === "past" ? "No past events here yet." : "Nothing here yet."}</h3>
      <p>{period === "past" ? "Try another category to explore earlier events." : "Try another category, or check back when more campus events are posted."}</p>
      <Link href={eventFeedHref(period)} className="hermes-button hermes-button-gold">
        See all events
      </Link>
    </div>
  );
}
