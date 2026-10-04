import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

/**
 * The /dev previews must be a real 404 in production: the pages' own
 * notFound() only reaches the browser after a 200 and a loading skeleton.
 */
describe("middleware: /dev previews", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const status = async (path: string) => (await middleware(new NextRequest(`http://localhost${path}`))).status;

  it("answers 404 for every /dev route in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await status("/dev")).toBe(404);
    expect(await status("/dev/cards")).toBe(404);
    expect(await status("/dev/platform/profile")).toBe(404);
  });

  it("leaves other routes, and /dev in development, to the page", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await status("/developers")).toBe(200);
    expect(await status("/games")).toBe(200);
    vi.stubEnv("NODE_ENV", "development");
    expect(await status("/dev/cards")).toBe(200);
  });
});
