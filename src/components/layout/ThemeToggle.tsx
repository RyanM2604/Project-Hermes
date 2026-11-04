"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const storageKey = "hermes-theme";

function savedTheme() {
  try {
    const value = localStorage.getItem(storageKey);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    const followSystem = () => {
      if (savedTheme() === null) {
        applyTheme(preference.matches);
        sync();
      }
    };
    const followStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      applyTheme(event.newValue === "dark" || (event.newValue !== "light" && preference.matches));
      sync();
    };

    sync();
    preference.addEventListener("change", followSystem);
    window.addEventListener("storage", followStorage);
    window.addEventListener("hermes-theme-change", sync);
    return () => {
      preference.removeEventListener("change", followSystem);
      window.removeEventListener("storage", followStorage);
      window.removeEventListener("hermes-theme-change", sync);
    };
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    applyTheme(next);
    setDark(next);
    window.dispatchEvent(new Event("hermes-theme-change"));
    try {
      localStorage.setItem(storageKey, next ? "dark" : "light");
    } catch {
      // The visible theme still changes when storage is unavailable.
    }
  }

  return (
    <button
      type="button"
      className="hermes-theme-toggle"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Moon size={18} aria-hidden="true" className="hermes-theme-moon" />
      <Sun size={18} aria-hidden="true" className="hermes-theme-sun" />
      {showLabel && <span className="hermes-theme-label">{dark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
