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
          ENVIRONMENT: "test",
        },
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
  },
});
