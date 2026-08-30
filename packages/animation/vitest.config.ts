import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The cinematic runner is DOM behaviour — it sets attributes on real
    // elements and queries them — so it needs a document to test against.
    environment: "jsdom",
  },
});
