import { describe, it, expect } from "vitest";
import { safeNextPath } from "../safe-next";

/**
 * `next` is read from the URL, so anyone can write a link to /login with one.
 * Every value here must come back as a path on this site or as the fallback;
 * the hostile ones are each a way a browser reads a "path" as another host.
 */
describe("safeNextPath", () => {
  it("keeps a path on this site, with its query and hash", () => {
    expect(safeNextPath("/profile")).toBe("/profile");
    expect(safeNextPath("/games?genre=Party#top")).toBe("/games?genre=Party#top");
  });

  it("falls back when there is nothing to return to", () => {
    expect(safeNextPath(null)).toBe("/rooms");
    expect(safeNextPath(undefined)).toBe("/rooms");
    expect(safeNextPath("")).toBe("/rooms");
    expect(safeNextPath(null, "/")).toBe("/");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "/.//evil.example",
    "javascript:alert(1)",
    "data:text/html,hi",
  ])("refuses %j", (raw) => {
    expect(safeNextPath(raw)).toBe("/rooms");
  });
});
