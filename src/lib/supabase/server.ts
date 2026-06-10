import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getPublicSupabaseEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return { anonKey, url };
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { anonKey, url } = getPublicSupabaseEnvironment();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. Route handlers can.
        }
      },
    },
  });
}
