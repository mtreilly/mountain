import { expect, test } from "@playwright/test";
import { installApiMocks } from "./support/mockApi";

async function selectCountry(
  page: import("@playwright/test").Page,
  pickerLabel: RegExp,
  country: string,
) {
  await page.getByRole("button", { name: pickerLabel }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder("Search countries…").fill(country);
  await dialog
    .getByRole("button", { name: new RegExp(country, "i") })
    .first()
    .click();
}

async function selectMetric(page: import("@playwright/test").Page, metricName: string) {
  await page
    .getByRole("button", { name: /GDP per capita \(PPP\)|Life expectancy at birth/i })
    .click();
  await page.getByPlaceholder("Search metrics...").fill(metricName);
  await page.getByRole("option", { name: new RegExp(metricName, "i") }).click();
}

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

test("Country comparison flow updates selectors, growth, and projection view", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: /Chaser: Nigeria/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Target: Ireland/i })).toBeVisible();

  await selectCountry(page, /Target: Ireland/i, "United States");
  await expect(page.getByRole("button", { name: /Target: United States/i })).toBeVisible();

  await selectMetric(page, "Life expectancy");
  await expect(page.getByRole("button", { name: /Life expectancy at birth/i })).toBeVisible();

  await page.getByRole("button", { name: "Rapid" }).first().click();
  await expect(page).toHaveURL(/cg=0\.070/);

  const summary = page
    .locator("div.card")
    .filter({ hasText: /could match|won't catch up|already ahead/i })
    .first();
  await expect(summary).toBeVisible();

  await page.getByRole("button", { name: "Table" }).click();
  await expect(page.getByRole("heading", { name: "Projection Data" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Year" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Nigeria" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "United States" })).toBeVisible();

  await page.getByRole("button", { name: "Chart" }).click();
  const milestonesToggle = page.getByRole("checkbox", { name: "Milestones" });
  await expect(milestonesToggle).toBeChecked();
  await milestonesToggle.uncheck();
  await expect(milestonesToggle).not.toBeChecked();
  await milestonesToggle.check();
  await expect(milestonesToggle).toBeChecked();
});
