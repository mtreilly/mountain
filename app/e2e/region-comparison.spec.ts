import { expect, test } from "@playwright/test";
import { installApiMocks } from "./support/mockApi";

async function selectRegion(
  page: import("@playwright/test").Page,
  pickerLabel: RegExp,
  region: string,
) {
  await page.getByRole("button", { name: pickerLabel }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder(/Search regions/i).fill(region);
  await dialog
    .getByRole("button", { name: new RegExp(region, "i") })
    .first()
    .click();
}

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

test("Region comparison flow switches mode, selects regions, and updates projection", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .locator("button:visible", { hasText: /^Regions$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/mode=regions/);
  await expect(
    page.getByRole("button", { name: /Swap chaser and target regions/i }).first(),
  ).toBeVisible();

  await selectRegion(page, /Chaser( Region)?:/i, "California");
  await expect(page.getByRole("button", { name: /Chaser( Region)?: California/i })).toBeVisible();

  await selectRegion(page, /Target( Region)?:/i, "London");
  await expect(page.getByRole("button", { name: /Target( Region)?: London/i })).toBeVisible();

  await page.getByRole("button", { name: "Fast" }).first().click();
  await expect(page).toHaveURL(/cg=0\.050/);

  await page
    .getByRole("button", { name: /Swap chaser and target regions/i })
    .first()
    .click();
  await expect(page.getByRole("button", { name: /Chaser( Region)?: London/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Target( Region)?: California/i })).toBeVisible();

  await page.getByRole("button", { name: "Table" }).click();
  await expect(page.getByRole("heading", { name: "Projection Data" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "London" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "California" })).toBeVisible();

  await page.getByRole("button", { name: "Chart" }).click();
  await expect(page.getByRole("checkbox", { name: "Milestones" })).toBeVisible();
});
