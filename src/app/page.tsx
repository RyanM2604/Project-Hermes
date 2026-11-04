import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { HermesMotion } from "@/components/motion/HermesMotion";

const examples = [
  { day: "Today", category: "Free food", title: "Pizza in the SLC", detail: "Time, location, organiser, and source on the live card" },
  { day: "Tonight", category: "Go out", title: "An open mic after class", detail: "Check the details before you head over" },
  { day: "This week", category: "Something new", title: "A workshop worth saving", detail: "Find the original post and make a plan" },
];

export default function HomePage() {
  return (
    <HermesMotion variant="home">
      <main className="hermes-home">
        <section className="home-hero">
          <div className="home-hero-inner hermes-container">
            <div className="home-hero-copy">
              <h1 data-motion="home-title">There&apos;s always something on. <em>Now you&apos;ll know in time.</em></h1>
              <p data-motion="home-copy">Hermes gathers Waterloo events, free food, and club nights into one feed. See when, where, who&apos;s behind it, and the original source before you go.</p>
              <div className="home-hero-actions" data-motion="home-actions">
                <Link href="/events" className="hermes-button hermes-button-gold">See what&apos;s on <ArrowUpRight size={18} aria-hidden="true" /></Link>
                <span>No account needed</span>
              </div>
            </div>
            <div className="home-feed-preview" data-motion="home-cover" aria-label="Examples of events you might find in the feed">
              <div className="home-feed-preview-head"><span>In the feed</span><span>Examples</span></div>
              <div className="home-feed-preview-card"><span>Free food · Today</span><strong>Pizza in the SLC</strong><small>Time, place, organiser, original source</small></div>
              <div className="home-feed-preview-card"><span>Social · Tonight</span><strong>Open mic after class</strong><small>Details before you head over</small></div>
              <div className="home-feed-preview-card"><span>Workshop · This week</span><strong>Something new to try</strong><small>A plan worth saving</small></div>
              <p>Illustrative listings. Open the feed for current events.</p>
            </div>
          </div>
          <div className="home-hero-foot hermes-container"><span>Made for the moments between classes.</span><span>Keep scrolling <span aria-hidden="true">↓</span></span></div>
        </section>

        <section className="home-intro hermes-container" id="features" data-motion="intro-section">
          <div data-motion="intro-item"><h2>Everything happening, finally in one place.</h2></div>
          <div className="home-intro-copy" data-motion="intro-item"><p>Club events are scattered across Instagram, posters, and group chats. Hermes brings Waterloo listings into one feed you can browse by category and what&apos;s starting soon.</p><Link href="/events" className="hermes-text-link">See what&apos;s on <ArrowUpRight size={17} aria-hidden="true" /></Link></div>
        </section>

        <section className="home-discovery hermes-container" aria-labelledby="moments-heading" data-motion="preview-section">
          <div className="home-section-head"><h2 id="moments-heading">Free food, nights out, and something new.</h2><p>Today, tonight, and later this week.</p></div>
          <div className="home-preview-grid">
            {examples.map((item, index) => <article key={item.day} className={`home-preview home-preview-${index + 1}`} data-motion="preview-tile"><span className="home-preview-top"><span>{item.day}</span><span>{item.category}</span></span><span className="home-preview-content"><small>{item.category}</small><strong>{item.title}</strong><span>{item.detail}</span></span></article>)}
          </div>
        </section>

        <section className="home-trust hermes-container" data-motion="method-section">
          <div data-motion="method-item"><h2>Every event shows where it came from.</h2></div>
          <div data-motion="method-item"><p>Each live card shows the organiser, time, location, and a link to the original source. Check the details before you cross campus.</p></div>
        </section>

        <section className="home-method" data-motion="join-section">
          <div className="hermes-container home-method-inner">
            <div data-motion="join-item"><h2>Bored to there in three moves.</h2></div>
            <div data-motion="join-item"><ol><li>See what&apos;s starting soon.</li><li>Browse the categories that interest you.</li><li>Open a card for the details and original source.</li></ol><Link href="/events" className="hermes-button hermes-button-outline">See what&apos;s on <ArrowUpRight size={18} aria-hidden="true" /></Link></div>
          </div>
        </section>

        <section className="home-join hermes-container">
          <div><h2>Go find <em>your thing.</em></h2><p>Browsing needs no account. Use your Waterloo email to save events or RSVP when you&apos;re ready.</p></div>
          <div className="home-join-actions"><Link href="/events" className="hermes-button hermes-button-gold">See what&apos;s on <ArrowUpRight size={18} aria-hidden="true" /></Link><Link href="/login" className="hermes-text-link">Sign in with your Waterloo email</Link></div>
        </section>
        <footer className="home-footer hermes-container"><span>Built by Waterloo students, for Waterloo students.</span><span>© 2026 Hermes · Made for the moments between classes.</span></footer>
      </main>
    </HermesMotion>
  );
}
