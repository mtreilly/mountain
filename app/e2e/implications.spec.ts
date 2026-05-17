import { expect, test } from "@playwright/test";
import { installApiMocks } from "./support/mockApi";

async function clickDeterministic(locator: import("@playwright/test").Locator) {
  await expect(locator).toBeVisible({ timeout: 30_000 });
  await locator.evaluate((el: HTMLElement) => el.click());
}

async function openImplications(page: import("@playwright/test").Page) {
  const desktopTrigger = page.getByRole("button", { name: /^Implications\b/i }).first();
  const mobileTrigger = page.getByRole("button", { name: /^Development Implications\b/i }).first();

  await expect
    .poll(
      async () =>
        ((await desktopTrigger.isVisible().catch(() => false)) ? 1 : 0) +
        ((await mobileTrigger.isVisible().catch(() => false)) ? 1 : 0),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);

  if (await desktopTrigger.isVisible().catch(() => false)) {
    await clickDeterministic(desktopTrigger);
  } else {
    await clickDeterministic(mobileTrigger);
  }

  const panel = page.getByRole("dialog", { name: "Development Implications" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Loading data...")).toBeHidden({ timeout: 30_000 });
  await expect(panel.getByText("Not enough data available for these projections.")).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

test("Implications panel opens and renders finite values", async ({ page }) => {
  await page.goto("/");
  await openImplications(page);

  const panel = page.getByRole("dialog", { name: "Development Implications" });
  await expect(panel.getByRole("heading", { name: "Economic Output" })).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Electricity" })).toBeVisible();
  await expect(panel.getByText("GDP/capita")).toBeVisible();
  await expect(panel.getByText("Projected demand", { exact: true })).toBeVisible();

  await expect(panel).not.toContainText("NaN");
  await expect(panel).not.toContainText("undefined");
  await expect(panel).toContainText("Illustrative projections based on historical patterns");
});

test("Implications controls update template and scenario context", async ({ page }) => {
  await page.goto("/");
  await openImplications(page);

  const panel = page.getByRole("dialog", { name: "Development Implications" });

  const usTemplateButton = panel.getByRole("button", { name: /US-like/i }).first();
  await clickDeterministic(usTemplateButton);
  await expect(usTemplateButton).toHaveClass(/text-white/);

  const efficientGrowthButton = panel
    .getByRole("button", { name: "Efficient growth", exact: true })
    .first();
  await clickDeterministic(efficientGrowthButton);
  await expect(
    panel.getByText("Less energy/electricity per unit of GDP than the template path.").first(),
  ).toBeVisible();
});
