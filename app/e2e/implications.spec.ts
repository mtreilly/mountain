import { expect, test } from "@playwright/test";
import { installApiMocks } from "./support/mockApi";

async function clickDeterministic(locator: import("@playwright/test").Locator) {
  await expect(locator).toBeVisible({ timeout: 30_000 });
  await locator.evaluate((el: HTMLElement) => el.click());
}

async function openImplications(page: import("@playwright/test").Page) {
  // Desktop and mobile each render the trigger; only one is visible per breakpoint.
  const trigger = page
    .getByRole("button", { name: /^Development implications\b/i })
    .locator("visible=true")
    .first();
  await clickDeterministic(trigger);

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
  await expect(panel.getByRole("heading", { name: /^The picture in \d{4}$/ })).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Power to build" })).toBeVisible();
  await expect(panel.getByRole("heading", { name: "What this assumes" })).toBeVisible();
  await expect(panel.getByText("Income per person")).toBeVisible();
  await expect(panel.getByText("Electricity use", { exact: true })).toBeVisible();
  // Either a signed amount to build or an explicit "none needed", never a bare 0.0
  await expect(panel.getByText(/a year more than today|No extra generation needed/)).toBeVisible();
  await expect(panel).not.toContainText("0.0 TWh a year more");

  // Path explanation and the UN population caveat with its source link
  await expect(panel.getByText(/As incomes rose in /)).toBeVisible();
  await expect(
    panel.getByRole("link", { name: "Jesús Fernández-Villaverde on why" }),
  ).toHaveAttribute("href", /youtube\.com/);

  await expect(panel).not.toContainText("NaN");
  await expect(panel).not.toContainText("undefined");
  await expect(panel).toContainText("An illustration, not a forecast");
});

test("selected assumptions persist into the thread with exact numeric parity", async ({ page }) => {
  await page.goto("/");
  await openImplications(page);

  const panel = page.getByRole("dialog", { name: "Development Implications" });
  await clickDeterministic(panel.getByRole("button", { name: "Low", exact: true }));
  await clickDeterministic(panel.getByText("Fine-tune the assumptions"));
  await panel.getByRole("spinbutton", { name: "Grid losses %" }).fill("7");
  await panel.getByRole("spinbutton", { name: "Net imports (gross supply share) %" }).fill("12");
  const headline = await panel.getByText(/a year more than today/).textContent();
  const buildout = headline?.match(/([\d.]+) TWh/)?.[1];
  expect(buildout).toBeTruthy();

  await clickDeterministic(panel.getByRole("button", { name: "Close Development Implications" }));
  await clickDeterministic(page.getByRole("button", { name: "Thread", exact: true }));
  const thread = page.getByRole("dialog");
  await expect(thread).toBeVisible();
  const implicationResultTweet = thread.getByLabel("Tweet").nth(3);
  const implicationAssumptionsTweet = thread.getByLabel("Tweet").nth(4);
  const resultCaption = await implicationResultTweet.inputValue();
  const assumptionsCaption = await implicationAssumptionsTweet.inputValue();
  expect(resultCaption).toContain(`${Math.round(Number(buildout))} TWh/year`);
  expect(resultCaption).not.toContain("What convergence means");
  expect(assumptionsCaption).toContain("UN low population");
  expect(assumptionsCaption).toContain("7% grid losses");
  expect(assumptionsCaption).toContain("12% net imports");
  expect(resultCaption.length).toBeLessThanOrEqual(280);
  expect(assumptionsCaption.length).toBeLessThanOrEqual(280);
});

test("Implications controls update path and scenario context", async ({ page }) => {
  await page.goto("/");
  await openImplications(page);

  const panel = page.getByRole("dialog", { name: "Development Implications" });

  const usPath = panel.getByRole("button", { name: "US", exact: true });
  await clickDeterministic(usPath);
  await expect(usPath).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByText(/As incomes rose in the US/)).toBeVisible();

  await clickDeterministic(panel.getByText("Fine-tune the assumptions"));
  const efficientGrowthButton = panel.getByRole("button", {
    name: "Efficient growth",
    exact: true,
  });
  await clickDeterministic(efficientGrowthButton);
  await expect(
    panel.getByText("Less energy/electricity per unit of GDP than the template path.").first(),
  ).toBeVisible();
});
