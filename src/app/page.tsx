"use client";

import React, { useState } from 'react';
import { 
  ArrowRight, 
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Mail, 
  CheckCircle2,
  Code2,
  Compass,
  EyeOff,
  Filter,
  Heart,
  LockKeyhole,
  MapPin,
  Music2,
  Pizza,
  Search,
  ShieldCheck,
  Sparkles,
  Verified,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ScrollReveal } from '@/components/landing/ScrollReveal';
import BackgroundGlobe from '@/components/puslate-globe'

const previewEvents = [
  {
    icon: Pizza,
    iconClass: "bg-orange-400/10 text-orange-200",
    title: "MathSoc Pizza Night",
    club: "Mathematics Society",
    meta: "Today · 6:00 PM · MC Comfy",
    tags: ["Free food", "Social"],
    source: "WUSA Clubs",
    freshness: "Updated 8m ago",
  },
  {
    icon: Code2,
    iconClass: "bg-blue-400/10 text-blue-300",
    title: "Build Night: Ship Something",
    club: "UW Blueprint",
    meta: "Tonight · 7:30 PM · E7 2317",
    tags: ["Hack / Dev", "Workshop"],
    source: "Official club",
    freshness: "Updated 21m ago",
  },
  {
    icon: Music2,
    iconClass: "bg-purple-400/10 text-purple-300",
    title: "Live Music on the Green",
    club: "UW Music Club",
    meta: "Tomorrow · 4:00 PM · Arts Quad",
    tags: ["Music", "Chill"],
    source: "Waterloo Events",
    freshness: "Updated 1h ago",
  },
] as const;

const discoveryModes = [
  {
    icon: Sparkles,
    eyebrow: "For You",
    title: "A feed that learns without trapping you.",
    description:
      "Hermes ranks what is timely and relevant while keeping Fresh and Following one tap away.",
    detail: "Save, Interested, Hide, and Why recommended controls",
    tone: "blue",
  },
  {
    icon: Filter,
    eyebrow: "Explore",
    title: "Filters when you know what you need.",
    description:
      "Narrow campus events by vibe, date, organiser, faculty, cost, and accessibility.",
    detail: "Structured discovery alongside the feed",
    tone: "purple",
  },
  {
    icon: MapPin,
    eyebrow: "Near now",
    title: "See what is happening around you.",
    description:
      "Move from a building or map pin directly into the canonical event detail.",
    detail: "Building-level context without precise user tracking",
    tone: "orange",
  },
] as const;

