import type { DurableObjectNamespace } from "@cloudflare/workers-types";

export interface Env {
  ROOM_DO: DurableObjectNamespace;
  MATCHMAKING_DO: DurableObjectNamespace;

  /**
   * Post-match work: persistence, rating, XP, achievements.
   *
   * Optional because Queues need a paid plan and a deployed binding. Without
   * it the same work runs inline in the room, which is slower but never
   * silently skipped — see lib/match-queue.ts.
   */
  MATCH_QUEUE?: import("./lib/match-queue.js").MatchQueue;
  ENVIRONMENT?: string;

  /**
   * Supabase project URL. Used to derive the JWKS endpoint and the expected
   * token issuer. Preferred over a shared secret: only public keys reach the
   * edge. Set via `wrangler secret put` / `.dev.vars`.
   */
  SUPABASE_URL?: string;

  /**
   * Legacy HS256 project JWT secret. Only needed for projects that have not
   * migrated to asymmetric signing keys.
   */
  SUPABASE_JWT_SECRET?: string;

  /** Server-only. Never exposed to the browser. Used from Slice 3 onward. */
  SUPABASE_SERVICE_ROLE_KEY?: string;
}
