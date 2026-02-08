import { expect, test } from "@playwright/test";

test("onboarding team questions reveal progressively and adaptive questions render", async ({
  page,
}) => {
  await page.route("**/v1/onboarding/adaptive-questions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ui_schema: {
          title: "What are your top priorities?",
          subtitle: "We will use this to personalize your first workspace.",
          sections: [
            {
              id: "section_priors",
              title: "Priorities",
              fields: [
                {
                  id: "top_goal",
                  type: "text",
                  label: "Top goal",
                  placeholder: "e.g. Increase qualified pipeline",
                },
              ],
            },
          ],
        },
      }),
    });
  });

  await page.goto("/onboarding");

  await expect(page.getByRole("heading", { name: "What's your job function?" })).toBeVisible();
  await page.getByTestId("role-card-product_marketing_manager").click({ force: true });
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Tell us about your team" })).toBeVisible();
  await expect(page.getByText("Your Role")).toHaveCount(0);
  await expect(page.getByText("Industry")).toHaveCount(0);
  await expect(page.getByText("Company Stage")).toHaveCount(0);

  await page.getByTestId("team-size-small").click();
  await expect(page.getByText("Your Role")).toBeVisible();

  await page.getByTestId("reporting-level-manager").click();
  await expect(page.getByText("Industry")).toBeVisible();

  await page.getByTestId("industry-saas").click();
  await expect(page.getByText("Company Stage")).toBeVisible();

  await page.getByTestId("company-stage-growth").click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "What are your top priorities?" })).toBeVisible();
  await expect(page.getByPlaceholder("e.g. Increase qualified pipeline")).toBeVisible();
});
