import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * OAuth landing route.
 *
 * Google redirects to Supabase, which redirects here with a one-time code.
 * Exchanging it sets the session cookies; the code itself is never usable twice.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("next") ?? "/";
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(oauthError)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  // Only same-origin relative paths, so `next` cannot be used as an open redirect.
  const safeNext = redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
