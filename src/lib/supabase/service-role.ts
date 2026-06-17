import "server-only";

import { createClient } from "@supabase/supabase-js";

function getServiceRoleConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { serviceRoleKey, url };
}

export function createSupabaseServiceRoleClient() {
  const config = getServiceRoleConfig();

  if (!config) {
    throw new Error("Missing Supabase service role configuration");
  }

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
