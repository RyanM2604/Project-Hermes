import Link from "next/link";

export function EmptyFeedState() {
  return (
    <div className="hm-empty">
      <h3>Nothing here yet.</h3>
      <p>Try another category, or check back when more campus events are posted.</p>
      <Link href="/events#event-feed" className="hermes-button hermes-button-gold">
        See all events
      </Link>
    </div>
  );
}
