"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, MapPin, RotateCw, Users, X } from "lucide-react";
import { RSVPButton } from "@/components/events/RSVPButton";
import { eventTagFilters, parseEventTag } from "@/lib/events/filters";
import { filterMapEvents, groupMapEvents, torontoDateKey, type MapEvent, type MapSnapshot } from "@/lib/events/map";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { EventTag } from "@/types/event";

const MapCanvas = dynamic(() => import("./MapCanvas"), { ssr: false,
  loading: () => <div className="hm-map-loading" role="status">Loading map…</div>,
});
const timeFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit" });
const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", weekday: "long", month: "long", day: "numeric" });
const previewTimeFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function EventMap({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [snapshot, setSnapshot] = useState<MapSnapshot | null>(null);
  const [clock, setClock] = useState<number | null>(null);
  const [lastSuccess, setLastSuccess] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [nowOnly, setNowOnly] = useState(false);
  const [tag, setTag] = useState<EventTag>();
  const [selection, setSelection] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const refreshRef = useRef<() => void>(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);
  const selectVenue = useCallback((id: string) => { setSelection(id); setListOpen(true); }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let queued = false;
    let serverOffset = 0;
    let lastDay: string | null = null;
    let lastPoll = Date.now();
    const controller = new AbortController();
    async function requestRefresh() {
      if (!active) return;
      if (inFlight) { queued = true; return; }
      inFlight = true;
      setRefreshing(true);
      try {
        const response = await fetch("/api/map", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        if (!response.ok) throw new Error("unavailable");
        const body = await response.json() as MapSnapshot;
        if (!Array.isArray(body.events) || !Number.isFinite(Date.parse(body.serverTime)) ||
          !Number.isFinite(Date.parse(body.refreshedAt)) || typeof body.countsAvailable !== "boolean") throw new Error("invalid snapshot");
        if (!active) return;
        serverOffset = Date.parse(body.refreshedAt) - Date.now();
        setSnapshot(body);
        setClock(Date.now() + serverOffset);
        setLastSuccess(Date.now());
        lastDay = torontoDateKey(new Date(Date.now() + serverOffset));
        setProblem(null);
      } catch {
        if (active) setProblem("We couldn’t refresh events. Try again in a moment.");
      } finally {
        inFlight = false;
        if (active) {
          setRefreshing(false);
          if (queued) { queued = false; void requestRefresh(); }
        }
      }
    }
    refreshRef.current = () => { void requestRefresh(); };
    void requestRefresh();

    let cleanupChannel = () => {};
    try {
      const supabase = createSupabaseBrowserClient();
      const channel = supabase.channel("event-map-revision").on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "event_map_revision" },
        () => { if (document.visibilityState === "visible") void requestRefresh(); },
      ).subscribe(async status => {
        if (!active) return;
        setConnected(false);
        if (status === "SUBSCRIBED") {
          // A channel can connect before its migration is installed. Confirm
          // the public signal exists before calling the counts live.
          const { data, error } = await supabase.from("event_map_revision").select("revision").eq("id", true).maybeSingle();
          if (active) setConnected(!error && data !== null);
          void requestRefresh();
        }
      });
      cleanupChannel = () => { void supabase.removeChannel(channel); };
    } catch {
      // Polling and the event list remain usable without a realtime connection.
    }
    const foreground = () => {
      if (document.visibilityState === "visible") { lastPoll = Date.now(); void requestRefresh(); }
    };
    const offline = () => { setConnected(false); setProblem("You’re offline. Showing the last events we loaded."); };
    // ponytail: full snapshots suit the current city feed; add per-event patches
    // only if measured traffic makes these 30-second recovery reads costly.
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      const serverNow = now + serverOffset;
      setClock(serverNow);
      const day = torontoDateKey(new Date(serverNow));
      if ((lastDay && day !== lastDay) || now - lastPoll >= 30000) {
        lastPoll = now;
        void requestRefresh();
      }
    }, 1000);
    document.addEventListener("visibilitychange", foreground);
    window.addEventListener("online", foreground);
    window.addEventListener("offline", offline);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      cleanupChannel();
      document.removeEventListener("visibilitychange", foreground);
      window.removeEventListener("online", foreground);
      window.removeEventListener("offline", offline);
      refreshRef.current = () => {};
    };
  }, []);

  const events = useMemo(() => snapshot && clock ? filterMapEvents(snapshot.events, new Date(clock), { nowOnly, tag }) : [], [snapshot, clock, nowOnly, tag]);
  const groups = useMemo(() => groupMapEvents(events), [events]);
  const selected = selection?.startsWith("event:") ? events.filter(event => `event:${event.id}` === selection) : events.filter(event => event.venue?.id === selection);
  const unlocated = events.filter(event => event.locationStatus === "unlocated");
  const online = events.filter(event => event.locationStatus === "online");
  const isFresh = lastSuccess > 0 && (clock ?? 0) - (snapshot ? Date.parse(snapshot.refreshedAt) : 0) < 45000 && !problem;
  const live = connected && isFresh && snapshot?.countsAvailable;
  const status = !snapshot ? refreshing ? "Loading events" : "Events unavailable" : live ? "Live" : problem || !isFresh ? "Updates paused" : !snapshot.countsAvailable ? "Counts unavailable" : "Refreshing every 30s";

  function eventRow(event: MapEvent) {
    const active = selected.some(item => item.id === event.id);
    const ongoing = clock && +new Date(event.startTime) <= clock;
    const timeLabel = ongoing
      ? +new Date(event.endTime) - +new Date(event.startTime) > 86400000 ? "Ongoing" : "On now"
      : timeFormatter.format(new Date(event.startTime));
    const venueLabel = event.locationStatus === "online" ? "Online" : event.venue?.name ?? event.locationName;
    return <li key={event.id}>
      <button className="hm-map-event" type="button" aria-pressed={active} onClick={() => { setSelection(event.venue?.id ?? `event:${event.id}`); setListOpen(true); }}>
        <span className="hm-map-event-copy">
          <span className="hm-map-event-time">{timeLabel}{event.isFreeFood && <span>Free food</span>}</span>
          <strong>{event.title}</strong>
          <span className="hm-map-event-organizer">{event.clubName}</span>
        </span>
        {event.imageUrl && <Image className="hm-map-event-image" src={event.imageUrl} alt="" width={56} height={72} unoptimized />}
        <span className="hm-map-event-foot"><span><MapPin size={13} />{venueLabel}</span><span className="hm-map-going"><Users size={13} />{event.goingCount === null ? "Unavailable" : `${event.goingCount} going`}</span></span>
      </button>
    </li>;
  }

  return <main className="hm-map-page">
    <div className="hermes-container">
      <header className="hm-map-heading">
        <h1>Event map</h1>
        <div className="hm-map-date">
          <span>{clock ? dateFormatter.format(new Date(clock)) : "Today in Waterloo"}</span>
          <div className="hm-map-date-actions">
            <span className="hm-map-status" data-live={Boolean(live)}><i aria-hidden="true" />{status}</span>
            <button type="button" className="hm-map-refresh" aria-label="Refresh events" title="Refresh events" disabled={refreshing} onClick={refresh}><RotateCw size={15} /><span>{refreshing ? "Refreshing…" : "Refresh"}</span></button>
          </div>
        </div>
      </header>
      <div className="hm-map-toolbar">
        <div className="hm-map-period" role="group" aria-label="Event time"><button type="button" aria-pressed={!nowOnly} onClick={() => setNowOnly(false)}>Today</button><button type="button" aria-pressed={nowOnly} onClick={() => setNowOnly(true)}>Happening now</button></div>
        <div className="hm-map-filter-options">
          <label className="hm-map-category"><span>Category</span><select aria-label="Category" value={tag ?? ""} onChange={event => setTag(parseEventTag(event.target.value))}><option value="">All categories</option>{eventTagFilters.map(item => <option key={item.tag} value={item.tag}>{item.label}</option>)}</select></label>
        </div>
      </div>
      {problem && <div className="hm-map-notice" role="status"><p>{problem}{snapshot && ` Last updated ${timeFormatter.format(new Date(snapshot.refreshedAt))}.`}</p><button type="button" onClick={refresh} disabled={refreshing}>Try again</button></div>}
      {snapshot && !snapshot.countsAvailable && <p className="hm-map-notice" role="status">Going counts are temporarily unavailable. Event locations are still shown.</p>}
      <div className="hm-map-workspace">
        <div className="hm-map-surface"><MapCanvas groups={groups} selectedVenue={selected[0]?.venue?.id ?? null} onSelect={selectVenue} /></div>
        <aside className="hm-map-sidebar" aria-label="Events in Waterloo">
          <div className="hm-map-list-head"><h2 id="map-events" tabIndex={-1}>{nowOnly ? "On right now" : "On today"} <span>{events.length}</span></h2><button type="button" className="hm-map-list-toggle" aria-expanded={listOpen} aria-controls="map-event-list" onClick={() => setListOpen(value => !value)}>{listOpen ? "Hide" : "Show"} list<ChevronDown size={16} /></button></div>
          <div id="map-event-list" className="hm-map-list-body" data-open={listOpen}>
            {selected.length > 0 && <section className="hm-map-preview" aria-label="Selected events"><div className="hm-map-preview-head"><h3>{selected[0].venue?.name ?? "Event details"}</h3><button type="button" aria-label="Close event preview" onClick={() => setSelection(null)}><X size={18} /></button></div>{selected.map(event => <article key={event.id}><p className="hm-map-event-time">{previewTimeFormatter.format(new Date(event.startTime))} – {previewTimeFormatter.format(new Date(event.endTime))}{event.endTimeEstimated && " (estimated end)"}</p><h4>{event.title}</h4><p>{event.clubName} · {event.locationName}</p><p><strong>{event.goingCount === null ? "Going count unavailable" : `${event.goingCount} going`}</strong></p><Link href={`/events/${event.id}`}>Event details <ArrowUpRight size={15} /></Link><RSVPButton eventId={event.id} isAuthenticated={isAuthenticated} onSuccess={refresh} /></article>)}</section>}
            <p className="hm-map-result-count" role="status" aria-live="polite">{snapshot ? `${groups.length} mapped ${groups.length === 1 ? "venue" : "venues"}${unlocated.length ? ` · ${unlocated.length} not mapped yet` : ""}` : refreshing ? "Finding today’s events…" : "Events couldn’t load."}</p>
            {snapshot && events.length === 0 && <div className="hm-map-empty"><h3>{nowOnly ? "A quiet moment." : "No events to show yet."}</h3><p>{nowOnly ? "Try Today to find something coming up." : tag ? "Try another category." : "Check back later or explore upcoming events."}</p>{nowOnly ? <button type="button" onClick={() => setNowOnly(false)}>See today’s events</button> : <Link href="/events">Explore upcoming events <ArrowUpRight size={15} /></Link>}</div>}
            {snapshot && events.length > 0 && groups.length === 0 && <p className="hm-map-list-note">These events don’t have confirmed map locations yet. Their details are available below.</p>}
            <ul className="hm-map-event-list">{events.filter(event => event.locationStatus === "located").map(eventRow)}</ul>
            {unlocated.length > 0 && <section><h3 className="hm-map-section-label">Not on the map yet <span>{unlocated.length}</span></h3><p className="hm-map-list-note">Locations are listed below; map pins aren’t available yet.</p><ul className="hm-map-event-list">{unlocated.map(eventRow)}</ul></section>}
            {online.length > 0 && <section><h3 className="hm-map-section-label">Online</h3><ul className="hm-map-event-list">{online.map(eventRow)}</ul></section>}
          </div>
        </aside>
      </div>
      <footer className="hm-map-footer"><p>Heat reflects “Going” RSVPs on Hermes, not checked-in attendance. Events with no RSVPs still appear as pins.</p><a href="https://uwaterloo.ca/map/" target="_blank" rel="noreferrer">Campus locations: University of Waterloo <ArrowUpRight size={13} /></a></footer>
    </div>
  </main>;
}
