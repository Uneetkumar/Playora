"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "../env";

let client: SupabaseClient | null = null;

/**
 * Browser Supabase client. Only ever receives the anon key, which is safe to
 * ship: Row Level Security governs what it can read.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. See docs/ENVIRONMENT_SETUP.md and fill apps/web/.env.local.",
    );
  }
  client ??= createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        fetch: async (input, init) => {
          try {
            return await fetch(input, init);
          } catch {
            // Gracefully catch DNS or network failures to prevent unhandled rejection overlays in React
            return new Response(
              JSON.stringify({ error: "invalid_grant", message: "Supabase host unreachable" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
        },
      },
    },
  );
  return client;
}
