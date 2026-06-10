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
        throw error;
      }
    },
    async unsave(userId, eventId) {
      const { error } = await supabase
        .from("saved_events")
        .delete()
        .eq("user_id", userId)
        .eq("event_id", eventId);

      if (error) {
        throw error;
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
  } catch {
    return Response.json({ error: "Unable to update saved event" }, { status: 500 });
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
