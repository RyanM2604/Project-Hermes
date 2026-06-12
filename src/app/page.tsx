"use client";

import React, { useState } from 'react';
import { 
  ArrowRight, 
  BellRing,
  CalendarDays,
  Check,
  Mail, 
  CheckCircle2,
  Code2,
  Compass,
  Heart,
  MapPin,
  Music2,
  Pizza,
  Search,
  Sparkles,
  UsersRound
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ScrollReveal } from '@/components/landing/ScrollReveal';
import BackgroundGlobe from '@/components/puslate-globe'

const benefits = [
  {
    icon: BellRing,
    title: "Timely campus alerts",
    description:
      "See free food, club drops, and events worth showing up for before they are over.",
  },
  {
    icon: CalendarDays,
    title: "One event feed",
    description:
      "Browse events from clubs, faculties, and student groups without checking five different sites.",
  },
  {
    icon: UsersRound,
    title: "Find your people",
    description:
      "Discover communities through the events they run, from hack nights to casual socials.",
  },
  {
    icon: MapPin,
    title: "Campus context",
    description:
      "Know the building, room, time, and source before you decide to cross campus.",
  },
  {
    icon: Search,
    title: "Browse by vibe",
    description:
      "Filter for free food, career events, hack nights, music, or whatever fits your day.",
  },
  {
    icon: Heart,
    title: "Save what matters",
    description:
      "Keep interesting events close and mark what you are planning to attend.",
  },
] as const;

const feedPreview = [
  {
    icon: Pizza,
    iconClass: "bg-emerald-400/10 text-emerald-300",
    title: "MathSoc Pizza Night",
    meta: "MC Comfy · Starts at 6:00 PM",
    pill: "Free food",
    pillClass: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  },
  {
    icon: Code2,
    iconClass: "bg-blue-400/10 text-blue-300",
    title: "Hack the North Build Night",
    meta: "E7 · Tonight",
    pill: "Hack / Dev",
    pillClass: "border-blue-300/20 bg-blue-300/10 text-blue-200",
  },
  {
    icon: Music2,
    iconClass: "bg-purple-400/10 text-purple-300",
    title: "Live Music on the Green",
    meta: "Arts Quad · 4:00 PM",
    pill: "Music",
    pillClass: "border-purple-300/20 bg-purple-300/10 text-purple-200",
  },
] as const;

const vibes = [
  { icon: Pizza, title: "Free Food", count: "Pizza, BBQs, snacks", tone: "blue" },
  { icon: Code2, title: "Hack / Dev", count: "Build nights, workshops", tone: "indigo" },
  { icon: Sparkles, title: "Social", count: "Meetups, games, clubs", tone: "purple" },
  { icon: Compass, title: "Opportunities", count: "Career, co-op, startups", tone: "orange" },
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

      <section className="landing-proof relative z-10 border-y border-white/[0.07] bg-white/[0.02]">
        {[
          ["12", "event vibes"],
          ["One", "campus feed"],
          ["Seconds", "to discover"],
          ["Free", "for UW students"],
        ].map(([value, label]) => (
          <div key={label} className="landing-proof-item">
            <p className="text-2xl font-bold tracking-tight text-blue-300 sm:text-3xl">
              {value}
            </p>
            <p className="mt-1 text-xs font-medium text-zinc-500">{label}</p>
          </div>
        ))}
      </section>

      <section id="features" className="landing-section relative z-10">
        <ScrollReveal>
          <p className="landing-eyebrow">What Hermes brings together</p>
          <h2 className="landing-title">
            Everything campus,
            <br />
            in one place.
          </h2>
          <p className="landing-subtitle">
            Hermes turns scattered campus posts into one browse-first feed built
            around what students actually want to find.
          </p>
        </ScrollReveal>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map(({ icon: Icon, title, description }, index) => (
            <ScrollReveal key={title} delay={index * 70}>
              <article className="landing-card h-full">
                <div className="landing-icon">
                  <Icon size={20} />
                </div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  {description}
                </p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="landing-section relative z-10 pt-0">
        <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <ScrollReveal>
            <p className="landing-eyebrow">Live campus feed</p>
            <h2 className="landing-title">Know what is happening right now.</h2>
            <p className="landing-subtitle mb-8">
              Open Hermes and immediately see the events that are starting soon,
              nearby, and worth your time.
            </p>
            <div className="space-y-3">
              {[
                "Browse without knowing what to search",
                "See verified source links and locations",
                "Save events and mark when you are going",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-zinc-400">
                  <Check size={16} className="text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal direction="right" delay={120}>
            <div className="landing-feed">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">Today at Waterloo</p>
                  <p className="mt-1 text-xs text-zinc-600">Starting soon</p>
                </div>
                <span className="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  Live
                </span>
              </div>
              <div className="space-y-3">
                {feedPreview.map(({ icon: Icon, iconClass, title, meta, pill, pillClass }, index) => (
                  <ScrollReveal key={title} direction="right" delay={180 + index * 100}>
                    <div className="landing-feed-item">
                      <div className={`landing-feed-icon ${iconClass}`}>
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{title}</p>
                        <p className="mt-1 text-xs text-zinc-500">{meta}</p>
                        <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${pillClass}`}>
                          {pill}
                        </span>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="landing-section relative z-10 pt-0">
        <ScrollReveal>
          <p className="landing-eyebrow">Browse your way</p>
          <h2 className="landing-title">Find the right vibe.</h2>
          <p className="landing-subtitle">
            Start broad, then narrow the feed to match the kind of day you want.
          </p>
        </ScrollReveal>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {vibes.map(({ icon: Icon, title, count, tone }, index) => (
            <ScrollReveal key={title} delay={index * 80}>
              <div className={`landing-vibe landing-vibe-${tone}`}>
                <Icon size={24} />
                <h3 className="mt-5 font-semibold text-white">{title}</h3>
                <p className="mt-1 text-xs text-zinc-500">{count}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="landing-section relative z-10 border-t border-white/[0.06]">
        <ScrollReveal>
          <p className="landing-eyebrow">How it works</p>
          <h2 className="landing-title">From signup to showing up.</h2>
          <p className="landing-subtitle">
            Hermes keeps onboarding short so discovery can start immediately.
          </p>
        </ScrollReveal>
        <div className="landing-steps">
          {[
            ["1", "Join with your UW email", "Create your campus account and keep your feed student-focused."],
            ["2", "Browse what is happening", "Explore events by time, vibe, location, and what is starting soon."],
            ["3", "Save it and show up", "Keep events close, mark that you are going, and stop missing out."],
          ].map(([number, title, description], index) => (
            <ScrollReveal key={number} delay={index * 110}>
              <div className="landing-step">
                <div className="landing-step-number">{number}</div>
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="landing-final-cta relative z-10">
        <ScrollReveal>
          <p className="landing-eyebrow">Your campus is waiting</p>
          <h2 className="landing-title mx-auto max-w-2xl">
            Spend less time searching.
            <br />
            Show up more.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-zinc-500">
            Join Hermes with your UW email and make campus easier to discover.
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
