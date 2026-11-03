"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ThemeToggle } from "./ThemeToggle";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Events", href: "/events" },
  { label: "Clubs", href: "/clubs" },
  { label: "Map", href: "/map" },
];

export function SiteNavbar({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const update = () => setIsScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return <header className={`hermes-header${isScrolled ? " is-scrolled" : ""}`}><nav className="hermes-nav hermes-container" aria-label="Main navigation">
    <div className="hermes-nav-content">
      <Link href="/" className="hermes-brand" onClick={() => setIsOpen(false)} aria-label="Hermes home"><Image src="/logo.svg" alt="" width={36} height={36}/><span className="hermes-brand-word">hermes<span className="brand-period">.</span></span></Link>
      <div className={`hermes-nav-links${isOpen ? " is-open" : ""}`}>{navItems.map((item) => { const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} onClick={() => setIsOpen(false)}>{item.label}</Link>; })}<div className="hermes-nav-theme-mobile"><ThemeToggle showLabel /></div></div>
      <div className="hermes-nav-action"><div className="hermes-nav-theme-desktop"><ThemeToggle /></div>{isAuthenticated ? <LogoutButton className="hermes-nav-signup"/> : <Link href="/signup" className="hermes-nav-signup"><span className="hermes-nav-join-full">Join Hermes</span><span className="hermes-nav-join-short">Join</span><span aria-hidden="true">↗</span></Link>}</div>
      <button type="button" className="hermes-nav-toggle" onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} aria-label={isOpen ? "Close navigation" : "Open navigation"}>{isOpen ? <X size={22}/> : <Menu size={22}/>}</button>
    </div>
  </nav></header>;
}
