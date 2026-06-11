"use client";

import { useEffect, useRef } from "react";

import { logClientInteraction } from "@/lib/interactions/log-client-interaction";

interface TrackImpressionProps {
  children: React.ReactNode;
  eventId: string;
}

const trackedImpressions = new Set<string>();

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

        logClientInteraction({
          action: "impression",
          eventId,
          metadata: {
            surface: "event_feed",
          },
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
    <div ref={containerRef} className="min-w-0 empty:hidden">
      {children}
    </div>
  );
}
