import { describe, it, expect } from "vitest";
import { createBrowserSupabaseClient, createServerSupabaseAdminClient } from "../index.js";

describe("Database Client Factories", () => {
  it("throws error when environment variables are missing", () => {
    expect(() => createBrowserSupabaseClient("", "")).toThrow(
      "Missing Supabase browser environment variables"
    );
    expect(() => createServerSupabaseAdminClient("", "")).toThrow(
      "Missing Supabase server environment variables"
    );
  });

  it("creates client instance when configuration is supplied", () => {
    const client = createBrowserSupabaseClient("https://example.supabase.co", "anon-key-12345");
    expect(client).toBeDefined();
    expect(client.from).toBeTypeOf("function");
  });
});
