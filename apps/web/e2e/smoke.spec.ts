import { test, expect } from "@playwright/test";

test.describe("Platform Web App Shell", () => {
  test("homepage renders correctly and shows brand title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Game Platform/i);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Next-Gen Multiplayer");
  });

  test("navigation links work as expected", async ({ page }) => {
    await page.goto("/");

    // Scope to the primary header nav: "Games"/"Rooms" also appear in the
    // footer and in hero CTAs, which would make a bare role lookup ambiguous.
    const mainNav = page.getByRole("navigation", { name: "Main" });

    await mainNav.getByRole("link", { name: "Games" }).click();
    await expect(page).toHaveURL(/.*\/games/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Game Catalog");

    await mainNav.getByRole("link", { name: "Rooms" }).click();
    await expect(page).toHaveURL(/.*\/rooms/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Game Rooms");
  });
});
