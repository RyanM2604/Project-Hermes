"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  ArrowRight, 
  Mail, 
  CheckCircle2, 
  Map as MapIcon, 
  Video, 
  Pizza,
  Globe
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import BackgroundGlobe from '@/components/puslate-globe'

export default function App() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [activeTab, setActiveTab] = useState(0);

  const router = useRouter();

  const features = [
    { 
      title: "Free Food Alerts", 
      desc: "Never miss a MathSoc pizza night or EngSoc BBQ again.",
      icon: <Pizza className="text-orange-400" size={20} />,
      color: "from-orange-500/20"
    },
    { 
      title: "The Reels Feed", 
      desc: "See exactly what the vibe is before you walk across campus.",
      icon: <Video className="text-purple-400" size={20} />,
      color: "from-purple-500/20"
    },
    { 
      title: "Smart Map", 
      desc: "Find exactly which room in MC or E7 the event is in.",
      icon: <MapIcon className="text-blue-400" size={20} />,
      color: "from-blue-500/20"
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [features.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.toLowerCase().includes('@uwaterloo.ca')) {
      alert("Please use your @uwaterloo.ca email to join the waitlist.");
      return;
    }
    setStatus('loading');

    router.push(`/auth?email=${encodeURIComponent(email)}`);

    setTimeout(() => setStatus('success'), 1500);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans antialiased selection:bg-blue-500/30 overflow-hidden relative">
      
      {/* 1. Animated Background Map Pings */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
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

      {/* Nav */}
      <nav className="relative z-10 flex justify-between items-center px-6 md:px-12 py-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-12 h-9 flex items-center justify-center">
            <Image
              src="/hermes-logo.svg"
              alt="Hermes winged sandal"
              width={48}
              height={36}
              priority
            />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">Hermes</span>
        </div>
        <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/40 backdrop-blur-md text-[11px] font-bold text-zinc-400 tracking-wider">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          LIVE: 42 CAMPUS EVENTS
        </div>
      </nav>

      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-20 md:pt-32 pb-32 flex flex-col items-center text-center">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-12 cursor-default hover:border-zinc-700 transition-colors">
          <Globe size={12} className="text-blue-500" />
          UWaterloo Discovery Network
        </div>

        {/* Improved Typography: Using font-sans with heavy weights */}
        <h1 className="text-6xl md:text-[100px] font-extrabold text-white tracking-tighter mb-8 leading-[0.85]">
          See what&apos;s <br />
          <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-500 bg-clip-text text-transparent">
            happening at UW.
          </span>
        </h1>

        <p className="max-w-xl text-zinc-500 text-lg leading-relaxed mb-12 font-medium">
          The central feed for Waterloo campus life. <br className="hidden md:block" />
          Clubs, events, and free food alerts, synced in real-time.
        </p>

        {/* CTA Container */}
        <div className="w-full max-w-lg bg-zinc-900/30 border border-zinc-800/50 p-2 rounded-2xl backdrop-blur-xl mb-24 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
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

        {/* Feature Grid */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div 
              key={i}
              className={`text-left p-8 rounded-3xl border transition-all duration-700 ${
                activeTab === i 
                ? `bg-zinc-900/80 border-zinc-700 shadow-2xl scale-[1.02] translate-y-[-4px]` 
                : 'bg-transparent border-zinc-900 opacity-40 grayscale'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center mb-6">
                {f.icon}
              </div>
              <h3 className="text-white text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed font-medium">
                {f.desc}
              </p>
            </div>
          ))}
        </div>

      </main>

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
