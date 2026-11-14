"use client";

import { useId, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, X } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { AuthForm } from "./AuthForm";

gsap.registerPlugin(useGSAP);

export function SignInModal() {
  const titleId = useId();
  const pathname = usePathname();
  const trigger = useRef<HTMLAnchorElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const contents = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const target = useRef<DOMRect | null>(null);
  const animation = useRef<gsap.core.Timeline | null>(null);
  const closing = useRef(false);
  const previousOverflow = useRef("");

  const { contextSafe } = useGSAP(() => () => {
    if (dialog.current?.open) {
      dialog.current.close();
      document.documentElement.style.setProperty("overflow", previousOverflow.current);
    }
  }, { scope: dialog, dependencies: [pathname], revertOnUpdate: true });

  function finishClose() {
    dialog.current?.close();
    document.documentElement.style.setProperty("overflow", previousOverflow.current);
    closing.current = false;
    trigger.current?.focus({ preventScroll: true });
  }

  function open() {
    contextSafe(() => {
      const modal = dialog.current;
      const button = trigger.current;
      if (!modal || !button || modal.open) return;
      const from = button.getBoundingClientRect();
      const buttonStyle = getComputedStyle(button);
      previousOverflow.current = document.documentElement.style.overflow;
      document.documentElement.style.setProperty("overflow", "hidden");
      gsap.set(modal, { clearProps: "transform,opacity,backgroundColor,borderRadius" });
      gsap.set(contents.current, { clearProps: "opacity,visibility,transform" });
      modal.showModal();
      const to = modal.getBoundingClientRect();
      target.current = to;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const background = buttonStyle.backgroundColor === "rgba(0, 0, 0, 0)" ? getComputedStyle(document.documentElement).getPropertyValue("--hm-paper").trim() : buttonStyle.backgroundColor;
      const finalBackground = getComputedStyle(modal).backgroundColor;
      const x = from.left - to.left;
      const y = from.top - to.top;
      const scaleX = from.width / to.width;
      const scaleY = from.height / to.height;

      gsap.set(modal, { autoAlpha: 1, x: reduced ? 0 : x, y: reduced ? 0 : y, scaleX: reduced ? 1 : scaleX, scaleY: reduced ? 1 : scaleY, backgroundColor: background, "--sign-in-shade": 0 });
      gsap.set(contents.current, { autoAlpha: 0, y: reduced ? 0 : 12 });
      animation.current = gsap.timeline({ defaults: { ease: "power3.inOut" } })
        .to(modal, { scaleX: reduced ? 1 : scaleX * 1.08, scaleY: reduced ? 1 : scaleY * 1.08, duration: reduced ? 0 : 0.14 })
        .to(modal, { x: 0, y: 0, scaleX: 1, scaleY: 1, backgroundColor: finalBackground, borderRadius: 8, "--sign-in-shade": 0.45, duration: reduced ? 0.15 : 0.65 }, reduced ? 0 : 0.12)
        .to(contents.current, { autoAlpha: 1, y: 0, duration: reduced ? 0.15 : 0.36, ease: "power3.out" }, reduced ? 0 : 0.56)
        .call(() => heading.current?.focus({ preventScroll: true }));
    })();
  }

  function close() {
    contextSafe(() => {
      if (!dialog.current?.open || closing.current) return;
      closing.current = true;
      animation.current?.kill();
      const from = trigger.current?.getBoundingClientRect();
      const to = target.current;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      animation.current = gsap.timeline({ onComplete: finishClose })
        .to(contents.current, { autoAlpha: 0, duration: 0.1 }, 0)
        .to(dialog.current, {
          x: !reduced && from && to ? from.left - to.left : 0,
          y: !reduced && from && to ? from.top - to.top : 0,
          scaleX: !reduced && from && to ? from.width / to.width : 1,
          scaleY: !reduced && from && to ? from.height / to.height : 1,
          autoAlpha: 0, "--sign-in-shade": 0, duration: reduced ? 0.15 : 0.35, ease: "power3.inOut",
        }, 0);
    })();
  }

  return <>
    <Link ref={trigger} href="/login" className="hermes-nav-signup" onNavigate={(event) => {
      if (!dialog.current?.showModal) return;
      event.preventDefault();
      open();
    }}><span>Sign in</span><ArrowUpRight size={16} aria-hidden="true" /></Link>
    <dialog ref={dialog} className="hm-auth sign-in-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }}>
      <div ref={contents}>
        <button type="button" className="sign-in-close" onClick={close} aria-label="Close sign in"><X size={20} aria-hidden="true" /></button>
        <h1 ref={heading} id={titleId} tabIndex={-1}>Log in to Hermes</h1>
        <p className="hm-auth-intro">Use your @uwaterloo.ca email to save events and RSVP.</p>
        <div className="hm-auth-form"><AuthForm mode="login" /></div>
        <p className="hm-auth-switch">Need an account? <Link href="/signup" className="hermes-text-link">Sign up</Link></p>
      </div>
    </dialog>
  </>;
}
