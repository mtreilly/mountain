import { expect, test } from "@playwright/test";
import { installApiMocks } from "./support/mockApi";

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

test("Keyboard: tab moves focus across interactive controls", async ({ page }) => {
  await page.goto("/");

  const focusedSignature = () =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el.tagName === "BODY" || el.tagName === "HTML") return null;
      return `${el.tagName}:${el.getAttribute("aria-label") || el.textContent?.trim() || ""}`;
    });

  const waitForFocusedSignature = async () => {
    await expect.poll(focusedSignature).not.toBeNull();
    return focusedSignature();
  };

  await page.keyboard.press("Tab");
  const firstSig = await waitForFocusedSignature();

  await page.keyboard.press("Tab");
  const secondSig = await waitForFocusedSignature();
  expect(secondSig).not.toEqual(firstSig);
});

test("Keyboard: country picker modal opens with Enter, closes with Escape, and restores focus", async ({
  page,
}) => {
  await page.goto("/");

  const trigger = page.getByRole("button", { name: /Chaser: Nigeria/i });
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
    .locator('input[type="range"][aria-label="Nigeria growth rate"]:visible')
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
