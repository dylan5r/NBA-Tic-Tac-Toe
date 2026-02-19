import { expect, test } from "@playwright/test";

test("landing to local setup flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("NBA Tic-Tac-Toe")).toBeVisible();
  await page.getByRole("link", { name: "Local" }).click();
  await expect(page.getByText("Mode Setup")).toBeVisible();
});
