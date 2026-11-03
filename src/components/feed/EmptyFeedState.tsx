import Link from "next/link";
export function EmptyFeedState() { return <div className="hm-empty"><h3>No events in this corner yet.</h3><p>Try another category, or come back soon. New events are added throughout the week.</p><Link href="/events#event-feed" className="hermes-button hermes-button-gold">See all events</Link></div>; }
