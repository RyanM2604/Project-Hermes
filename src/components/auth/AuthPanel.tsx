import Link from "next/link";

import { AuthForm } from "./AuthForm";

interface AuthPanelProps {
  initialEmail?: string;
  mode: "login" | "signup";
  next?: string;
}

export function AuthPanel({ initialEmail, mode, next }: AuthPanelProps) {
  const isSignup = mode === "signup";
  const alternateHref = `${isSignup ? "/login" : "/signup"}?next=${encodeURIComponent(next ?? "/events")}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-5 pb-12 pt-32 text-white sm:px-8 sm:pt-36">
      <section className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_30px_90px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
          Student access
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          {isSignup ? "Sign up for Hermes" : "Log in to Hermes"}
        </h1>
        <p className="mt-4 leading-7 text-zinc-400">
          Use your @uwaterloo.ca email to save events and RSVP.
        </p>

        <div className="mt-8">
          <AuthForm initialEmail={initialEmail} mode={mode} next={next} />
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          {isSignup ? "Already have an account? " : "Need an account? "}
          <Link
            href={alternateHref}
            className="font-semibold text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white"
          >
            {isSignup ? "Log in" : "Sign up"}
          </Link>
        </p>
      </section>
    </main>
  );
}
