"use client";

import { ArrowRight, ArrowUpRight, CalendarDays, MapPin, MoveUpRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HermesMotion } from "@/components/motion/HermesMotion";

const preview = [
  { day: "Today", category: "Free food", title: "Something good between classes", detail: "Find the next campus bite" },
  { day: "Tonight", category: "People", title: "A reason to stay a little longer", detail: "Meet your next crowd" },
  { day: "This week", category: "Possibility", title: "The plan you didn't know you needed", detail: "Explore what is on" },
];

export default function HomePage() {
  const [email, setEmail] = useState("");
  const router = useRouter();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.toLowerCase().endsWith("@uwaterloo.ca")) {
      window.alert("Please use your @uwaterloo.ca email to join Hermes.");
      return;
    }
    router.push(`/signup?email=${encodeURIComponent(email)}`);
  }

  return (
    <HermesMotion variant="home"><main className="hermes-home">
      <section className="home-hero">
        <div className="home-hero-inner hermes-container">
          <div className="home-hero-copy">
            <h1 data-motion="home-title">Make room for <em>what&apos;s happening.</em></h1>
            <p data-motion="home-copy">Good things are happening all around the University of Waterloo campus. Hermes brings them into one place, so the next plan is always close.</p>
            <div className="home-hero-actions" data-motion="home-actions">
              <Link href="/events" className="hermes-button hermes-button-gold">Explore events <ArrowUpRight size={18} /></Link>
              <a href="#join" className="hermes-text-link">Get student access <ArrowRight size={17} /></a>
            </div>
          </div>
          <div className="home-guide-stack" data-motion="home-cover"><div className="home-guide" aria-label="Preview of campus discovery">
            <div className="home-guide-top"><span>HERMES / WATERLOO</span><span>THE CAMPUS GUIDE</span></div>
            <div className="home-guide-route"><span className="route-node route-node-a"/><span className="route-node route-node-b"/><span className="route-node route-node-c"/><span className="route-line"/><MapPin className="route-pin" data-motion="home-pin" size={34} strokeWidth={1.5}/></div>
            <div className="home-guide-title"><span>Discover</span><strong>more of<br/>your day.</strong></div>
            <div className="home-guide-bottom"><span>EVENTS</span><span>PEOPLE</span><span>PLACES</span><MoveUpRight size={19}/></div>
          </div></div>
        </div>
        <div className="home-hero-foot hermes-container"><span>Find your next reason to go out.</span><span>Scroll to explore <span aria-hidden="true">↓</span></span></div>
      </section>

      <section className="home-intro hermes-container" id="features" data-motion="intro-section">
        <div className="home-intro-heading" data-motion="intro-item"><h2>Campus life is better when you know where to look.</h2></div>
        <div className="home-intro-copy" data-motion="intro-item"><p>One feed for events, free food, clubs, and opportunities around Waterloo. See when and where it happens, who is behind it, and the original source before you go.</p><Link href="/events" className="hermes-text-link">Browse the live feed <ArrowUpRight size={17}/></Link></div>
      </section>

      <section className="home-discovery hermes-container" aria-labelledby="discover-heading" data-motion="preview-section">
        <div className="home-section-head"><h2 id="discover-heading">A little more out of every day.</h2><p>Go with a plan, or let the day surprise you.</p></div>
        <div className="home-preview-grid">
          {preview.map((item, index) => <Link key={item.day} href="/events" className={`home-preview home-preview-${index + 1}`} data-motion="preview-tile"><span className="home-preview-top"><span>{item.day}</span><ArrowUpRight size={20}/></span><span className="home-preview-content"><small>{item.category}</small><strong>{item.title}</strong><span>{item.detail}</span></span></Link>)}
        </div>
      </section>

      <section className="home-method" data-motion="method-section">
        <div className="hermes-container home-method-inner"><div data-motion="method-item"><CalendarDays size={26} strokeWidth={1.5}/><h2>Less searching.<br/><em>More showing up.</em></h2></div><div data-motion="method-item"><p>Explore by interest, catch what is starting soon, and keep the details that matter close. Every listing points back to a public source, so you can decide with confidence.</p><Link href="/events" className="hermes-button hermes-button-outline">See what&apos;s on <ArrowUpRight size={18}/></Link></div></div>
      </section>

      <section className="home-join hermes-container" id="join" data-motion="join-section"><div data-motion="join-item"><h2>Be where <em>it happens.</em></h2><p>Join with your Waterloo email to save events and RSVP, or start exploring now.</p></div><form onSubmit={handleSubmit} className="home-join-form" data-motion="join-item"><label htmlFor="home-email">Your Waterloo email</label><div><input id="home-email" type="email" required placeholder="your.email@uwaterloo.ca" value={email} onChange={(event) => setEmail(event.target.value)}/><button type="submit" aria-label="Get access"><ArrowRight size={22}/></button></div><span>Built by students, for students.</span></form></section>
      <footer className="home-footer hermes-container"><span>© 2026 Hermes</span><span>Made for the moments between classes.</span><Link href="/events">Explore events <ArrowUpRight size={14}/></Link></footer>
    </main></HermesMotion>
  );
}
