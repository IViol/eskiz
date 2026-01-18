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

test("collapsible viewer: expand and collapse", async ({ page }) => {
  await page.route("**/api/spec", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockSpec),
    });
  });

  await page.goto("/");

  // Generate spec
  const textarea = page.getByPlaceholder(/Enter your design prompt/i);
  await textarea.fill("Create a welcome page");

  const generateButton = page.getByRole("button", { name: /Generate Spec/i });
  await generateButton.click();

  // SpecViewer should be visible and expanded by default
  const specViewerHeader = page.getByText("Generated DesignSpec");
  await expect(specViewerHeader).toBeVisible();

  const specContent = page.locator(".spec-viewer-content");
  await expect(specContent).toBeVisible();
  await expect(specContent.getByText("Test Page")).toBeVisible();

  // Check that content wrapper is open
  const contentWrapper = page.locator(".spec-viewer-content-wrapper");
  await expect(contentWrapper).toHaveAttribute("data-state", "open");

  // Collapse by clicking header
  const collapsibleTrigger = page.locator(".spec-viewer-header");
  await collapsibleTrigger.click();

  // Wait for content to be closed
  await expect(contentWrapper).toHaveAttribute("data-state", "closed", { timeout: 5000 });

  // Expand again
  await collapsibleTrigger.click();
  await expect(contentWrapper).toHaveAttribute("data-state", "open");
  await expect(specContent.getByText("Test Page")).toBeVisible();
});

test("collapsible viewer: copy and download buttons work", async ({ page }) => {
  await page.route("**/api/spec", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockSpec),
    });
  });

  // Mock clipboard API
  await page.addInitScript(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: async () => Promise.resolve(),
      },
    });
  });

  await page.goto("/");

  // Generate spec
  const textarea = page.getByPlaceholder(/Enter your design prompt/i);
  await textarea.fill("Create a welcome page");

  const generateButton = page.getByRole("button", { name: /Generate Spec/i });
  await generateButton.click();

  await expect(page.getByText("Generated DesignSpec")).toBeVisible();

  // Find copy button by title attribute and verify it's clickable
  const copyButton = page.locator('button[title="Copy to clipboard"]');
  await expect(copyButton).toBeEnabled();
  await copyButton.click();

  // Find download button by title attribute and verify it's clickable
  const downloadButton = page.locator('button[title="Download spec.json"]');
  await expect(downloadButton).toBeEnabled();
  await downloadButton.click();

  // Both buttons should be functional (we verify they're clickable and don't throw errors)
});

test("collapsible viewer: auto-expands on new generation", async ({ page }) => {
  const firstSpec = {
    page: "First Page",
    frame: {
      name: "First Frame",
      width: 400,
      layout: "vertical",
      gap: 16,
      padding: 24,
    },
    nodes: [{ type: "text", content: "First" }],
  };

  const secondSpec = {
    page: "Second Page",
    frame: {
      name: "Second Frame",
      width: 400,
      layout: "vertical",
      gap: 16,
      padding: 24,
    },
    nodes: [{ type: "text", content: "Second" }],
  };

  let requestCount = 0;
  await page.route("**/api/spec", async (route) => {
    requestCount++;
    const spec = requestCount === 1 ? firstSpec : secondSpec;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(spec),
    });
  });

  await page.goto("/");

  // Generate first spec
  const textarea = page.getByPlaceholder(/Enter your design prompt/i);
  await textarea.fill("First prompt");

  const generateButton = page.getByRole("button", { name: /Generate Spec/i });
  await generateButton.click();

  await expect(page.getByText("First Page")).toBeVisible();

  // Collapse viewer
  const collapsibleTrigger = page.locator(".spec-viewer-header");
  await collapsibleTrigger.click();

  let contentWrapper = page.locator(".spec-viewer-content-wrapper");
  await expect(contentWrapper).toHaveAttribute("data-state", "closed");

  // Generate second spec
  await textarea.fill("Second prompt");
  await generateButton.click();

  // Viewer should auto-expand with new content
  contentWrapper = page.locator(".spec-viewer-content-wrapper");
  await expect(contentWrapper).toHaveAttribute("data-state", "open");
  await expect(page.getByText("Second Page")).toBeVisible();
});
