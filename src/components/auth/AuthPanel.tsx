import Link from "next/link";

import { AuthForm } from "./AuthForm";
import { HermesMotion } from "@/components/motion/HermesMotion";

interface AuthPanelProps {
  initialEmail?: string;
  mode: "login" | "signup";
  next?: string;
}

export function AuthPanel({ initialEmail, mode, next }: AuthPanelProps) {
  const isSignup = mode === "signup";
  const alternateHref = `${isSignup ? "/login" : "/signup"}?next=${encodeURIComponent(next ?? "/events")}`;

  return (
    <HermesMotion variant="auth"><main className="hm-auth-page">
      <section className="hm-auth" data-motion="auth-panel">
        <p className="hm-small-label">Student access</p>
        <h1>
          {isSignup ? "Sign up for Hermes" : "Log in to Hermes"}
        </h1>
        <p className="hm-auth-intro">
          Use your @uwaterloo.ca email to save events and RSVP.
        </p>

        <div className="hm-auth-form">
          <AuthForm initialEmail={initialEmail} mode={mode} next={next} />
        </div>

        <p className="hm-auth-switch">
          {isSignup ? "Already have an account? " : "Need an account? "}
          <Link
            href={alternateHref}
            className="hermes-text-link"
          >
            {isSignup ? "Log in" : "Sign up"}
          </Link>
        </p>
      </section>
    </main></HermesMotion>
  );
}
