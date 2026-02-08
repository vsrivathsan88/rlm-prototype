import { expect, test } from "@playwright/test";
import { emptyPersistedStore, seedPersistedStore } from "./helpers/store";

test("project wizard generates crew cards and supports in-place identity edits", async ({
  page,
}) => {
  await seedPersistedStore(page, emptyPersistedStore());

  await page.route("**/v1/projects/generate-crew", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        doers: [
          {
            id: "mission_planner",
            name: "Mission Planner",
            description: "Converts broad goals into practical execution plans.",
            strictness: "medium",
            goals_kpis: ["Milestone clarity", "Owner accountability"],
            skills: ["Planning", "Scoping"],
          },
        ],
        reviewers: [
          {
            id: "fact_integrity_reviewer",
            name: "Fact Integrity Reviewer",
            reason: "Verifies claims with source-backed evidence.",
            description: "Flags unsupported statements before publish.",
            strictness: "high",
            goals_kpis: ["Evidence coverage"],
            skills: ["Verification"],
          },
        ],
        _meta: { provider: "mock" },
      }),
    });
  });

  await page.goto("/projects/new");
  await page.getByPlaceholder("e.g., Q2 Launch Brief").fill("Q2 Launch Brief");
  await page.getByRole("button", { name: "Google Drive" }).click();
  await page.getByPlaceholder("e.g., Build launch brief with evidence and risks").fill(
    "Build a specific launch brief with evidence."
  );

  await page.getByRole("button", { name: "Personalize" }).click();
  await page.getByRole("button", { name: "Pro", exact: true }).click();

  await expect(page.getByTestId("crew-edit-mission_planner")).toBeVisible();
  await expect(page.getByTestId("crew-edit-fact_integrity_reviewer")).toBeVisible();
  await expect(page.getByText("Doers (Builders) & Reviewers (Critics)")).toBeVisible();

  await page.getByTestId("crew-edit-mission_planner").click({ force: true });
  await expect(page.getByRole("heading", { name: "Edit Doer (Builder) Identity" })).toBeVisible();

  await page.getByTestId("crew-identity-name-input").fill("Mission Commander");
  await page.getByTestId("crew-identity-save").first().click();

  await expect(page.getByText("Mission Commander", { exact: true }).first()).toBeVisible();
});
