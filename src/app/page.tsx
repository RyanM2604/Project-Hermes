"use client";

import React, { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Filter,
  Heart,
  Mail,
  MapPin,
  Radio,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EventThemeMotif } from "@/components/events";
import { DiscoveryCardStack } from "@/components/landing/DiscoveryCardStack";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { getEventTheme } from "@/lib/events/event-theme";
import BackgroundGlobe from "@/components/puslate-globe";

const previewEvents = [
  {
    building: "Today",
    href: "/events",
    title: "Free food near you",
    club: "Official campus sources",
    time: "Updated regularly",
    location: "Across Waterloo",
    tag: "free-food",
  },
  {
    building: "Tonight",
    href: "/events",
    title: "Career events before applications close",
    club: "Original source attached",
    time: "Checked before listing",
    location: "Campus and nearby",
    tag: "hack-dev",
  },
  {
    building: "This week",
    href: "/events",
    title: "What is happening tonight",
    club: "Only source-backed listings",
    time: "Browse the live feed",
    location: "Waterloo",
    tag: "music",
  },
] as const;

const discoveryModes = [
  {
    icon: Sparkles,
    label: "For you",
    title: "Start with events that start soon.",
    description:
      "Saved events, RSVPs, and recent clicks help surface the next useful thing without burying new listings.",
    detail: "Built from your real activity",
  },
  {
    icon: Filter,
    label: "Explore",
    title: "Filter by what you actually want.",
    description:
      "Jump straight to free food, career, hack and dev, music, social plans, or events starting soon.",
    detail: "One tap to the right feed",
  },
  {
    icon: MapPin,
    label: "Near now",
    title: "See if it is worth walking over.",
    description:
      "Building-level locations keep the feed useful without asking for precise tracking.",
    detail: "SLC, EC5, QNC, MC",
  },
] as const;

