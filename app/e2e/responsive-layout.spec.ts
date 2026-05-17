import { expect, test } from "@playwright/test";
import { installApiMocks } from "./support/mockApi";

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

test("Responsive: mobile stacks selectors and keeps modal in viewport", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only assertion");

  await page.goto("/");

  const chaser = page.getByRole("button", { name: /Chaser: Poland/i });
  const target = page.getByRole("button", { name: /Target: United Kingdom/i });
  await expect(chaser).toBeVisible();
  await expect(target).toBeVisible();

  const chaserBox = await chaser.boundingBox();
  const targetBox = await target.boundingBox();
  expect(chaserBox).toBeTruthy();
  expect(targetBox).toBeTruthy();
  // Mobile layout should stack selectors vertically.
  expect(Math.abs((targetBox?.x ?? 0) - (chaserBox?.x ?? 0))).toBeLessThan(40);
  expect((targetBox?.y ?? 0) - (chaserBox?.y ?? 0)).toBeGreaterThan(40);

  await page.getByRole("button", { name: "More options" }).click();
  await page.getByRole("menuitem", { name: "Data / Embed" }).click();

  const modal = page.getByRole("dialog", { name: "Export Data" });
  await expect(modal).toBeVisible();
  const box = await modal.boundingBox();
  expect(box).toBeTruthy();
  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  expect((box?.x ?? 0) >= 0).toBeTruthy();
  expect((box?.y ?? 0) >= 0).toBeTruthy();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual((viewport?.height ?? 0) + 1);
});

test("Responsive: tablet keeps selectors side-by-side and modal fits viewport", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "tablet", "tablet-only assertion");

  await page.goto("/");

  const chaser = page.getByRole("button", { name: /Chaser: Poland/i });
  const target = page.getByRole("button", { name: /Target: United Kingdom/i });
  await expect(chaser).toBeVisible();
  await expect(target).toBeVisible();

  const chaserBox = await chaser.boundingBox();
  const targetBox = await target.boundingBox();
  expect(chaserBox).toBeTruthy();
  expect(targetBox).toBeTruthy();
  // Tablet layout should place selectors in a row.
  expect(Math.abs((targetBox?.y ?? 0) - (chaserBox?.y ?? 0))).toBeLessThan(30);
  expect((targetBox?.x ?? 0) - (chaserBox?.x ?? 0)).toBeGreaterThan(120);

  await page.getByRole("button", { name: /Chaser: Poland/i }).click();
  const picker = page.getByRole("dialog");
  await expect(picker).toBeVisible();
  const box = await picker.boundingBox();
  const viewport = page.viewportSize();
  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect((box?.x ?? 0) >= 0).toBeTruthy();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
});

test("Responsive: desktop shows sidebar layout", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop-only assertion");

  await page.goto("/");

  const sidebar = page.locator("aside.sidebar-desktop");
  await expect(sidebar).toBeVisible();

  const chaser = page.getByRole("button", { name: /Chaser: Poland/i });
  const target = page.getByRole("button", { name: /Target: United Kingdom/i });
  await expect(chaser).toBeVisible();
  await expect(target).toBeVisible();

  const chaserBox = await chaser.boundingBox();
  const targetBox = await target.boundingBox();
  expect(chaserBox).toBeTruthy();
  expect(targetBox).toBeTruthy();
  expect(Math.abs((targetBox?.y ?? 0) - (chaserBox?.y ?? 0))).toBeLessThan(30);
  expect((targetBox?.x ?? 0) - (chaserBox?.x ?? 0)).toBeGreaterThan(120);
});
