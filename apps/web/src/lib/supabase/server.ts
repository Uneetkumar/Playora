import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "../env";

/**
 * Server-side Supabase client bound to the request's cookies.
 *
 * Uses the anon key: server code acts on behalf of the signed-in user and is
 * still subject to RLS. The service-role key is never used here.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
    global: {
      fetch: async (input, init) => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1500);
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
  });
}
