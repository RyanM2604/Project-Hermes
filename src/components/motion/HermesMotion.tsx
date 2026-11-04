"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type MotionVariant = "home" | "events" | "detail" | "auth" | "coming-soon";

interface HermesMotionProps {
  children: React.ReactNode;
  variant: MotionVariant;
}

export function HermesMotion({ children, variant }: HermesMotionProps) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const media = gsap.matchMedia();

    media.add(
      {
        animate: "(prefers-reduced-motion: no-preference)",
        compact: "(max-width: 700px)",
        stack: "(min-width: 901px)",
      },
      (context) => {
        if (!context.conditions?.animate) return;

        const compact = Boolean(context.conditions.compact);
        const stack = Boolean(context.conditions.stack);
        const select = gsap.utils.selector(scope);
        const isHome = variant === "home";
        const distance = isHome ? (compact ? 22 : 36) : (compact ? 12 : 18);

        function reveal(target: string, trigger: string, stagger = 0) {
          const elements = select(target);
          const anchor = select(trigger)[0];
          if (!elements.length || !anchor) return;

          gsap.fromTo(
            elements,
            { y: distance, opacity: isHome ? 0.18 : 0.55 },
            {
              y: 0,
              opacity: 1,
              duration: isHome ? (compact ? 0.72 : 0.85) : (compact ? 0.52 : 0.62),
              ease: "power2.out",
              stagger,
              clearProps: "transform,opacity",
              scrollTrigger: {
                trigger: anchor,
                start: "top 76%",
                once: true,
              },
            },
          );
        }

        if (variant === "home") {
          const title = select('[data-motion="home-title"]');
          const copy = select('[data-motion="home-copy"]');
          const actions = select('[data-motion="home-actions"]');
          const cover = select('[data-motion="home-cover"]');
          const pin = select('[data-motion="home-pin"]');
          const opening = gsap.timeline({ defaults: { ease: "power3.out" } });

          if (title.length) opening.fromTo(title, { y: compact ? 24 : 38, opacity: 0 }, { y: 0, opacity: 1, duration: 1.05, clearProps: "transform,opacity" }, 0);
          if (copy.length) opening.fromTo(copy, { y: compact ? 18 : 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, clearProps: "transform,opacity" }, 0.28);
          if (actions.length) opening.fromTo(actions, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.75, clearProps: "transform,opacity" }, 0.42);
          if (cover.length) opening.fromTo(cover, { y: compact ? 30 : 55, rotation: compact ? 0 : 2, opacity: 0.3 }, { y: 0, rotation: 0, opacity: 1, duration: 1.2, clearProps: "transform,opacity" }, 0.12);
          if (pin.length) opening.fromTo(pin, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, clearProps: "transform,opacity" }, 0.75);

          reveal('[data-motion="intro-item"]', '[data-motion="intro-section"]', 0.08);
          if (stack) {
            const cards = select('[data-motion="preview-tile"]');
            cards.slice(0, -1).forEach((card, index) => {
              gsap.to(card, {
                scale: 0.96,
                rotation: -1,
                transformOrigin: "center top",
                ease: "none",
                scrollTrigger: {
                  trigger: cards[index + 1],
                  start: "top 85%",
                  end: "top 124px",
                  scrub: 0.55,
                },
              });
            });
          } else {
            reveal('[data-motion="preview-tile"]', '[data-motion="preview-section"]', compact ? 0 : 0.08);
          }
          reveal('[data-motion="method-item"]', '[data-motion="method-section"]', 0.08);
          reveal('[data-motion="join-item"]', '[data-motion="join-section"]', 0.08);
        }

        if (variant === "events") {
          reveal('[data-motion="events-heading"]', '[data-motion="events-heading"]');
          reveal('[data-motion="soon-rail"]', '[data-motion="soon-rail"]');
        }

        if (variant === "detail") {
          reveal('[data-motion="detail-heading"]', '[data-motion="detail-heading"]');
          reveal('[data-motion="detail-aside"]', '[data-motion="detail-aside"]');
        }

        if (variant === "auth") {
          reveal('[data-motion="auth-panel"]', '[data-motion="auth-panel"]');
        }

        if (variant === "coming-soon") {
          reveal('[data-motion="coming-soon-content"]', '[data-motion="coming-soon-content"]');
        }
      },
    );

    return () => media.revert();
  }, { scope });

  return <div ref={scope}>{children}</div>;
}
