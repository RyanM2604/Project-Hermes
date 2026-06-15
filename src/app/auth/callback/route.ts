import { NextResponse, type NextRequest } from "next/server";

import { getSafeRedirectPath } from "@/lib/auth/validation";
import { getPublicAppOrigin } from "@/lib/public-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = getSafeRedirectPath(request.nextUrl.searchParams.get("next"));
  const appOrigin = getPublicAppOrigin();

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
