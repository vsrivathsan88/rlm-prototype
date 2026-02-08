import { expect, test } from "@playwright/test";
import { emptyPersistedStore, seedPersistedStore } from "./helpers/store";

test("hub mention routing works from the inline command composer", async ({
  page,
}) => {
  const store = emptyPersistedStore();
  store.projects = [
    {
      id: "proj-1",
      name: "Launch Command",
      goal: "Ship a high-confidence launch narrative.",
      syncStatus: "done",
      connector: null,
      files: [{ id: "f-1", name: "brief.md", type: "file" }],
      rolloutMode: "active",
      doers: [
        {
          id: "mission_planner",
          name: "Mission Planner",
          description: "Plans execution milestones and owner handoffs.",
          strictness: "medium",
          enabled: true,
        },
      ],
      reviewers: [
        {
          id: "fact_integrity_reviewer",
          name: "Fact Integrity Reviewer",
          reason: "Checks source-backed correctness before publish.",
          strictness: "high",
          enabled: true,
        },
      ],
      rolloutHistory: [],
      shadowReview: { status: "idle" },
    },
  ];
  store.selectedProjectId = "proj-1";
  await seedPersistedStore(page, store);

  let replPayload: Record<string, unknown> | null = null;

  await page.route("**/v1/projects/proj-1/rollout-history", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ project_id: "proj-1", events: [] }),
    });
  });

  await page.route("**/v1/projects/proj-1/repl/exec", async (route) => {
    replPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        stdout: "Generated summary output.",
        result: null,
        error: null,
        llm_meta: [],
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByText("Mission Planner")).toBeVisible();
  await expect(page.getByText("Fact Integrity Reviewer").first()).toBeVisible();

  await page
    .getByPlaceholder("Ask for a summary, rewrite, evidence check... (tag @id, @name_alias, or @{Display Name})")
    .fill("@{Mission Planner} Write a concise summary for executives.");
  await page.getByRole("button", { name: "Run", exact: true }).click();

  await expect(
    page.getByPlaceholder(
      "Ask for a summary, rewrite, evidence check... (tag @id, @name_alias, or @{Display Name})"
    )
  ).toHaveValue("");
  expect(replPayload).toBeTruthy();
  const serialized = JSON.stringify(replPayload);
  expect(serialized).toContain("Write a concise summary for executives.");
  expect(serialized).not.toContain("@{Mission Planner}");
});
