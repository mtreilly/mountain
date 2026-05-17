import { expect, test } from "@playwright/test";
import { installApiMocks } from "./support/mockApi";

function trackClientErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    errors.push(err.message);
  });
  return () => errors;
}

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

test("App loads with core UI visible", async ({ page }) => {
  const getErrors = trackClientErrors(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The Mountain to Climb" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Chaser: Poland/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Target: United Kingdom/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Metric" })).toContainText("GDP per capita (PPP)");

  const errors = getErrors();
  expect(errors, `console/page errors: ${errors.join("\n")}`).toEqual([]);
});

test("Embed mode renders embed view without app header", async ({ page }) => {
  const getErrors = trackClientErrors(page);

  await page.goto("/?embed=true&interactive=false&chaser=POL&target=USA&indicator=GDP_PCAP_PPP");

  await expect(page.getByRole("heading", { name: "The Mountain to Climb" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Convergence Explorer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cite" })).toBeVisible();

  const errors = getErrors();
  expect(errors, `console/page errors: ${errors.join("\n")}`).toEqual([]);
});

test("Share URL pre-fills countries and metric", async ({ page }) => {
  const getErrors = trackClientErrors(page);

  await page.goto(
    "/?chaser=USA&target=NGA&indicator=GDP_PCAP_PPP&cg=0.05&tg=0.02&tmode=growing&baseYear=2023",
  );

  await expect(page.getByRole("button", { name: /Chaser: United States/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Target: Nigeria/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Metric" })).toContainText("GDP per capita (PPP)");

  const errors = getErrors();
  expect(errors, `console/page errors: ${errors.join("\n")}`).toEqual([]);
});

test("Invalid URL params fall back to defaults", async ({ page }) => {
  const getErrors = trackClientErrors(page);

  await page.goto("/?chaser=XXX&target=YYY&indicator=NOT_A_REAL_METRIC&tmode=growing");

  await expect(page.getByRole("button", { name: /Chaser: Poland/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Target: United Kingdom/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Metric" })).toContainText("GDP per capita (PPP)");

  const errors = getErrors();
  expect(errors, `console/page errors: ${errors.join("\n")}`).toEqual([]);
});
