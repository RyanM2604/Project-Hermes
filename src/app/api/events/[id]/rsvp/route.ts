import { createSupabaseServerClient } from "@/lib/supabase/server";
import { eventExists } from "@/lib/events/repository";
import {
  handleRsvpEvent,
  type RsvpEventRepository,
  isRsvpStatus,
} from "@/lib/events/rsvp-event";

async function handleRequest(
  request: Request,
  context: RouteContext<"/api/events/[id]/rsvp">,
) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const nextStatus =
    request.method === "PUT"
      ? (await request
          .json()
          .catch(() => null))?.status
      : undefined;

  if (request.method === "PUT" && !isRsvpStatus(nextStatus)) {
    return Response.json(
      { error: "Invalid RSVP status" },
      { status: 400 },
    );
  }

  const repository: RsvpEventRepository = {
    async getStatus(userId, eventId) {
      const { data, error } = await supabase
        .from("event_rsvps")
        .select("status")
        .eq("user_id", userId)
        .eq("event_id", eventId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const status = data?.status;
      return isRsvpStatus(status) ? status : null;
    },
    async setStatus(userId, eventId, status) {
      const { error } = await supabase.from("event_rsvps").upsert(
        {
          event_id: eventId,
          status,
          updated_at: new Date().toISOString(),
          user_id: userId,
        },
        { onConflict: "user_id,event_id" },
      );

      if (error) {
        const failure = new Error(error.message) as Error & { code?: string };
        failure.code = error.code;
        throw failure;
      }
    },
  };

  try {
    const result = await handleRsvpEvent({
      eventId: id,
      eventExists,
      getUser: async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        return user;
      },
      repository,
      status: nextStatus,
    });

    return Response.json(result.body, { status: result.status });
  } catch {
    return Response.json({ error: "Unable to update RSVP" }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/events/[id]/rsvp">,
) {
  return handleRequest(request, context);
}

export async function PUT(
  request: Request,
  context: RouteContext<"/api/events/[id]/rsvp">,
) {
  return handleRequest(request, context);
}
