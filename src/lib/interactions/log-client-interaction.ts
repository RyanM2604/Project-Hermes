import type { InteractionAction } from "./log-interaction";

interface LogClientInteractionOptions {
  action: InteractionAction;
  eventId: string;
  metadata?: Record<string, unknown>;
}

const anonymousSessionStorageKey = "hermes_anonymous_session_id";

function getAnonymousSessionId() {
  try {
    const existingSessionId = window.sessionStorage.getItem(
      anonymousSessionStorageKey,
    );

    if (existingSessionId) {
      return existingSessionId;
    }

    const sessionId = crypto.randomUUID().replaceAll("-", "");
    window.sessionStorage.setItem(anonymousSessionStorageKey, sessionId);

    return sessionId;
  } catch {
    return crypto.randomUUID().replaceAll("-", "");
  }
}

export function logClientInteraction({
  action,
  eventId,
  metadata,
}: LogClientInteractionOptions) {
  void fetch("/api/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      anonymousSessionId: getAnonymousSessionId(),
      eventId,
      metadata,
    }),
    keepalive: true,
  }).catch(() => {
    // Interaction logging must never disrupt the user's action.
  });
}
