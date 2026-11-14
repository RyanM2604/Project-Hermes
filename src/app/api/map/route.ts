import { loadMapSnapshot } from "@/lib/events/map-snapshot";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    return Response.json(await loadMapSnapshot(), { headers });
  } catch {
    return Response.json({ error: "Event data is unavailable right now." }, { status: 503, headers });
  }
}
