"use client";

import { Bookmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { logClientInteraction } from "@/lib/interactions/log-client-interaction";

interface SaveEventButtonProps {
  eventId: string;
}

export function SaveEventButton({ eventId }: SaveEventButtonProps) {
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    let isActive = true;

    async function loadSavedState() {
      try {
        const response = await fetch(`/api/events/${eventId}/save`);

        if (response.status === 401) {
          if (isActive) {
            setIsLoading(false);
          }
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load saved state");
        }

        const body = (await response.json()) as { saved: boolean };
        if (isActive) {
          setIsSaved(body.saved);
          setIsLoading(false);
        }
      } catch {
        if (isActive) {
          setErrorMessage("Save is unavailable right now.");
          setIsLoading(false);
        }
      }
    }

    loadSavedState();

    return () => {
      isActive = false;
    };
  }, [eventId]);

  async function toggleSaved() {
    setIsLoading(true);
    setErrorMessage(undefined);

    const response = await fetch(`/api/events/${eventId}/save`, {
      method: isSaved ? "DELETE" : "PUT",
    });

    if (response.status === 401) {
      router.push(`/login?next=${encodeURIComponent(`/events/${eventId}`)}`);
      return;
    }

    if (!response.ok) {
      try {
        const body = (await response.json()) as {
          error?: string;
          code?: string;
        };
        setErrorMessage(body.error ?? "Unable to update saved event.");
      } catch {
        setErrorMessage("Unable to update saved event.");
      }
      setIsLoading(false);
      return;
    }

    const body = (await response.json()) as { saved: boolean };
    setIsSaved(body.saved);
    setIsLoading(false);

    if (body.saved) {
      logClientInteraction({
        action: "save",
        eventId,
        metadata: { saved: true, surface: "event_detail" },
      });
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={isLoading}
        onClick={toggleSaved}
        aria-pressed={isSaved}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition disabled:cursor-wait disabled:opacity-60 ${
          isSaved
            ? "border-blue-300/40 bg-blue-300 text-black"
            : "border-white/15 bg-white/10 text-white hover:bg-white/15"
        }`}
      >
        <Bookmark size={17} fill={isSaved ? "currentColor" : "none"} />
        {isLoading ? "Loading..." : isSaved ? "Saved" : "Save event"}
      </button>
      {errorMessage && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
