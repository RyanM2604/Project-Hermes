"use client";

import React, { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Code2,
  Compass,
  Filter,
  Heart,
  LockKeyhole,
  Mail,
  MapPin,
  Music2,
  Pizza,
  Radio,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Verified,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import BackgroundGlobe from "@/components/puslate-globe";

const previewEvents = [
  {
    icon: Pizza,
    accent: "amber",
    href: "/events/event-mathsoc-pizza-night",
    title: "MathSoc Pizza and Board Games",
    club: "Mathematics Society",
    time: "Today · 6:00 PM",
    location: "MC Comfy",
    status: "Free food",
    source: "WUSA Clubs",
    freshness: "Updated 8m ago",
  },
  {
    icon: Code2,
    accent: "blue",
    href: "/events/event-csc-lightning-talks",
    title: "CSC Lightning Talks and Snacks",
    club: "Computer Science Club",
    time: "Tonight · 7:30 PM",
    location: "DC Lecture Hall",
    status: "Hack / Dev",
    source: "Official club",
    freshness: "Updated 21m ago",
  },
  {
    icon: Music2,
    accent: "mint",
    href: "/events/event-wusa-open-mic",
    title: "SLC Open Mic Night",
    club: "WUSA",
    time: "Tomorrow · 8:00 PM",
    location: "SLC Great Hall",
    status: "Music",
    source: "Waterloo Events",
    freshness: "Updated 1h ago",
  },
] as const;

const discoveryModes = [
  {
    icon: Sparkles,
    label: "For you",
    title: "Start with what feels worth your time.",
    description:
      "A timely feed that learns from saves and RSVPs without hiding fresh campus options.",
    detail: "Personal signal, always explainable",
  },
  {
    icon: Filter,
    label: "Explore",
    title: "Narrow the campus when you know the vibe.",
    description:
      "Filter by free food, career, hack and dev, music, social events, or what starts soon.",
    detail: "Structured discovery, one tap away",
  },
  {
    icon: MapPin,
    label: "Near now",
    title: "Turn the buildings around you into plans.",
    description:
      "Move from a campus location into a clear event detail without precise live tracking.",
    detail: "Building-level context, privacy intact",
  },
] as const;

const trustRows = [
  {
    icon: Verified,
    title: "Source-backed events",
    description: "Official links and freshness stay attached to every listing.",
    state: "Verified",
  },
  {
    icon: LockKeyhole,
    title: "Campus-gated actions",
    description: "Browsing stays open; saves and RSVPs require a UW identity.",
    state: "Protected",
  },
  {
    icon: ShieldCheck,
    title: "Named organisers",
    description: "Events connect to accountable clubs and organisations.",
    state: "Accountable",
  },
  {
    icon: Compass,
    title: "Privacy-conscious location",
    description: "Useful building context without precise live location tracking.",
    state: "Private",
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
            <p className="signal-label">
              <Radio size={15} />
              Live campus signal
            </p>
            <h2 className="signal-title">
              Decide what is worth doing before your next class.
            </h2>
            <p className="signal-body">
              Hermes turns scattered campus listings into one timely feed. The
              important details stay visible: when, where, who is hosting, and
              why it belongs on your radar.
            </p>
            <Link href="/events" className="signal-text-link">
              Browse the live feed
              <ArrowRight size={17} />
            </Link>
          </ScrollReveal>

          <ScrollReveal direction="right" delay={100} className="signal-feed-window">
            <div className="signal-feed-toolbar">
              <div className="signal-feed-tabs" aria-label="Feed preview">
                <span className="is-active">For you</span>
                <span>Fresh</span>
                <span>Following</span>
              </div>
              <span className="signal-search-preview">
                <Search size={14} />
                Search campus
              </span>
            </div>

            <div className="signal-starting-row">
              <span className="signal-live-dot" />
              <span>Starting soon</span>
              <span className="signal-starting-count">3 near campus</span>
            </div>

            <div className="signal-event-rail">
              {previewEvents.map(
                ({
                  icon: Icon,
                  accent,
                  href,
                  title,
                  club,
                  time,
                  location,
                  status: eventStatus,
                  source,
                  freshness,
                }) => (
                  <Link key={title} href={href} className="signal-event-card">
                    <div className="signal-event-card-top">
                      <span className={`signal-event-icon signal-event-icon-${accent}`}>
                        <Icon size={18} />
                      </span>
                      <span className={`signal-event-status signal-event-status-${accent}`}>
                        {eventStatus}
                      </span>
                    </div>
                    <div>
                      <p className="signal-event-club">{club}</p>
                      <h3>{title}</h3>
                    </div>
                    <dl className="signal-event-meta">
                      <div>
                        <Clock3 size={14} />
                        <dt className="sr-only">Time</dt>
                        <dd>{time}</dd>
                      </div>
                      <div>
                        <MapPin size={14} />
                        <dt className="sr-only">Location</dt>
                        <dd>{location}</dd>
                      </div>
                    </dl>
                    <div className="signal-event-source">
                      <span>
                        <Verified size={13} />
                        {source}
                      </span>
                      <span>{freshness}</span>
                    </div>
                  </Link>
                ),
              )}
            </div>

            <div className="signal-feed-foot">
              <span>Free food</span>
              <span>Career</span>
              <span>Hack / Dev</span>
              <span>Social</span>
              <span className="signal-feed-foot-active">Everything</span>
            </div>
          </ScrollReveal>
        </section>

        <section className="signal-section signal-community-section">
          <ScrollReveal className="signal-community-visual">
            <article className="signal-event-detail">
              <div className="signal-detail-head">
                <span className="signal-event-status signal-event-status-blue">
                  Starting tonight
                </span>
                <span className="signal-trusted">
                  <Verified size={14} />
                  Official club
                </span>
              </div>
              <p className="signal-event-club">UW Blueprint</p>
              <h3>Build Night: Ship Something</h3>
              <p>
                Bring an idea, meet a team, and leave with something working.
                Beginners welcome.
              </p>
              <div className="signal-detail-meta">
                <span>
                  <CalendarDays size={15} />
                  Thursday · 7:30 PM
                </span>
                <span>
                  <MapPin size={15} />
                  E7 2317
                </span>
              </div>
              <div className="signal-detail-actions" aria-label="Example event actions">
                <span className="signal-action-primary">
                  <Heart size={15} />
                  Save
                </span>
                <span>Going</span>
              </div>
            </article>

            <div className="signal-community-connector" aria-hidden="true">
              <span />
            </div>

            <article className="signal-organizer">
              <div className="signal-organizer-avatar">
                <Code2 size={22} />
              </div>
              <div>
                <p>Organiser</p>
                <h3>UW Blueprint</h3>
                <span>4 upcoming events · Technology</span>
              </div>
              <span className="signal-follow-preview">
                <Users size={14} />
                Follow
              </span>
            </article>
          </ScrollReveal>

          <ScrollReveal direction="right" delay={100} className="signal-section-copy">
            <p className="signal-label">
              <Users size={15} />
              Events lead somewhere
            </p>
            <h2 className="signal-title">
              Find the event. Stay for the community.
            </h2>
            <p className="signal-body">
              Every event connects back to a durable organiser, so discovering
              one good night can lead to the next workshop, meetup, or group.
            </p>
            <ul className="signal-check-list">
              {[
                "Follow organisers for recurring events",
                "See official links and source provenance",
                "Move naturally from save to going",
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
          <ScrollReveal className="signal-section-copy signal-discovery-copy">
            <p className="signal-label">
              <Route size={15} />
              Feed-first, not feed-only
            </p>
            <h2 className="signal-title">Discover campus your way.</h2>
            <p className="signal-body">
              Browse when you want inspiration. Filter or use nearby buildings
              when you already know the kind of plan you need.
            </p>
          </ScrollReveal>

          <div className="signal-discovery-layout">
            <div className="signal-path-map" aria-hidden="true">
              <span className="signal-path-building signal-path-building-mc">MC</span>
              <span className="signal-path-building signal-path-building-e7">E7</span>
              <span className="signal-path-building signal-path-building-slc">SLC</span>
              <span className="signal-path-you">
                <Zap size={15} />
              </span>
              <svg viewBox="0 0 600 340" preserveAspectRatio="none">
                <path d="M70 250 C170 90 225 270 320 150 S470 40 545 105" />
                <path d="M70 250 C205 310 380 290 510 235" />
              </svg>
            </div>

            <div className="signal-mode-list">
              {discoveryModes.map(({ icon: Icon, label, title, description, detail }, index) => (
                <ScrollReveal key={label} delay={index * 80}>
                  <Link href="/events" className="signal-mode-row">
                    <span className="signal-mode-index">0{index + 1}</span>
                    <span className="signal-mode-icon">
                      <Icon size={18} />
                    </span>
                    <span className="signal-mode-content">
                      <span>{label}</span>
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </span>
                    <span className="signal-mode-detail">{detail}</span>
                    <ArrowRight size={17} />
                  </Link>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="signal-section signal-trust-section">
          <ScrollReveal className="signal-section-copy">
            <p className="signal-label">
              <ShieldCheck size={15} />
              Trust is part of discovery
            </p>
            <h2 className="signal-title">Know why an event is here.</h2>
            <p className="signal-body">
              Provenance, freshness, and organiser identity stay visible, so
              campus discovery remains useful instead of becoming another noisy
              anonymous feed.
            </p>
          </ScrollReveal>

          <ScrollReveal direction="right" delay={100} className="signal-trust-ledger">
            <div className="signal-ledger-head">
              <span>Hermes listing standard</span>
              <span>
                <span className="signal-live-dot" />
                Active
              </span>
            </div>
            {trustRows.map(({ icon: Icon, title, description, state }) => (
              <article key={title} className="signal-ledger-row">
                <span className="signal-ledger-icon">
                  <Icon size={18} />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <span className="signal-ledger-state">
                  <Check size={13} />
                  {state}
                </span>
              </article>
            ))}
          </ScrollReveal>
        </section>

        <section className="signal-final-cta">
          <ScrollReveal>
            <span className="signal-cta-node" aria-hidden="true">
              <Zap size={18} />
            </span>
            <h2>Find the event. Follow what comes next.</h2>
            <p>
              Join Hermes with your UW email, or preview what is happening
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
        <p>© 2026 Hermes · Built for UWaterloo</p>
        <div>
          <a href="#features">How it works</a>
          <Link href="/events">Events</Link>
          <a href="#join">Get access</a>
        </div>
      </footer>
    </div>
  );
}
