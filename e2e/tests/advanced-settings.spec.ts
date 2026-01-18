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
  nodes: [{ type: "text", content: "Welcome" }],
};

test("advanced settings: toggle and change settings", async ({ page }) => {
  let requestBody: unknown = null;

  await page.route("**/api/spec", async (route) => {
    const request = route.request();
    requestBody = JSON.parse(request.postData() || "{}");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockSpec),
    });
  });

  await page.goto("/");

  // Advanced settings should be collapsed by default
  const advancedToggle = page.getByRole("button", { name: /Advanced settings/i });
  await expect(advancedToggle).toBeVisible();

  // Open advanced settings
  await advancedToggle.click();

  // Verify settings are visible
  await expect(page.getByLabel(/Target layout/i)).toBeVisible();
  await expect(page.getByLabel(/UI strictness/i)).toBeVisible();
  await expect(page.getByText(/UX patterns/i)).toBeVisible();

  // Change target layout to tablet
  await page.getByLabel(/Target layout/i).selectOption("tablet");

  // Change UI strictness to balanced
  await page.getByLabel(/UI strictness/i).selectOption("balanced");

  // Toggle helper text checkbox
  const helperTextCheckbox = page.getByLabel(/Add helper \/ hint text/i);
  await helperTextCheckbox.check();

  // Fill prompt and generate
  const textarea = page.getByPlaceholder(/Enter your design prompt/i);
  await textarea.fill("Create a form");

  const generateButton = page.getByRole("button", { name: /Generate Spec/i });
  await generateButton.click();

  // Wait for request to complete
  await expect(page.getByText("Generated DesignSpec")).toBeVisible();

  // Verify generationContext was sent correctly
  expect(requestBody).toMatchObject({
    prompt: "Create a form",
    generationContext: {
      targetLayout: "tablet",
      uiStrictness: "balanced",
      uxPatterns: {
        groupElements: true,
        formContainer: true,
        helperText: true,
      },
    },
  });
});

test("advanced settings: default values are used when collapsed", async ({ page }) => {
  let requestBody: unknown = null;

  await page.route("**/api/spec", async (route) => {
    const request = route.request();
    requestBody = JSON.parse(request.postData() || "{}");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockSpec),
    });
  });

  await page.goto("/");

  // Generate without opening advanced settings
  const textarea = page.getByPlaceholder(/Enter your design prompt/i);
  await textarea.fill("Create a form");

  const generateButton = page.getByRole("button", { name: /Generate Spec/i });
  await generateButton.click();

  await expect(page.getByText("Generated DesignSpec")).toBeVisible();

  // Verify default generationContext
  expect(requestBody).toMatchObject({
    prompt: "Create a form",
    generationContext: {
      targetLayout: "mobile",
      uiStrictness: "strict",
      uxPatterns: {
        groupElements: true,
        formContainer: true,
        helperText: false,
      },
    },
  });
});
