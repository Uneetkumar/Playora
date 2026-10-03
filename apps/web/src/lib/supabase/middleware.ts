import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, isSupabaseConfigured } from "../env";

/**
 * Refreshes the Supabase session on every request and writes rotated cookies
 * back onto the response.
 *
 * Without this, access tokens expire mid-session and the realtime Worker starts
 * rejecting AUTH — which would look like a random disconnect to the player.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured) return response;

  // If there are no auth cookies in the request, there is no session to refresh.
  // Avoid making outbound network requests on guest or unauthenticated page views.
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));

  if (!hasAuthCookie) return response;

  try {
    const supabase = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value } of cookiesToSet) {
              request.cookies.set(name, value);
            }
            response = NextResponse.next({ request });
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
        global: {
          fetch: async (input, init) => {
            try {
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 1200);
              const res = await fetch(input, { ...init, signal: controller.signal });
              clearTimeout(timer);
              return res;
            } catch {
              return new Response(
                JSON.stringify({ error: "network_unavailable", message: "Supabase host unreachable" }),
                { status: 400, headers: { "Content-Type": "application/json" } },
              );
            }
          },
        },
      },
    );

    // Touching getUser() is what triggers the refresh. Do not block if network is unreachable.
    await supabase.auth.getUser();
  } catch {
    // If Supabase host is unreachable or DNS fails, do not throw or crash requests
  }

  return response;
}
