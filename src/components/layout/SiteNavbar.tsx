"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { LogoutButton } from "@/components/auth/LogoutButton";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Events", href: "/events" },
  { label: "Clubs", href: "/clubs" },
  { label: "Map", href: "/map" },
];

interface SiteNavbarProps {
  isAuthenticated: boolean;
}

export function SiteNavbar({ isAuthenticated }: SiteNavbarProps) {
  const pathname = usePathname();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-5 py-5 md:px-10 md:py-7">
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          aria-label="Hermes home"
          onClick={() => setIsNavOpen(false)}
        >
          <span className="flex h-10 w-14 items-center justify-center">
            <Image
              src="/hermes-logo.png"
              alt=""
              width={64}
              height={36}
              className="scale-[1.8] brightness-0 invert"
              priority
            />
          </span>
          <span className="text-xl font-bold tracking-tight text-white">
            Hermes
          </span>
        </Link>

        <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">
          <div className="rounded-full border border-white/20 bg-black/40 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(255,255,255,0.08),0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur-xl">
            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-white text-black"
                        : "text-zinc-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {isAuthenticated ? (
          <div className="relative hidden md:block">
            <button
              type="button"
              aria-label="Open account menu"
              aria-expanded={isAccountOpen}
              aria-haspopup="menu"
              onClick={() => setIsAccountOpen((isOpen) => !isOpen)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-xl transition-colors hover:bg-white/15"
            >
              <UserRound size={19} />
            </button>
            {isAccountOpen && (
              <div
                role="menu"
                className="absolute right-0 top-14 w-44 rounded-2xl border border-white/15 bg-black/80 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl"
              >
                <LogoutButton
                  onLoggedOut={() => setIsAccountOpen(false)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-60"
                />
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/signup"
            className="hidden rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-xl transition-colors hover:bg-white/15 md:inline-flex"
          >
            Sign up
          </Link>
        )}

        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={isNavOpen}
          onClick={() => setIsNavOpen((isOpen) => !isOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-xl md:hidden"
        >
          <Menu size={18} />
        </button>

        {isNavOpen && (
          <div className="absolute inset-x-0 top-14 rounded-3xl border border-white/20 bg-black/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_18px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl md:hidden">
            <div className="flex flex-col">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsNavOpen(false)}
                  className="rounded-2xl px-4 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
              {isAuthenticated ? (
                <LogoutButton
                  onLoggedOut={() => setIsNavOpen(false)}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black disabled:cursor-wait disabled:opacity-60"
                />
              ) : (
                <Link
                  href="/signup"
                  onClick={() => setIsNavOpen(false)}
                  className="mt-2 rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-black"
                >
                  Sign up
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
