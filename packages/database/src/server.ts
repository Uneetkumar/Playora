import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";

export function createServerSupabaseAdminClient(
  supabaseUrl?: string,
  serviceRoleKey?: string
): SupabaseClient<Database> {
  const url =
    supabaseUrl ||
    (typeof process !== "undefined" ? process.env["NEXT_PUBLIC_SUPABASE_URL"] : undefined);
  const key =
    serviceRoleKey ||
    (typeof process !== "undefined" ? process.env["SUPABASE_SERVICE_ROLE_KEY"] : undefined);

  if (!url || !key) {
    throw new Error(
      "Missing Supabase server environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
