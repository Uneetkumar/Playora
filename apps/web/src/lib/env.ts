import { z } from "zod";

/**
 * Public environment, validated once at module load.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` only for literal property
 * accesses, so each one is referenced explicitly below rather than looped over.
 */
const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("Must be your Supabase project URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "Missing Supabase anon key"),
  NEXT_PUBLIC_REALTIME_WS_URL: z.string().min(1).default("ws://localhost:8787"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:8000"),
});

export type PublicEnv = z.infer<typeof PublicEnvSchema>;

const parsed = PublicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_REALTIME_WS_URL: process.env.NEXT_PUBLIC_REALTIME_WS_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

/**
 * True when the app has enough configuration to talk to Supabase. The UI uses
 * this to show a setup notice instead of failing with an opaque runtime error.
 */
export const isSupabaseConfigured = parsed.success;

export const publicEnvErrors: string[] = parsed.success
  ? []
  : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);

export const env: PublicEnv = parsed.success
  ? parsed.data
  : {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      NEXT_PUBLIC_REALTIME_WS_URL: process.env.NEXT_PUBLIC_REALTIME_WS_URL ?? "ws://localhost:8787",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8000",
    };
