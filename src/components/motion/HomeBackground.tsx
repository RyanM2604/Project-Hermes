"use client";

import { useEffect, useRef } from "react";

export function HomeBackground() {
  const background = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function syncVisibility() {
      background.current?.toggleAttribute("data-paused", document.hidden);
    }

    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  return <div ref={background} className="home-background" aria-hidden="true" />;
}
