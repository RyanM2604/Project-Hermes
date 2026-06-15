"use client";

import { ArrowRight, CheckCircle2, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { isUWaterlooEmail, isValidPassword } from "@/lib/auth/validation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface AuthFormProps {
  initialEmail?: string;
  mode: "login" | "signup";
  next?: string;
}

export function AuthForm({
  initialEmail = "",
  mode,
  next = "/events",
}: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [errorMessage, setErrorMessage] = useState<string>();

  async function submitPasswordAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);

    if (!isUWaterlooEmail(email)) {
      setErrorMessage("Use your @uwaterloo.ca email address.");
      return;
    }

    if (!isValidPassword(password)) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    if (mode === "signup" && password !== passwordConfirmation) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setStatus("loading");
    const supabase = createSupabaseBrowserClient();

    if (mode === "signup") {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", next);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        setStatus("idle");
        setErrorMessage("Unable to create your account. Please try again.");
        return;
      }

      if (!data.session) {
        setStatus("sent");
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        setStatus("idle");
        setErrorMessage("Incorrect email or password.");
        return;
      }
    }

    router.push(next);
    router.refresh();
  }

  async function sendMagicLink() {
    setErrorMessage(undefined);

    if (!isUWaterlooEmail(email)) {
      setErrorMessage("Enter your @uwaterloo.ca email before requesting a link.");
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
        shouldCreateUser: false,
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
          {mode === "signup"
            ? "Confirm your Waterloo email to finish creating your account."
            : "We sent a secure Hermes login link to your Waterloo email."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submitPasswordAuth} className="space-y-4">
      <label htmlFor={`${mode}-email`} className="sr-only">
        Waterloo email
      </label>
      <div className="relative">
        <Mail
          className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
          size={18}
        />
        <input
          id={`${mode}-email`}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="your.email@uwaterloo.ca"
          className="w-full rounded-2xl border border-white/10 bg-black/30 py-4 pl-11 pr-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-300/60"
        />
      </div>

      <label htmlFor={`${mode}-password`} className="sr-only">
        Password
      </label>
      <div className="relative">
        <LockKeyhole
          className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
          size={18}
        />
        <input
          id={`${mode}-password`}
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="w-full rounded-2xl border border-white/10 bg-black/30 py-4 pl-11 pr-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-300/60"
        />
      </div>

      {mode === "signup" && (
        <>
          <label htmlFor="signup-password-confirmation" className="sr-only">
            Confirm password
          </label>
          <div className="relative">
            <LockKeyhole
              className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
              size={18}
            />
            <input
              id="signup-password-confirmation"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              placeholder="Confirm password"
              className="w-full rounded-2xl border border-white/10 bg-black/30 py-4 pl-11 pr-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-300/60"
            />
          </div>
        </>
      )}

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
        {status === "loading"
          ? mode === "signup"
            ? "Creating account..."
            : "Logging in..."
          : mode === "signup"
            ? "Create account"
            : "Log in"}
        {status !== "loading" && <ArrowRight size={17} />}
      </button>

      {mode === "login" && (
        <button
          type="button"
          disabled={status === "loading"}
          onClick={sendMagicLink}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-wait disabled:opacity-60"
        >
          Email me a magic login link
        </button>
      )}
    </form>
  );
}
