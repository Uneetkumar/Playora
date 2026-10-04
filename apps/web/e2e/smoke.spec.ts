import { test, expect } from "@playwright/test";

/**
 * A smoke pass over the platform shell: the home page loads, the navigation
 * that gets people to a game works, and a phone gets the tab bar.
 *
 * CI runs it against a server with no Supabase or realtime backend, so it
 * relies only on what a signed-out visitor sees. Lookups are scoped to one
 * landmark: "Browse" is also in the footer and the tab bar, and a bare lookup
 * would match all of them.
 */
test.describe("Playora shell", () => {
  test("home renders the brand in its one h1", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Playora/i);
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toContainText("Playora");
  });

  test("the sidebar's Browse link opens the catalogue", async ({ page }) => {
    await page.goto("/");

    const menu = page.getByRole("navigation", { name: "Main menu" });
    await menu.getByRole("link", { name: "Browse", exact: true }).click();
    await expect(page).toHaveURL(/\/games$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Browse games");
  });

  test("a game's play box links straight into a game against the bot", async ({ page }) => {
    await page.goto("/games/chess");

    const box = page.getByRole("region", { name: "Play Chess" });
    await expect(box.getByRole("link", { name: "Play vs bot" })).toHaveAttribute(
      "href",
      "/play?game=chess&mode=vs-ai&level=3",
    );
  });

  test("a phone gets the tab bar instead of the sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    await expect(page.getByRole("navigation", { name: "Main menu" })).toBeHidden();
    const tabs = page.getByRole("navigation", { name: "Primary" });
    await expect(tabs).toBeVisible();

    for (const label of ["Home", "Browse", "Friends", "Profile"]) {
      await expect(tabs.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    // Play opens a sheet of ways to play, so it is a button, not a link.
    await expect(tabs.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  });
});
