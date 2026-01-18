import { expect, test } from "@playwright/test";

test("error path: handle API error", async ({ page }) => {
  await page.route("**/api/spec", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Internal server error",
        message: "OpenAI API error",
      }),
    });
  });

  await page.goto("/");

  const textarea = page.getByPlaceholder(/Enter your design prompt/i);
  await textarea.fill("Create a login form");

  const generateButton = page.getByRole("button", { name: /Generate Spec/i });
  await generateButton.click();

  await expect(page.getByText(/Error:/i)).toBeVisible();
  await expect(page.getByText(/OpenAI API error/i)).toBeVisible();
});