export default function App() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.toLowerCase().includes('@uwaterloo.ca')) {
      alert("Please use your @uwaterloo.ca email to join the waitlist.");
      return;
    }
    setStatus('loading');

    router.push(`/signup?email=${encodeURIComponent(email)}`);

    setTimeout(() => setStatus('success'), 1500);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans antialiased selection:bg-blue-500/30 overflow-x-hidden relative">
      
      {/* 1. Animated Background Map Pings */}
      <div
        id="map"
        className="absolute inset-x-0 top-0 h-[56rem] overflow-hidden opacity-45 [mask-image:linear-gradient(to_bottom,black_78%,transparent_100%)] max-md:pointer-events-none md:h-[60rem]"
      >
        <BackgroundGlobe /> 
        
        {/* Subtle Map Outline (SVG) */}
        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
          <path d="M200,300 Q400,100 600,300 T900,500" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="5,5" />
          <circle cx="330" cy="300" r="2" fill="white" />
          <circle cx="500" cy="500" r="2" fill="white" />
          <circle cx="750" cy="450" r="2" fill="white" />
        </svg>
      </div>

      {/* Ambient Blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full"></div>

      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-40 md:pt-48 pb-24 flex flex-col items-center text-center">

        {/* Improved Typography: Using font-sans with heavy weights */}
        <h1 className="text-6xl md:text-[100px] font-extrabold text-white tracking-tighter mb-8 leading-[0.98]">
          <span className="hero-reveal hero-reveal-delay-1 inline-block pb-[0.12em] -mb-[0.12em]">
            <span>See what&apos;s</span>
          </span>{" "}
          <br />
          <span className="hero-reveal hero-reveal-delay-2 inline-block pb-[0.16em] -mb-[0.16em]">
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-500 bg-clip-text text-transparent">
              happening at UW.
            </span>
          </span>
        </h1>

        <p className="hero-reveal hero-reveal-delay-3 max-w-xl text-zinc-500 text-lg leading-relaxed mb-12 font-medium">
          The central feed for Waterloo campus life. <br className="hidden md:block" />
          Clubs, events, and free food alerts, synced in real-time.
        </p>

        {/* CTA Container */}
        <div id="join" className="hero-reveal hero-reveal-delay-4 w-full max-w-lg scroll-mt-32 bg-zinc-900/30 border border-zinc-800/50 p-2 rounded-2xl backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {status !== 'success' ? (
            <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-2">
              <div className="flex-1 relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={20} />
                <input 
                  type="email"
                  required
                  placeholder="your.email@uwaterloo.ca"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent border-none py-4 pl-12 pr-4 text-white focus:ring-0 placeholder:text-zinc-700 text-base"
                />
              </div>
              <button 
                type="submit"
                disabled={status === 'loading'}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl transition-all flex items-center justify-center gap-2 group disabled:opacity-50 shadow-lg shadow-blue-600/20"
              >
                {status === 'loading' ? 'Joining...' : 'Get Access'}
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          ) : (
            <div className="py-10 px-4 flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-500">
              <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20">
                <CheckCircle2 size={28} className="text-green-500" />
              </div>
              <div className="text-center">
                <p className="text-white text-xl font-bold tracking-tight">Access Granted.</p>
                <p className="text-zinc-500 text-sm mt-1">We sent a verification link to your inbox.</p>
              </div>
            </div>
          )}
        </div>
        <p className="hero-reveal hero-reveal-delay-4 mt-4 text-xs font-medium text-zinc-600">
          Built for UW students. No spam.
        </p>

      </main>

      <section id="features" className="landing-section relative z-10">
        <ScrollReveal className="mx-auto max-w-3xl text-center">
          <p className="landing-eyebrow">The campus discovery layer</p>
          <h2 className="landing-title">
            A feed built for deciding,
            <br />
            not endless scrolling.
          </h2>
          <p className="landing-subtitle mx-auto">
            Every Hermes card compresses the details you need to decide whether
            something is worth your time, with the source and organiser always
            one tap away.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={120}>
          <div className="product-shell">
            <div className="product-shell-bar">
              <div className="product-switcher">
                <span className="product-switcher-active">For You</span>
                <span>Fresh</span>
                <span>Following</span>
              </div>
              <div className="product-search">
                <Search size={15} />
                Search campus
              </div>
            </div>

            <div className="product-chip-row">
              {["Everything", "Free food", "Career", "Hack / Dev", "Social"].map((chip, index) => (
                <span key={chip} className={index === 0 ? "product-chip-active" : "product-chip"}>
                  {chip}
                </span>
              ))}
            </div>

            <div className="product-feed-grid">
              {previewEvents.map(({ icon: Icon, iconClass, title, club, meta, tags, source, freshness }, index) => (
                <ScrollReveal key={title} delay={180 + index * 90}>
                  <article className={`product-event-card ${index === 0 ? "product-event-card-featured" : ""}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className={`product-event-icon ${iconClass}`}>
                        <Icon size={20} />
                      </div>
                      <button type="button" aria-label={`Hide ${title}`} className="product-icon-button">
                        <EyeOff size={15} />
                      </button>
                    </div>
                    <p className="mt-5 text-xs font-semibold text-blue-300">{club}</p>
                    <h3 className="mt-2 text-xl font-bold leading-tight text-white">{title}</h3>
                    <p className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
                      <Clock3 size={14} />
                      {meta}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span key={tag} className="product-tag">{tag}</span>
                      ))}
                    </div>
                    <div className="product-source-row">
                      <span className="flex items-center gap-1.5">
                        <Verified size={14} className="text-blue-300" />
                        {source}
                      </span>
                      <span>{freshness}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button type="button" className="product-action product-action-primary">
                        <Heart size={15} />
                        Save
                      </button>
                      <button type="button" className="product-action">
                        Interested
                      </button>
                    </div>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </section>

      <section className="landing-section relative z-10 pt-0">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
          <ScrollReveal>
            <p className="landing-eyebrow">Events lead somewhere</p>
            <h2 className="landing-title">Find the event. Stay for the community.</h2>
            <p className="landing-subtitle mb-7">
              Hermes connects every event to a durable club or organiser, making
              campus discovery useful beyond a single night.
            </p>
            <div className="space-y-3">
              {[
                "Follow organisers for recurring events",
                "See official links and source provenance",
                "Move from save to interested to going",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-zinc-400">
                  <Check size={16} className="text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal direction="right" delay={120}>
            <div className="community-preview">
              <div className="community-event">
                <div className="flex items-center justify-between gap-4">
                  <span className="product-tag">Starting tonight</span>
                  <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <Verified size={14} className="text-blue-300" />
                    Official club
                  </span>
                </div>
                <h3 className="mt-5 text-2xl font-bold tracking-tight text-white">
                  Build Night: Ship Something
                </h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Bring an idea, meet a team, and leave with something working.
                  Beginners welcome.
                </p>
                <div className="mt-5 grid gap-3 text-sm text-zinc-400 sm:grid-cols-2">
                  <span className="flex items-center gap-2"><CalendarDays size={15} /> Thursday · 7:30 PM</span>
                  <span className="flex items-center gap-2"><MapPin size={15} /> E7 2317</span>
                </div>
              </div>
              <div className="community-org-card">
                <div className="community-org-avatar"><Code2 size={22} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">Organiser</p>
                  <h4 className="mt-1 font-semibold text-white">UW Blueprint</h4>
                  <p className="mt-1 text-xs text-zinc-500">4 upcoming events · Technology</p>
                </div>
                <button type="button" className="community-follow">Follow</button>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="landing-section relative z-10 pt-0">
        <ScrollReveal>
          <p className="landing-eyebrow">Feed-first, not feed-only</p>
          <h2 className="landing-title">Discover campus your way.</h2>
          <p className="landing-subtitle">
            Browse when you want inspiration. Filter or use the map when you
            already know what kind of opportunity you need.
          </p>
        </ScrollReveal>
        <div className="grid gap-4 lg:grid-cols-3">
          {discoveryModes.map(({ icon: Icon, eyebrow, title, description, detail, tone }, index) => (
            <ScrollReveal key={eyebrow} delay={index * 90}>
              <article className={`discovery-card discovery-card-${tone}`}>
                <div className="flex items-center justify-between">
                  <div className="landing-icon mb-0"><Icon size={20} /></div>
                  <ChevronRight size={18} className="text-zinc-600" />
                </div>
                <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-blue-300">{eyebrow}</p>
                <h3 className="mt-3 text-xl font-bold leading-tight text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-500">{description}</p>
                <p className="mt-8 border-t border-white/[0.08] pt-4 text-xs text-zinc-400">{detail}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="trust-section relative z-10">
        <div className="landing-section py-0">
          <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <ScrollReveal>
              <p className="landing-eyebrow">Trust is part of discovery</p>
              <h2 className="landing-title">Know why an event is here.</h2>
              <p className="landing-subtitle mb-0">
                Hermes foregrounds provenance, freshness, and organiser identity
                so campus discovery stays useful instead of becoming another
                noisy anonymous feed.
              </p>
            </ScrollReveal>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [Verified, "Source-backed events", "Official and imported events retain their source link and freshness."],
                [LockKeyhole, "Campus-gated actions", "Browsing stays easy while saves, RSVPs, and submissions require identity."],
                [ShieldCheck, "Named organisers", "Events connect to accountable clubs and organisations."],
                [Compass, "Privacy-conscious by default", "Building-level context works without precise live location tracking."],
              ].map(([Icon, title, description], index) => {
                const TrustIcon = Icon as typeof Verified;
                return (
                  <ScrollReveal key={title as string} delay={index * 80}>
                    <article className="trust-card">
                      <TrustIcon size={20} className="text-blue-300" />
                      <h3 className="mt-5 font-semibold text-white">{title as string}</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-500">{description as string}</p>
                    </article>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-final-cta relative z-10">
        <ScrollReveal>
          <p className="landing-eyebrow">Start with what is happening</p>
          <h2 className="landing-title mx-auto max-w-2xl">
            Find the event.
            <br />
            Follow what comes next.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-zinc-500">
            Join Hermes with your UW email or preview the current campus feed.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#join" className="landing-primary-button">
              Get access
              <ArrowRight size={18} />
            </a>
            <Link href="/events" className="landing-secondary-button">
              Preview events
            </Link>
          </div>
        </ScrollReveal>
      </section>

      <footer className="relative z-10 flex flex-col gap-4 border-t border-white/[0.07] px-6 py-8 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <p>© 2026 Hermes · Built for UWaterloo</p>
        <div className="flex gap-5">
          <a href="#features" className="transition hover:text-zinc-300">Features</a>
          <Link href="/events" className="transition hover:text-zinc-300">Events</Link>
          <a href="#join" className="transition hover:text-zinc-300">Get access</a>
        </div>
      </footer>

      {/* Global CSS for Inter Font Fallback */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        
        :root {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        }
      `}} />
    </div>
  );
}
