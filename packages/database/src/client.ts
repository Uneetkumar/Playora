import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";

let browserClient: SupabaseClient<Database> | null = null;

export function createBrowserSupabaseClient(
  supabaseUrl?: string,
  supabaseAnonKey?: string
): SupabaseClient<Database> {
  const url =
    supabaseUrl ||
    (typeof process !== "undefined" ? process.env["NEXT_PUBLIC_SUPABASE_URL"] : undefined);
  const anonKey =
    supabaseAnonKey ||
    (typeof process !== "undefined" ? process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] : undefined);

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase browser environment variables: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  if (browserClient) return browserClient;

  browserClient = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}
