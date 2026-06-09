import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

function getEnvironmentVariables() {
    const supabaseURL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseURL || !supabaseAnonKey) {
        throw new Error(
            "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
        )
    }

    return { supabaseURL, supabaseAnonKey }
}

export async function createSupabaseServerClient() {
    const cookieStore = await cookies();
    const { supabaseURL, supabaseAnonKey } = getEnvironmentVariables();

    return createServerClient(supabaseURL, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options}) => 
                        cookieStore.set(name, value, options)
                    );
                }
                catch(error) {
                    console.log(error)
                }
            }
        }
    }) 
}
