import { NextResponse, type NextRequest } from "next/server";

import { getSafeRedirectPath } from "@/lib/auth/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = getSafeRedirectPath(request.nextUrl.searchParams.get("next"));
  const appOrigin = request.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing-code", appOrigin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=callback-failed", appOrigin),
    );
  }

  return NextResponse.redirect(new URL(next, appOrigin));
}
