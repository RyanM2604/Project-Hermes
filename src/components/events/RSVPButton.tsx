"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { RsvpStatus } from "@/lib/events/rsvp-event";
import { logClientInteraction } from "@/lib/interactions/log-client-interaction";

interface RSVPButtonProps {
  eventId: string;
  isAuthenticated: boolean;
  onSuccess?: () => void;
}

function getNextHref(eventId: string) {
  return `/login?next=${encodeURIComponent(`/events/${eventId}`)}`;
}

function formatRsvpLabel(value: RsvpStatus) {
  if (value === "going") {
    return "Going";
  }

  if (value === "interested") {
    return "Interested";
  }

  return "Not going";
}

export function RSVPButton({ eventId, isAuthenticated, onSuccess }: RSVPButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<RsvpStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    let isActive = true;

    async function loadRsvpState() {
      if (!isAuthenticated) {
        if (isActive) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(`/api/events/${eventId}/rsvp`);

        if (response.status === 401) {
          if (isActive) {
            setErrorMessage("Your session expired. Refresh and sign in again.");
            setIsLoading(false);
          }
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load RSVP state");
        }

        const body = (await response.json()) as { status: RsvpStatus | null };
        if (isActive) {
          setStatus(body.status ?? null);
          setIsLoading(false);
        }
      } catch {
        if (isActive) {
          setErrorMessage("RSVP is unavailable right now.");
          setIsLoading(false);
        }
      }
    }

    loadRsvpState();

    return () => {
      isActive = false;
    };
  }, [eventId, isAuthenticated]);

  async function updateRsvp(nextStatus: RsvpStatus) {
    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      const response = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (response.status === 401) {
        router.push(getNextHref(eventId));
        return;
      }

      if (!response.ok) {
        try {
          const body = (await response.json()) as {
            error?: string;
          };
          setErrorMessage(body.error ?? "Unable to update RSVP.");
        } catch {
          setErrorMessage("Unable to update RSVP.");
        }
        setIsLoading(false);
        return;
      }

      const body = (await response.json()) as { status: RsvpStatus | null };
      setStatus(body.status ?? null);
      setIsLoading(false);

      onSuccess?.();

      logClientInteraction({
        action: "rsvp",
        eventId,
        metadata: {
          status: body.status ?? nextStatus,
          surface: "event_detail",
        },
      });
    } catch {
      setErrorMessage("Unable to update RSVP. Please try again.");
      setIsLoading(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => router.push(getNextHref(eventId))}
          className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-blue-100"
        >
          Login to RSVP
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={isLoading}
          onClick={() => updateRsvp("going")}
          aria-pressed={status === "going"}
          className={`min-w-0 rounded-2xl border px-3 py-3 text-center text-sm font-bold leading-none tracking-tight whitespace-nowrap transition disabled:cursor-wait disabled:opacity-60 ${
            status === "going"
              ? "border-blue-300/40 bg-blue-300 text-black"
              : "border-white/15 bg-white/10 text-white hover:bg-white/15"
          }`}
        >
          Going
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => updateRsvp("cancelled")}
          aria-pressed={status === "cancelled"}
          className={`min-w-0 rounded-2xl border px-3 py-3 text-center text-sm font-bold leading-none tracking-tight whitespace-nowrap transition disabled:cursor-wait disabled:opacity-60 ${
            status === "cancelled"
              ? "border-white/20 bg-white text-black"
              : "border-white/15 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
          }`}
        >
          Not going
        </button>
      </div>
      {errorMessage && (
        <p role="alert" className="text-xs text-red-300">
          {errorMessage}
        </p>
      )}
      {status && status !== "cancelled" && (
        <p className="text-xs text-zinc-400">
          You&apos;re marked as {formatRsvpLabel(status)}.
        </p>
      )}
    </div>
  );
}
