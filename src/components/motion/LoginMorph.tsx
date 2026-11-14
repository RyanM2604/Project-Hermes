"use client";

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

gsap.registerPlugin(useGSAP);

type MorphDestination = "/login" | "/signup" | "/events";
const LoginMorphContext = createContext<((source: HTMLAnchorElement, href: MorphDestination) => void) | null>(null);

function silhouette(rect: DOMRect, outset = 0, radius = 4) {
  return `inset(${rect.top - outset}px ${innerWidth - rect.right - outset}px ${innerHeight - rect.bottom - outset}px ${rect.left - outset}px round ${radius}px)`;
}

/** Lives in the shared layout so the button's surface survives the route change. */
export function LoginMorphProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const content = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLSpanElement>(null);
  const destination = useRef<MorphDestination>("/login");
  const wordmark = useRef<HTMLDivElement>(null);
  const active = useRef(false);
  const revealing = useRef(false);
  const sequence = useRef<gsap.core.Timeline | null>(null);
  const recovery = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousOverflow = useRef("");

  const reset = useCallback(() => {
    sequence.current?.kill();
    if (recovery.current) clearTimeout(recovery.current);
    if (active.current) document.documentElement.style.setProperty("overflow", previousOverflow.current);
    active.current = false;
    revealing.current = false;
    if (content.current) {
      content.current.inert = false;
      content.current.removeAttribute("aria-busy");
    }
    if (overlay.current) overlay.current.style.visibility = "hidden";
    surface.current?.style.removeProperty("will-change");
  }, []);

  const { contextSafe } = useGSAP(() => reset, { scope: overlay });

  const begin = (source: HTMLAnchorElement, href: MorphDestination) => contextSafe(() => {
    if (active.current || !overlay.current || !surface.current) return;
    const rect = source.getBoundingClientRect();
    const style = getComputedStyle(source);
    destination.current = href;
    if (caption.current) caption.current.textContent = source.textContent;
    previousOverflow.current = document.documentElement.style.overflow;
    active.current = true;
    document.documentElement.style.setProperty("overflow", "hidden");
    if (content.current) {
      content.current.inert = true;
      content.current.setAttribute("aria-busy", "true");
    }

    gsap.set(overlay.current, { autoAlpha: 1 });
    gsap.set(surface.current, { autoAlpha: 1, clipPath: silhouette(rect), backgroundColor: style.backgroundColor, willChange: "clip-path" });
    gsap.set(label.current, {
      left: rect.left, top: rect.top, width: rect.width, height: rect.height,
      color: style.color, fontSize: style.fontSize, fontWeight: style.fontWeight,
      autoAlpha: 1, scale: 1, y: 0,
    });
    const channels = style.color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
    gsap.set(wordmark.current, { autoAlpha: 0, y: 16, scale: 0.94, color: style.color });
    const logo = wordmark.current?.querySelector("img");
    if (logo) gsap.set(logo, { filter: channels.reduce((sum, channel) => sum + channel, 0) > 384 ? "invert(1)" : "none" });

    sequence.current = gsap.timeline({ defaults: { ease: "power3.inOut" } })
      .to(surface.current, { clipPath: silhouette(rect, 10, 12), duration: 0.18 })
      .to(label.current, { scale: 1.06, duration: 0.18 }, 0)
      .to(surface.current, { clipPath: "inset(0px 0px 0px 0px round 0px)", duration: 0.62 }, 0.16)
      .to(label.current, { autoAlpha: 0, y: -8, duration: 0.22 }, 0.22)
      .to(wordmark.current, { autoAlpha: 1, y: 0, scale: 1, duration: 0.4, ease: "power3.out" }, 0.44)
      .call(() => router.push(href), [], 1.05);

    // A failed or unusually slow client navigation must never leave a blocking cover.
    recovery.current = setTimeout(() => {
      reset();
      window.location.assign(href);
    }, 12000);
  })();

  useEffect(() => {
    if (!active.current) return;
    if (pathname !== destination.current) {
      reset();
      return;
    }

    const reveal = contextSafe(() => {
      const panel = content.current?.querySelector<HTMLElement>(destination.current === "/events" ? ".hm-events-hero" : ".hm-auth");
      if (!panel || revealing.current) return;
      revealing.current = true;
      // This shared-element entrance replaces the destination's ordinary arrival.
      gsap.killTweensOf(panel);
      gsap.set(panel, { clearProps: "transform,opacity" });
      const rect = panel.getBoundingClientRect();
      const background = getComputedStyle(panel).backgroundColor;
      const color = background === "rgba(0, 0, 0, 0)" ? getComputedStyle(document.documentElement).getPropertyValue("--hm-paper").trim() : background;
      const pieces = Array.from(panel.children);
      gsap.set(panel, { visibility: "hidden" });

      sequence.current = gsap.timeline({ defaults: { ease: "power3.inOut" } })
        .to(wordmark.current, { autoAlpha: 0, y: -12, duration: 0.2 }, 0)
        .to(surface.current, { clipPath: silhouette(rect, 0, 4), backgroundColor: color, duration: 0.68 }, 0.06)
        .set(panel, { visibility: "visible" }, 0.7)
        .to(surface.current, { autoAlpha: 0, duration: 0.18 }, 0.7)
        .fromTo(pieces, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.48, stagger: 0.045, ease: "power3.out", clearProps: "opacity,transform" }, 0.7)
        .call(() => {
          reset();
          const heading = panel.querySelector("h1");
          if (heading) {
            heading.setAttribute("tabindex", "-1");
            heading.focus({ preventScroll: true });
          }
        });
    });

    // The pathname can commit before the streamed destination is mounted.
    const observer = new MutationObserver(reveal);
    observer.observe(content.current!, { childList: true, subtree: true });
    reveal();
    return () => observer.disconnect();
  }, [pathname, contextSafe, reset]);

  return (
    <LoginMorphContext.Provider value={begin}>
      <div ref={content} className="hermes-route-content">{children}</div>
      <div ref={overlay} className="login-morph" aria-hidden="true">
        <div ref={surface} className="login-morph-surface" />
        <div ref={label} className="login-morph-label"><span ref={caption} /><ArrowUpRight size={23} /></div>
        <div ref={wordmark} className="login-morph-wordmark"><Image src="/logo.svg" alt="" width={112} height={112} /><span className="login-morph-name">hermes<span>.</span></span></div>
      </div>
    </LoginMorphContext.Provider>
  );
}

export function MorphLink({ children, className, href = "/login" }: { children: ReactNode; className: string; href?: MorphDestination }) {
  const begin = useContext(LoginMorphContext);
  const anchor = useRef<HTMLAnchorElement>(null);

  return (
    <Link ref={anchor} href={href} className={className} prefetch onNavigate={(event) => {
      if (!begin || !anchor.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      event.preventDefault();
      begin(anchor.current, href);
    }}>{children}</Link>
  );
}
