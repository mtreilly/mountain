import { expect, test } from "@playwright/test";
import { installApiMocks } from "./support/mockApi";

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });
});

test("@visual projection chart remains stable", async ({ page }) => {
  await page.goto("/?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP&cg=0.035&tg=0.015&tmode=growing");
  const chart = page.getByRole("img", { name: /projection/i });
  await expect(chart).toBeVisible();
  await expect(chart).toHaveScreenshot("projection-chart.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.001,
  });
});

test("@visual share URL desktop layout remains stable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop-only baseline");

  await page.goto("/?chaser=USA&target=NGA&indicator=GDP_PCAP_PPP&cg=0.05&tg=0.02&tmode=growing");
  await expect(page.getByRole("heading", { name: "The Mountain to Climb" })).toBeVisible();
  await expect(page).toHaveScreenshot("desktop-share-layout.png", {
    fullPage: true,
    animations: "disabled",
    maxDiffPixelRatio: 0.001,
  });
});

test("@visual mobile layout remains stable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only baseline");

  await page.goto("/?chaser=NGA&target=IRL&indicator=GDP_PCAP_PPP");
  await expect(page.getByRole("heading", { name: "The Mountain to Climb" })).toBeVisible();
  await expect(page).toHaveScreenshot("mobile-layout.png", {
    fullPage: true,
    animations: "disabled",
    maxDiffPixelRatio: 0.001,
  });
});
