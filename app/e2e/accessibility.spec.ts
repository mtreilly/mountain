import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { installApiMocks } from "./support/mockApi";

async function expectNoCriticalViolations(page: import("@playwright/test").Page) {
  await page.waitForTimeout(250);
  const results = await new AxeBuilder({ page }).analyze();
  const critical = results.violations.filter((v) => v.impact === "critical");

  expect(
    critical,
    critical
      .map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`)
      .join("\n"),
  ).toEqual([]);
}

async function expectNoCriticalViolationsInEmbedShell(page: import("@playwright/test").Page) {
  await page.waitForTimeout(250);
  const results = await new AxeBuilder({ page }).exclude(".embed-chart-wrapper").analyze();
  const critical = results.violations.filter((v) => v.impact === "critical");

  expect(
    critical,
    critical
      .map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`)
      .join("\n"),
  ).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

test("@a11y initial load has no critical axe violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The Mountain to Climb" })).toBeVisible();
  await expectNoCriticalViolations(page);
});

test("@a11y country picker modal has no critical axe violations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Chaser:/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectNoCriticalViolations(page);
});

test("@a11y embed mode has no critical axe violations", async ({ page }) => {
  await page.goto("/?embed=true&interactive=false&chaser=NGA&target=USA&indicator=GDP_PCAP_PPP");
  await expect(page.getByRole("link", { name: "Convergence Explorer" })).toBeVisible();
  await expectNoCriticalViolationsInEmbedShell(page);
});
