import { expect, test } from "@playwright/test";

const mockSpec = {
  page: "Test Page",
  frame: {
    name: "Test Frame",
    width: 400,
    layout: "vertical",
    gap: 16,
    padding: 24,
  },
  nodes: [
    { type: "text", content: "Welcome" },
    { type: "button", label: "Get Started" },
  ],
};

test("happy path: generate spec successfully", async ({ page }) => {
  await page.route("**/api/spec", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockSpec),
    });
  });

  await page.goto("/");

  const textarea = page.getByPlaceholder(/Enter your design prompt/i);
  await textarea.fill("Create a welcome page");

  const generateButton = page.getByRole("button", { name: /Generate Spec/i });
  await generateButton.click();

  await expect(page.getByText("Generated DesignSpec")).toBeVisible();

  const specViewer = page.locator(".spec-viewer-content");
  await expect(specViewer).toBeVisible();
  await expect(specViewer.getByText("Test Page")).toBeVisible();
  await expect(specViewer.getByText("Test Frame")).toBeVisible();
  await expect(specViewer.getByText('"Welcome"')).toBeVisible();
  await expect(specViewer.getByText('"Get Started"')).toBeVisible();
});
