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
  await expect(panel.getByText("GDP/capita (2023)")).toBeVisible();
  await expect(panel.getByText("End-use demand", { exact: true })).toBeVisible();
  await expect(panel.getByText("Gross supply required", { exact: true })).toBeVisible();
  await expect(panel.getByText("Domestic generation required", { exact: true })).toBeVisible();
  await expect(panel.getByText("Observed domestic generation", { exact: true })).toBeVisible();
  await expect(panel.getByText("New domestic generation", { exact: true })).toBeVisible();
  await expect(panel.getByText("376 TWh (2023) → 482 TWh (2048)")).toBeVisible();
  await expect(panel.getByText("536 TWh", { exact: true }).first()).toBeVisible();
  await expect(panel.getByText("40 TWh", { exact: true })).toBeVisible();
  await expect(panel.getByText("496 TWh", { exact: true }).first()).toBeVisible();

  await expect(panel).not.toContainText("NaN");
  await expect(panel).not.toContainText("undefined");
  await expect(panel).toContainText("Illustrative scenario, not a forecast");
});

test("selected assumptions persist into the thread with exact numeric parity", async ({ page }) => {
  await page.goto("/");
  await openImplications(page);

  const panel = page.getByRole("dialog", { name: "Development Implications" });
  await clickDeterministic(panel.getByRole("button", { name: "UN low" }));
  await panel.getByRole("spinbutton", { name: "Grid losses %" }).fill("7");
  await panel.getByRole("spinbutton", { name: "Net imports (gross supply share) %" }).fill("12");
  const buildoutText = await panel.getByText(/Shared buildout used for every row:/).textContent();
  const buildout = buildoutText?.match(/([\d.]+) TWh/)?.[1];
  expect(buildout).toBeTruthy();

  await clickDeterministic(panel.getByRole("button", { name: "Close Development Implications" }));
  await clickDeterministic(page.getByRole("button", { name: "Thread", exact: true }));
  const thread = page.getByRole("dialog");
  await expect(thread).toBeVisible();
  const implicationTweet = thread.getByLabel("Tweet").nth(3);
  const caption = await implicationTweet.inputValue();
  expect(caption).toContain("UN low population");
  expect(caption).toContain("7% grid losses");
  expect(caption).toContain("12% net imports");
  expect(caption).toContain(`${Math.round(Number(buildout))} TWh/year`);
  expect(caption).not.toContain("What convergence means");
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
