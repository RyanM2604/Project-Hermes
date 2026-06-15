"use client";

import { useEffect, useRef } from "react";

interface TrackImpressionProps {
  children: React.ReactNode;
  eventId: string;
}

const trackedImpressions = new Set<string>();
const anonymousSessionStorageKey = "hermes_anonymous_session_id";

function getAnonymousSessionId() {
  const existingSessionId = window.sessionStorage.getItem(
    anonymousSessionStorageKey,
  );

  if (existingSessionId) {
    return existingSessionId;
  }

  const sessionId = crypto.randomUUID().replaceAll("-", "");
  window.sessionStorage.setItem(anonymousSessionStorageKey, sessionId);

  return sessionId;
}

export function TrackImpression({ children, eventId }: TrackImpressionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || trackedImpressions.has(eventId)) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.5) {
          return;
        }

        trackedImpressions.add(eventId);
        observer.disconnect();

        void fetch("/api/interactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "impression",
            anonymousSessionId: getAnonymousSessionId(),
            eventId,
            metadata: {
              surface: "event_feed",
            },
          }),
          keepalive: true,
        }).catch(() => {
          // Interaction logging must not disrupt feed browsing.
        });
      },
      { threshold: 0.5 },
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [eventId]);

  return (
    <div ref={containerRef} className="min-w-0">
      {children}
    </div>
  );
}
