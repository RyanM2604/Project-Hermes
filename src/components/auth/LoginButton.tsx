"use client";

import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { useState } from "react";

import { isUWaterlooEmail } from "@/lib/auth/validation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface LoginButtonProps {
  initialEmail?: string;
  next?: string;
}

export function LoginButton({ initialEmail = "", next = "/events" }: LoginButtonProps) {
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [errorMessage, setErrorMessage] = useState<string>();

  async function startMagicLinkLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);

    if (!isUWaterlooEmail(email)) {
      setErrorMessage("Use your @uwaterloo.ca email address.");
      return;
    }

    setStatus("loading");

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", next);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: callbackUrl.toString(),
      },
    });

    if (error) {
      setStatus("idle");
      setErrorMessage("Unable to send the login link. Please try again.");
      return;
    }

    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div
        role="status"
        className="rounded-3xl border border-green-400/20 bg-green-400/[0.08] p-6 text-center"
      >
        <CheckCircle2 className="mx-auto text-green-400" size={28} />
        <h2 className="mt-4 text-lg font-bold text-white">Check your inbox</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          We sent a secure Hermes login link to your Waterloo email.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={startMagicLinkLogin} className="space-y-4">
      <label htmlFor="login-email" className="sr-only">
        Waterloo email
      </label>
      <div className="relative">
        <Mail
          className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
          size={18}
        />
        <input
          id="login-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="your.email@uwaterloo.ca"
          className="w-full rounded-2xl border border-white/10 bg-black/30 py-4 pl-11 pr-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-300/60"
        />
      </div>

      {errorMessage && (
        <p role="alert" className="text-sm font-medium text-red-300">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-bold text-black transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60"
      >
        {status === "loading" ? "Sending login link..." : "Email me a login link"}
        {status !== "loading" && <ArrowRight size={17} />}
      </button>
    </form>
  );
}