export default function App() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.toLowerCase().includes("@uwaterloo.ca")) {
      alert("Please use your @uwaterloo.ca email to join the waitlist.");
      return;
    }
    setStatus("loading");

    router.push(`/signup?email=${encodeURIComponent(email)}`);

    setTimeout(() => setStatus("success"), 1500);
  };

  return (
    <div className="relative min-h-screen overflow-clip bg-[#050505] font-sans text-zinc-300 antialiased selection:bg-blue-500/30">
      {/* Hero section is intentionally preserved. */}
      <div
        id="map"
        className="absolute inset-x-0 top-0 h-[56rem] overflow-hidden opacity-45 [mask-image:linear-gradient(to_bottom,black_78%,transparent_100%)] max-md:pointer-events-none md:h-[60rem]"
      >
        <BackgroundGlobe />

        <svg
          className="absolute inset-0 h-full w-full opacity-10"
          viewBox="0 0 1000 1000"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M200,300 Q400,100 600,300 T900,500"
            fill="none"
            stroke="white"
            strokeWidth="0.5"
            strokeDasharray="5,5"
          />
          <circle cx="330" cy="300" r="2" fill="white" />
          <circle cx="500" cy="500" r="2" fill="white" />
          <circle cx="750" cy="450" r="2" fill="white" />
        </svg>
      </div>

      <div className="absolute top-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-blue-600/10 blur-[120px]" />
      <div className="absolute right-[-10%] bottom-[-10%] h-[50%] w-[50%] rounded-full bg-indigo-600/10 blur-[120px]" />

      <main className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pt-40 pb-24 text-center md:pt-48">
        <h1 className="mb-8 text-6xl leading-[0.98] font-extrabold tracking-tighter text-white md:text-[100px]">
          <span className="hero-reveal hero-reveal-delay-1 -mb-[0.12em] inline-block pb-[0.12em]">
            <span>See what&apos;s</span>
          </span>{" "}
          <br />
          <span className="hero-reveal hero-reveal-delay-2 -mb-[0.16em] inline-block pb-[0.16em]">
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-500 bg-clip-text text-transparent">
              happening at UW.
            </span>
          </span>
        </h1>

        <p className="hero-reveal hero-reveal-delay-3 mb-12 max-w-xl text-lg leading-relaxed font-medium text-zinc-500">
          The central feed for Waterloo campus life.{" "}
          <br className="hidden md:block" />
          Clubs, events, and free food alerts, synced in real-time.
        </p>

        <div
          id="join"
          className="hero-reveal hero-reveal-delay-4 w-full max-w-lg scroll-mt-32 rounded-2xl border border-zinc-800/50 bg-zinc-900/30 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        >
          {status !== "success" ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2 md:flex-row">
              <div className="relative flex-1">
                <Mail
                  className="absolute top-1/2 left-4 -translate-y-1/2 text-zinc-600"
                  size={20}
                />
                <input
                  type="email"
                  required
                  placeholder="your.email@uwaterloo.ca"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border-none bg-transparent py-4 pr-4 pl-12 text-base text-white placeholder:text-zinc-700 focus:ring-0"
                />
              </div>
              <button
                type="submit"
                disabled={status === "loading"}
                className="group flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 disabled:opacity-50"
              >
                {status === "loading" ? "Joining..." : "Get Access"}
                <ArrowRight
                  size={20}
                  className="transition-transform group-hover:translate-x-1"
                />
              </button>
            </form>
          ) : (
            <div className="animate-in fade-in zoom-in flex flex-col items-center gap-3 px-4 py-10 duration-500">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-green-500/20 bg-green-500/10">
                <CheckCircle2 size={28} className="text-green-500" />
              </div>
              <div className="text-center">
                <p className="text-xl font-bold tracking-tight text-white">
                  Access Granted.
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  We sent a verification link to your inbox.
                </p>
              </div>
            </div>
          )}
        </div>
        <p className="hero-reveal hero-reveal-delay-4 mt-4 text-xs font-medium text-zinc-600">
          Built for UW students. No spam.
        </p>
      </main>

      <div id="features" className="signal-story">
        <div className="signal-route" aria-hidden="true">
          <span className="signal-route-node signal-route-node-1" />
          <span className="signal-route-node signal-route-node-2" />
          <span className="signal-route-node signal-route-node-3" />
          <span className="signal-route-node signal-route-node-4" />
        </div>

        <section className="signal-section signal-feed-section">
          <ScrollReveal className="signal-section-copy">
            <h2 className="signal-title">
              See what is worth doing before your next class.
            </h2>
            <p className="signal-body">
              Hermes turns scattered campus listings into one feed with the
              details students actually scan: when it starts, where it is, and
              who posted it.
            </p>
            <Link href="/events" className="signal-text-link">
              Browse the live feed
              <ArrowRight size={17} />
            </Link>
          </ScrollReveal>

          <ScrollReveal direction="right" delay={100} className="signal-feed-window">
            <div className="signal-product-heading">
              <div>
                <span>Today at Waterloo</span>
                <strong>Find something worth going to.</strong>
              </div>
              <CalendarDays size={18} />
            </div>

            <div className="signal-product-filters" aria-label="Event filters preview">
              <span className="is-active">All Events</span>
              <span>Free Food</span>
              <span>Hack + Dev</span>
              <span>Career + Co-op</span>
            </div>

            <div className="signal-product-section-head">
              <div>
                <span>Up next</span>
                <strong>Starting Soon</strong>
              </div>
              <small>Scroll for more</small>
            </div>

            <div className="signal-event-rail">
              {previewEvents.map(({ building, href, title, club, time, location, tag }) => {
                const theme = getEventTheme(tag);

                return (
                  <Link
                    key={title}
                    href={href}
                    className={`signal-event-card bg-gradient-to-br ${theme.mediaClassName}`}
                  >
                    <div
                      className={`signal-product-card-glow ${theme.glowClassName}`}
                    />
                    <EventThemeMotif motif={theme.motif} />
                    <div className="signal-event-card-top">
                      <span className={theme.accentTextClassName}>{time}</span>
                      <span className={`signal-product-tag ${theme.tagClassName}`}>
                        {theme.label}
                      </span>
                    </div>
                    <div>
                      <p className="signal-event-club">{club}</p>
                      <h3>{title}</h3>
                    </div>
                    <div className="signal-product-location">
                      <span>{location}</span>
                      <span>{building}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </ScrollReveal>
        </section>

        <section className="signal-section signal-community-section">
          <ScrollReveal className="signal-community-visual">
            <article className="signal-event-detail">
              <div className="signal-detail-themed-hero">
                <div className="signal-detail-grid" aria-hidden="true" />
                <div className="signal-detail-themed-head">
                  <span className="signal-product-tag signal-product-tag-cyan">
                    Hack & dev
                  </span>
                  <span className="signal-detail-building">E7</span>
                </div>
              <div className="signal-detail-themed-title">
                  <p>Original source attached</p>
                  <h3>Source-backed event detail</h3>
                </div>
              </div>
              <div className="signal-detail-themed-body">
                <div>
                  <span className="signal-detail-overline">About this event</span>
                  <p>
                    Every listing keeps the original source, current event
                    details, and a link you can open before you go.
                  </p>
                  <span className="signal-product-tag signal-product-tag-cyan">
                    Hack Dev
                  </span>
                </div>
                <dl>
                  <div>
                    <CalendarDays size={15} />
                    <span>Current source time</span>
                  </div>
                  <div>
                    <MapPin size={15} />
                    <span>Verified location</span>
                  </div>
                </dl>
                <div className="signal-detail-actions" aria-label="Example event actions">
                  <span className="signal-action-primary">
                    Going
                  </span>
                  <span>
                    <Heart size={15} />
                    Save event
                  </span>
                </div>
              </div>
            </article>
          </ScrollReveal>

          <ScrollReveal direction="right" delay={100} className="signal-section-copy">
            <h2 className="signal-title">
              Find the event, then decide if it is worth going.
            </h2>
            <p className="signal-body">
              Each event keeps its organiser and source visible, so one good
              plan can lead to the next workshop, meetup, or free meal.
            </p>
            <ul className="signal-check-list">
              {[
                "See the source before you leave",
                "Save events and RSVP when you are ready",
                "Keep recurring organisers in view",
              ].map((item) => (
                <li key={item}>
                  <Check size={16} />
                  {item}
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </section>

        <section className="signal-section signal-discovery-section">
          <ScrollReveal className="signal-discovery-heading">
            <h2 className="signal-title">Discover Waterloo your way.</h2>
          </ScrollReveal>

          <DiscoveryCardStack modes={discoveryModes} />
        </section>

        <section className="signal-final-cta">
          <ScrollReveal>
            <span className="signal-cta-node" aria-hidden="true">
              <Zap size={18} />
            </span>
            <h2>Find something before your next class.</h2>
            <p>
              Join Hermes with your UW email, or browse what is happening
              around campus right now.
            </p>
            <div className="signal-cta-actions">
              <a href="#join" className="signal-primary-button">
                Get access
                <ArrowRight size={18} />
              </a>
              <Link href="/events" className="signal-secondary-button">
                Preview events
              </Link>
            </div>
          </ScrollReveal>
        </section>
      </div>

      <footer className="signal-footer">
        <p>© 2026 Hermes · Built for UWaterloo students by Uwaterloo students</p>
        <div>
          <a href="#features">How it works</a>
          <Link href="/events">Events</Link>
          <a href="#join">Get access</a>
        </div>
      </footer>
    </div>
  );
}
