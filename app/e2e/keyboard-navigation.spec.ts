import { expect, test } from "@playwright/test";
import { installApiMocks } from "./support/mockApi";

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

test("Keyboard: tab moves focus across interactive controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop tab order assertion");

  await page.goto("/");

  const linkButton = page.getByRole("button", { name: "Link" });
  await linkButton.focus();
  await expect(linkButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Share", exact: true })).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Thread" })).toBeFocused();
});

test("Keyboard: country picker modal opens with Enter, closes with Escape, and restores focus", async ({
  page,
}) => {
  await page.goto("/");

  const trigger = page.getByRole("button", { name: /Chaser: Poland/i });
  await trigger.focus();
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder("Search countries…")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("Keyboard: growth-rate slider responds to arrow keys", async ({ page }) => {
  await page.goto("/");

  const slider = page
    .locator('input[type="range"][aria-label="Poland growth rate"]:visible')
    .first();
  await expect(slider).toBeVisible();
  await slider.focus();
  await expect(slider).toBeFocused();

  const before = Number(await slider.inputValue());
  await page.keyboard.press("ArrowRight");
  const afterRight = Number(await slider.inputValue());
  expect(afterRight).toBeGreaterThan(before);

  await page.keyboard.press("ArrowLeft");
  const afterLeft = Number(await slider.inputValue());
  expect(afterLeft).toBeLessThanOrEqual(afterRight);
});
