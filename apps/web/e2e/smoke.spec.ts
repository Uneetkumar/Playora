import { test, expect } from "@playwright/test";

test.describe("Playora shell", () => {
  test("homepage renders the brand and headline", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Playora/i);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("PLAY TOGETHER");
  });

  test("primary navigation works", async ({ page }) => {
    await page.goto("/");

    // Scope to the header nav: "Games"/"Rooms" also appear in the footer, the
    // mobile bottom nav and hero CTAs, which would make a bare lookup ambiguous.
    const mainNav = page.getByRole("navigation", { name: "Main" });

    await mainNav.getByRole("link", { name: "Games" }).click();
    await expect(page).toHaveURL(/.*\/games/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Game Catalog");

    await mainNav.getByRole("link", { name: "Play", exact: true }).click();
    await expect(page).toHaveURL(/.*\/play/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Play Chess");
  });

  test("mobile gets bottom navigation instead of the desktop nav", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    // The desktop nav is hidden below md; the bottom bar takes over.
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
    const bottomNav = page.getByRole("navigation", { name: "Primary" });
    await expect(bottomNav).toBeVisible();

    for (const label of ["Home", "Games", "Play", "Friends", "Profile"]) {
      await expect(bottomNav.getByRole("link", { name: label })).toBeVisible();
    }
  });
});
