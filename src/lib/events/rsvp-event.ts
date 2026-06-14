export type RsvpStatus = "going" | "interested" | "cancelled";

export const rsvpStatuses = ["going", "interested", "cancelled"] as const;

export function isRsvpStatus(value: string): value is RsvpStatus {
  return rsvpStatuses.includes(value as RsvpStatus);
}

interface AuthenticatedUser {
  id: string;
}

interface RsvpEventRepository {
  getStatus(userId: string, eventId: string): Promise<RsvpStatus | null>;
  setStatus(userId: string, eventId: string, status: RsvpStatus): Promise<void>;
}

interface HandleRsvpEventOptions {
  eventId: string;
  eventExists: (eventId: string) => Promise<boolean>;
  getUser: () => Promise<AuthenticatedUser | null>;
  repository: RsvpEventRepository;
  status?: RsvpStatus;
}

interface RsvpEventResult {
  body: {
    error?: string;
    status?: RsvpStatus | null;
  };
  status: number;
}

export async function handleRsvpEvent({
  eventId,
  eventExists,
  getUser,
  repository,
  status,
}: HandleRsvpEventOptions): Promise<RsvpEventResult> {
  const user = await getUser();

  if (!user) {
    return { body: { error: "Authentication required" }, status: 401 };
  }

  if (!(await eventExists(eventId))) {
    return { body: { error: "Event not found" }, status: 404 };
  }

  if (!status) {
    return {
      body: { status: await repository.getStatus(user.id, eventId) },
      status: 200,
    };
  }

  if (!isRsvpStatus(status)) {
    return { body: { error: "Invalid RSVP status" }, status: 400 };
  }

  await repository.setStatus(user.id, eventId, status);

  return {
    body: { status },
    status: 200,
  };
}

export type { RsvpEventRepository };
