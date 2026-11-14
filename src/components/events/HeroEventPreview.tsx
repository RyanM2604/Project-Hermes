"use client";

import Image from "next/image";
import { useState } from "react";
import { BatteryFull, ChevronLeft, ChevronRight, Mic, Pause, Play, Plus, Signal, ThumbsUp, Wifi } from "lucide-react";
import { useHeroPreviewMotion } from "./useHeroPreviewMotion";
import type { HeroPreviewEvent } from "@/lib/events/hero-preview";

const eventDate = new Intl.DateTimeFormat("en-CA", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto",
});

function ChatAvatar({ person }: { person: "alex" | "maya" | "sam" }) {
  return <span className={`home-chat-person home-chat-person-${person}`} aria-hidden="true" />;
}

export function HeroEventPreview({ events }: { events: HeroPreviewEvent[] }) {
  const [failedImage, setFailedImage] = useState(false);
  const [featured] = events;
  const { scope, paused, togglePaused, onFocusCapture, onBlurCapture, onPointerEnter, onPointerLeave } = useHeroPreviewMotion(featured?.id ?? "");
  if (!featured) return null;

  return (
    <div ref={scope} className="home-event-scene" role="group" aria-label="An illustrated group chat about finding a real Waterloo event" onFocusCapture={onFocusCapture} onBlurCapture={onBlurCapture}>
      <button type="button" className="home-event-motion-toggle" onClick={togglePaused} aria-label={paused ? "Play preview animation" : "Pause preview animation"} title={paused ? "Play animation" : "Pause animation"}>
        {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
      </button>
      <div className="home-phone-screen">
      <div className="home-phone-status" aria-hidden="true">
        <span>9:41</span><span className="home-phone-notch" />
        <span className="home-phone-indicators"><Signal size={14} /><Wifi size={14} /><BatteryFull size={19} /></span>
      </div>
      <div className="home-chat-heading"><ChevronLeft size={25} aria-hidden="true" /><div className="home-chat-contact"><span className="home-chat-avatar" aria-hidden="true"><ChatAvatar person="alex" /><ChatAvatar person="maya" /><ChatAvatar person="sam" /></span><span>&apos;loo crew <ChevronRight size={11} aria-hidden="true" /></span></div>
      </div>
      <div className="home-chat-thread">
        <div className="home-chat-message-row" data-chat="first" aria-label="Alex says"><ChatAvatar person="alex" /><p className="home-chat-message home-chat-incoming">what’s the move after class?</p></div>
        <p className="home-chat-message home-chat-outgoing" data-chat="second">anything but the library</p>
        <div className="home-chat-share" data-chat="event" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
          <ChatAvatar person="maya" />
          <p className="home-chat-message home-chat-incoming">wait. found something</p>
          <article className="home-chat-event">
            <div className="home-chat-event-image">
              {featured.imageUrl && !failedImage ? <Image src={featured.imageUrl} alt="" fill unoptimized loading="eager" fetchPriority="high" sizes="(max-width: 700px) 280px, 320px" onError={() => setFailedImage(true)} /> : <span>{featured.clubName}</span>}
              <span className="home-chat-event-source">hermes</span>
            </div>
            <div className="home-chat-event-details">
              <h2>{featured.title}</h2>
              <p><time dateTime={featured.startTime}>{eventDate.format(new Date(featured.startTime))}</time></p>
              <p>{featured.locationName.split(",")[0]}</p>
            </div>
          </article>
          <span className="home-chat-reactions" data-chat="likes" role="img" aria-label="Two people liked the shared event">
            <ThumbsUp size={14} fill="currentColor" aria-hidden="true" />
            <span className="home-chat-reaction-count" aria-hidden="true"><span data-reaction="one">1</span><span data-reaction="two">2</span></span>
            <span className="home-chat-reaction-people"><ChatAvatar person="alex" /><span data-reaction="second-person"><ChatAvatar person="sam" /></span></span>
          </span>
        </div>
        <p className="home-chat-message home-chat-outgoing home-chat-yes" data-chat="reply">bet</p>
        <span className="home-chat-read" data-chat="read" aria-hidden="true">Delivered</span>
        <div className="home-chat-message-row" data-chat="cheer" aria-label="Sam says"><ChatAvatar person="sam" /><p className="home-chat-message home-chat-incoming">yesssss</p></div>
        <div className="home-chat-typing" aria-hidden="true"><span /><span /><span /></div>
      </div>
      <div className="home-phone-compose" aria-hidden="true"><span className="home-phone-compose-plus"><Plus size={22} /></span><span className="home-phone-compose-field">iMessage<Mic size={17} /></span></div>
      <div className="home-phone-home-indicator" aria-hidden="true" />
      </div>
    </div>
  );
}
