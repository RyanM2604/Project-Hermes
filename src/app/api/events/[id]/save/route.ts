import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  handleSaveEvent,
  type SavedEventRepository,
} from "@/lib/events/save-event";

async function handleRequest(
  action: "get" | "save" | "unsave",
  context: RouteContext<"/api/events/[id]/save">,
) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();

  const repository: SavedEventRepository = {
    async isSaved(userId, eventId) {
      const { data, error } = await supabase
        .from("saved_events")
        .select("id")
        .eq("user_id", userId)
        .eq("event_id", eventId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return Boolean(data);
    },
    async save(userId, eventId) {
      const { error } = await supabase
        .from("saved_events")
        .upsert(
          { event_id: eventId, user_id: userId },
          { onConflict: "user_id,event_id", ignoreDuplicates: true },
        );

      if (error) {
        const failure = new Error(error.message) as Error & { code?: string };
        failure.code = error.code;
        throw failure;
      }
    },
    async unsave(userId, eventId) {
      const { error } = await supabase
        .from("saved_events")
        .delete()
        .eq("user_id", userId)
        .eq("event_id", eventId);

      if (error) {
        const failure = new Error(error.message) as Error & { code?: string };
        failure.code = error.code;
        throw failure;
      }
    },
  };

  try {
    const result = await handleSaveEvent({
      action,
      eventId: id,
      getUser: async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        return user;
      },
      repository,
    });

    return Response.json(result.body, { status: result.status });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unable to update saved event";
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : undefined;

    return Response.json(
      {
        error: message,
        ...(code ? { code } : {}),
      },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/events/[id]/save">,
) {
  return handleRequest("get", context);
}

export async function PUT(
  _request: Request,
  context: RouteContext<"/api/events/[id]/save">,
) {
  return handleRequest("save", context);
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/events/[id]/save">,
) {
  return handleRequest("unsave", context);
}
