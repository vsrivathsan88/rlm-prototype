import type { Page } from "@playwright/test";

type PersistedStore = {
  projects: unknown[];
  selectedProjectId: string | null;
  onboarding: {
    job_function: string | null;
    user_profile: Record<string, unknown> | null;
    workspace: Record<string, unknown> | null;
    completed: boolean;
    welcome_dismissed: boolean;
  };
  focusMode: boolean;
  llmTelemetry: unknown[];
  hubEvents: unknown[];
  projectSetupDefaults: {
    connector: string | null;
    localSourcePath: string;
    gdriveFolderId: string | null;
    gdriveFolderName: string | null;
    crewDoers: unknown[];
    crewReviewers: unknown[];
    crewMeta: Record<string, unknown> | null;
  };
};

export async function seedPersistedStore(page: Page, state: PersistedStore): Promise<void> {
  await page.addInitScript((payload) => {
    localStorage.setItem(
      "rlm-prototype-store",
      JSON.stringify({
        state: payload,
        version: 0,
      })
    );
  }, state);
}

export function emptyPersistedStore(): PersistedStore {
  return {
    projects: [],
    selectedProjectId: null,
    onboarding: {
      job_function: null,
      user_profile: null,
      workspace: null,
      completed: true,
      welcome_dismissed: true,
    },
    focusMode: false,
    llmTelemetry: [],
    hubEvents: [],
    projectSetupDefaults: {
      connector: null,
      localSourcePath: "",
      gdriveFolderId: null,
      gdriveFolderName: null,
      crewDoers: [],
      crewReviewers: [],
      crewMeta: null,
    },
  };
}
