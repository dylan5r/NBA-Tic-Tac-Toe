import { expect, test } from "@playwright/test";

test("landing to local setup flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /NBA TIC TAC TOE/i }).first()).toBeVisible();
  await page.getByText("Local Play").first().click();
  await expect(page.getByText("Mode Setup")).toBeVisible();
});
