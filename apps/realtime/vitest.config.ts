import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  plugins: [
    cloudflareTest({
      singleWorker: true,
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        bindings: {
          // HS256 test secret. Real deployments verify via JWKS instead
          // (see docs/ENVIRONMENT_SETUP.md step 1e).
          SUPABASE_JWT_SECRET: "test-jwt-secret-that-is-long-enough-for-hs256",
          // Deliberately blank. Wrangler loads .dev.vars, and a developer's real
          // SUPABASE_URL would make the verifier enforce that project's issuer
          // and reject these locally-signed tokens. Tests must not depend on
          // whether .dev.vars happens to exist.
          SUPABASE_URL: "",
          SUPABASE_SERVICE_ROLE_KEY: "",
          ENVIRONMENT: "test",
        },
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
  },
});
