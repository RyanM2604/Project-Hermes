import { canonicalEventRefreshCoordinator } from "@/ingestion/refresh-canonical-events.server";

export const dynamic = "force-dynamic";

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  return scheme === "Bearer" && token ? token : null;
}

function isAuthorized(request: Request): boolean {
  const configuredSecret = process.env.CRON_SECRET?.trim();

  if (configuredSecret) {
    return bearerToken(request) === configuredSecret;
  }

  return request.headers.get("x-vercel-cron") === "1";
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await canonicalEventRefreshCoordinator.refresh({ force: true });

    return Response.json({
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      skipped: result.skipped,
      eventCount: result.events.length,
      duplicateCount: result.duplicates.length,
      persistedCount: result.persistedEventIds.length,
      sourceCount: result.sources.length,
      classification: result.classification ?? null,
    });
  } catch {
    return Response.json(
      { error: "Unable to refresh events" },
      { status: 500 },
    );
  }
}
