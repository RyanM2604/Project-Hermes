import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  logInteraction,
  type InteractionRepository,
} from "@/lib/interactions/log-interaction";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);

  const repository: InteractionRepository = {
    async create(input) {
      await prisma.interaction.create({
        data: {
          action: input.action,
          anonymousSessionId: input.anonymousSessionId,
          eventId: input.eventId,
          metadata: input.metadata as Prisma.InputJsonValue,
          userId: input.userId,
        },
      });
    },
  };

  const result = await logInteraction({
    getUser: async () => {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      return user;
    },
    payload,
    repository,
  });

  if (result.status === 204) {
    return new Response(null, { status: 204 });
  }

  return Response.json(result.body, { status: result.status });
}
