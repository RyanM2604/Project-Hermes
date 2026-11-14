"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef, useState, type FocusEvent } from "react";

gsap.registerPlugin(useGSAP);

/** A group-chat sequence; the default HTML keeps the whole conversation readable. */
export function useHeroPreviewMotion(eventsKey: string) {
  const scope = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const syncPlayback = useRef<() => void>(() => {});
  const userPaused = useRef(false);
  const focused = useRef(false);
  const hovered = useRef(false);
  const [paused, setPaused] = useState(false);

  useGSAP(() => {
    const root = scope.current;
    if (!root || !eventsKey) return;
    const media = gsap.matchMedia();
    media.add({ motion: "(prefers-reduced-motion: no-preference)" }, (context) => {
      if (!context.conditions?.motion) return;
      const select = gsap.utils.selector(root);
      const messages = select("[data-chat]");
      const typing = select(".home-chat-typing");
      const dots = select(".home-chat-typing span");
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.5, defaults: { duration: 0.6, ease: "back.out(1.15)" } });
      timeline.current = tl;
      root.dataset.animated = "true";

      tl.set(messages, { autoAlpha: 0, y: 16, scale: 0.95 }, 0)
        .set(typing, { autoAlpha: 0 }, 0)
        .set(dots, { y: 0 }, 0)
        .set(select('[data-reaction="one"]'), { autoAlpha: 1 }, 0)
        .set(select('[data-reaction="two"]'), { autoAlpha: 0 }, 0)
        .set(select('[data-reaction="second-person"]'), { autoAlpha: 0, scale: 0.5 }, 0)
        .to(select('[data-chat="first"]'), { autoAlpha: 1, y: 0, scale: 1 }, 0.15)
        .to(select('[data-chat="second"]'), { autoAlpha: 1, y: 0, scale: 1 }, 1.35)
        // Only the other participant types: the indicator occupies their next message slot.
        .set(typing, { top: () => select('[data-chat="event"]')[0].offsetTop }, 2.15)
        .to(typing, { autoAlpha: 1, duration: 0.15 }, 2.2)
        .to(dots, { y: -4, stagger: 0.12, repeat: 3, yoyo: true, duration: 0.22, ease: "sine.inOut" }, 2.25)
        .to(typing, { autoAlpha: 0, duration: 0.15 }, 3.35)
        .to(select('[data-chat="event"]'), { autoAlpha: 1, y: 0, scale: 1, duration: 0.75 }, 3.5)
        .to(select('[data-chat="likes"]'), { autoAlpha: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(2)" }, 4.5)
        .set(select('[data-reaction="one"]'), { autoAlpha: 0 }, 5.1)
        .set(select('[data-reaction="two"]'), { autoAlpha: 1 }, 5.1)
        .to(select('[data-reaction="second-person"]'), { autoAlpha: 1, scale: 1, duration: 0.3 }, 5.1)
        .fromTo(select('[data-chat="likes"]'), { scale: 1.16 }, { scale: 1, duration: 0.35, ease: "back.out(2)" }, 5.1)
        .to(select('[data-chat="reply"]'), { autoAlpha: 1, y: 0, scale: 1 }, 5.85)
        .to(select('[data-chat="read"]'), { autoAlpha: 1, y: 0, scale: 1, duration: 0.4 }, 6.35)
        .set(typing, { top: () => select('[data-chat="cheer"]')[0].offsetTop }, 6.75)
        .to(typing, { autoAlpha: 1, duration: 0.15 }, 6.8)
        .to(dots, { y: -4, stagger: 0.12, repeat: 3, yoyo: true, duration: 0.22, ease: "sine.inOut" }, 6.85)
        .to(typing, { autoAlpha: 0, duration: 0.15 }, 7.95)
        .to(select('[data-chat="cheer"]'), { autoAlpha: 1, y: 0, scale: 1 }, 8.1)
        .addLabel("settled", 8.75)
        .to(messages, { autoAlpha: 0, y: -8, duration: 0.35, stagger: 0.035, ease: "power2.in" }, 13.2);

      let visible = false;
      let active = true;
      function sync() {
        if (!active) return;
        const play = visible && document.visibilityState === "visible" && !userPaused.current && !focused.current && !hovered.current;
        if (play) tl.resume(); else tl.pause();
        root!.dataset.playing = String(play);
      }
      syncPlayback.current = sync;
      if (userPaused.current || focused.current) tl.seek("settled").pause();
      const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0.1 });
      observer.observe(root);
      document.addEventListener("visibilitychange", sync);
      sync();

      return () => {
        active = false;
        observer.disconnect();
        document.removeEventListener("visibilitychange", sync);
        if (timeline.current === tl) { timeline.current = null; syncPlayback.current = () => {}; }
        root.removeAttribute("data-animated");
        root.removeAttribute("data-playing");
      };
    });
    return () => media.revert();
  }, { scope, dependencies: [eventsKey], revertOnUpdate: true });

  function showReadableFrame() {
    timeline.current?.seek("settled").pause();
    syncPlayback.current();
  }
  function togglePaused() {
    const next = !userPaused.current;
    userPaused.current = next;
    setPaused(next);
    if (next) showReadableFrame(); else syncPlayback.current();
  }
  function onFocusCapture(event: FocusEvent<HTMLDivElement>) {
    focused.current = Boolean(event.target.closest("a"));
    if (focused.current) showReadableFrame(); else syncPlayback.current();
  }
  function onBlurCapture(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { focused.current = false; syncPlayback.current(); }
  }
  function onPointerEnter() { hovered.current = true; showReadableFrame(); }
  function onPointerLeave() { hovered.current = false; syncPlayback.current(); }

  return { scope, paused, togglePaused, onFocusCapture, onBlurCapture, onPointerEnter, onPointerLeave };
}
