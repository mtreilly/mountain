import { expect, test } from "@playwright/test";
import { installApiMocks } from "./support/mockApi";

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

test("Export modal downloads observed/projection/report files", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "More options" }).click();
  await page.getByRole("menuitem", { name: "Data / Embed" }).click();
  const dialog = page.getByRole("dialog", { name: "Export Data" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("heading", { name: "Export Data" })).toBeVisible();

  const downloadByIndex = async (index: number) => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      dialog.getByRole("button", { name: "Download" }).nth(index).click(),
    ]);
    return download.suggestedFilename();
  };

  const observed = await downloadByIndex(0);
  expect(observed).toContain("-observed.csv");

  const projection = await downloadByIndex(1);
  expect(projection).toContain("-projection.csv");

  const report = await downloadByIndex(2);
  expect(report).toContain("-report.json");
});

test("Header link copy writes share URL to clipboard", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          (window as Window & { __copiedText?: string }).__copiedText = text;
          return Promise.resolve();
        },
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Link" }).click();

  const copied = await page.evaluate(
    () => (window as Window & { __copiedText?: string }).__copiedText,
  );
  expect(copied).toBeTruthy();
  expect(copied).toMatch(/\/share\?/);
  expect(copied).toContain("chaser=POL");
  expect(copied).toContain("target=GBR");
});

test("Share card modal downloads PNG for selected size", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Card" }).click();

  const dialog = page.getByRole("dialog", { name: "Create Share Card" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("radio", { name: /LinkedIn/i }).click();
  await dialog.getByRole("radio", { name: /Dark/i }).click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Download PNG" }).click(),
  ]);

  const filename = download.suggestedFilename();
  expect(filename).toMatch(/^convergence-[A-Z]{3}-[A-Z]{3}-linkedin-dark-\d{4}-\d{2}-\d{2}\.png$/);
});
