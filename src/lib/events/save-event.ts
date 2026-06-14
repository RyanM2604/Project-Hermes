type SaveAction = "get" | "save" | "unsave";

interface AuthenticatedUser {
  id: string;
}

interface SavedEventRepository {
  isSaved(userId: string, eventId: string): Promise<boolean>;
  save(userId: string, eventId: string): Promise<void>;
  unsave(userId: string, eventId: string): Promise<void>;
}

interface HandleSaveEventOptions {
  action: SaveAction;
  eventId: string;
  eventExists: (eventId: string) => Promise<boolean>;
  getUser: () => Promise<AuthenticatedUser | null>;
  repository: SavedEventRepository;
}

interface SaveEventResult {
  body: {
    error?: string;
    saved?: boolean;
  };
  status: number;
}

export async function handleSaveEvent({
  action,
  eventId,
  eventExists,
  getUser,
  repository,
}: HandleSaveEventOptions): Promise<SaveEventResult> {
  const user = await getUser();

  if (!user) {
    return { body: { error: "Authentication required" }, status: 401 };
  }

  if (!(await eventExists(eventId))) {
    return { body: { error: "Event not found" }, status: 404 };
  }

  if (action === "get") {
    return {
      body: { saved: await repository.isSaved(user.id, eventId) },
      status: 200,
    };
  }

  if (action === "save") {
    await repository.save(user.id, eventId);
    return { body: { saved: true }, status: 200 };
  }

  await repository.unsave(user.id, eventId);
  return { body: { saved: false }, status: 200 };
}

export type { SavedEventRepository };
