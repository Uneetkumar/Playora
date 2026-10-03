import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only unit tests. The Playwright suite has its own runner and its own
    // command (`test:e2e`); picking its files up here would try to run a
    // browser harness under vitest.
    include: ["src/**/__tests__/**/*.test.ts", "src/**/*.unit.test.ts"],
    environment: "node",
  },
});
