import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { HermesMotion } from "@/components/motion/HermesMotion";
import { HomeBackground } from "@/components/motion/HomeBackground";
import { MorphLink } from "@/components/motion/LoginMorph";
import { HeroEventPreview } from "@/components/events/HeroEventPreview";
import { loadHeroEvents } from "@/lib/events/hero-preview";

const examples = [
  { day: "Today", category: "Free food", title: "Pizza in the SLC", detail: "Time, location, organiser, and source on the live card" },
  { day: "Tonight", category: "Go out", title: "An open mic after class", detail: "Check the details before you head over" },
  { day: "This week", category: "Something new", title: "A workshop worth saving", detail: "Find the original post and make a plan" },
];

export default async function HomePage() {
  const heroEvents = await loadHeroEvents();
  return (
    <HermesMotion variant="home">
      <main className="hermes-home">
        <HomeBackground />
        <section className="home-hero">
          <div className={`home-hero-inner hermes-container${heroEvents.length ? "" : " home-hero-inner-empty"}`}>
            <div className="home-hero-copy">
              <h1><span>Life happens.</span>{" "}<span>Don&apos;t miss it.</span></h1>
              <div className="home-hero-actions">
                <MorphLink href="/signup" className="hermes-button hermes-button-gold home-cta-primary">Sign up for Hermes <ArrowUpRight size={23} aria-hidden="true" /></MorphLink>
                <MorphLink href="/events" className="hermes-button home-cta-events">Explore events <ArrowUpRight size={23} aria-hidden="true" /></MorphLink>
              </div>
            </div>
            <HeroEventPreview events={heroEvents} />
          </div>
          <div className="home-hero-divider hermes-container" aria-hidden="true" />
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

        <section className="home-campus-life hermes-container" aria-label="Between classes and after dark">
          <article className="home-life-day" data-motion="method-section">
            <div className="home-life-image" data-motion="method-item">
              <Image src="/uni-students.jpg" alt="Two students sharing a book outside" fill sizes="(max-width: 700px) 100vw, 55vw" />
            </div>
            <div className="home-life-copy" data-motion="method-item">
              <span>Between classes</span>
              <h2>An hour between classes.</h2>
              <p>A club meet-up, a guest talk, a workshop. Find something that fits before your next class.</p>
            </div>
          </article>
          <article className="home-life-night" data-motion="join-section">
            <div className="home-life-image" data-motion="join-item">
              <Image src="/party-people.jpg" alt="People dancing together at a party, with a mirrored disco helmet in the crowd" fill sizes="(max-width: 700px) 100vw, 45vw" />
            </div>
            <div className="home-life-copy" data-motion="join-item">
              <span>After dark</span>
              <h2>A night worth staying for.</h2>
              <p>Club socials, open mics, and games nights. Have an answer when the group chat asks for plans.</p>
            </div>
          </article>
        </section>

        <section className="home-join-band">
          <div className="home-join hermes-container">
          <div><h2>Go find <em>your thing.</em></h2><p>Browsing needs no account. Use your Waterloo email to save events or RSVP when you&apos;re ready.</p></div>
          <div className="home-join-actions"><Link href="/events" className="hermes-button hermes-button-gold">See what&apos;s on <ArrowUpRight size={18} aria-hidden="true" /></Link><Link href="/login" className="hermes-text-link">Sign in with your Waterloo email</Link></div>
          </div>
        </section>
        <footer className="home-footer hermes-container"><span>Built by Waterloo students, for Waterloo students.</span><span>© 2026 Hermes · Made for the moments between classes.</span></footer>
      </main>
    </HermesMotion>
  );
}
