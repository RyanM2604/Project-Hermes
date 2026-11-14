import "maplibre-gl/dist/maplibre-gl.css";
import { EventMap } from "@/components/map/EventMap";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function MapPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <EventMap isAuthenticated={Boolean(user)} />;
}
