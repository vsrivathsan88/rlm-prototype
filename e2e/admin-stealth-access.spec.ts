import { expect, test } from "@playwright/test";
import { emptyPersistedStore, seedPersistedStore } from "./helpers/store";

const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

test("admin nav remains hidden until stealth unlock sequence", async ({ page }) => {
  const store = emptyPersistedStore();
  store.projects = [
    {
      id: "proj-admin",
      name: "Stealth Project",
      goal: "Validate hidden admin route unlock.",
      syncStatus: "done",
      connector: null,
      files: [],
      rolloutMode: "active",
      doers: [],
      reviewers: [],
      rolloutHistory: [],
      shadowReview: { status: "idle" },
    },
  ];
  store.selectedProjectId = "proj-admin";
  await seedPersistedStore(page, store);

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Ops" })).toHaveCount(0);

  for (const key of KONAMI) {
    await page.keyboard.press(key);
  }

  await expect(page.getByRole("button", { name: "Ops" })).toBeVisible();
  await page.getByRole("button", { name: "Ops" }).click();
  await expect(page).toHaveURL(/\/admin\/control/);
  await expect(page.getByRole("heading", { name: "Admin Control" })).toBeVisible();
});

test("admin control blocks load without explicit user id", async ({ page }) => {
  await page.goto("/admin/control");
  await page.getByRole("button", { name: "Load Settings" }).click();
  await expect(page.getByText("Enter a user id before loading key settings.")).toBeVisible();
});
