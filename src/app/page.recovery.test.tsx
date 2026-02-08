import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  useAppStore: vi.fn(),
  setProjectRolloutMode: vi.fn(),
  getProjectRolloutHistory: vi.fn(),
  getCrewVersions: vi.fn(),
  rollbackCrewVersion: vi.fn(),
  execProjectRepl: vi.fn(),
  persistCrewVersion: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  notifyInfo: vi.fn(),
  notifyWarning: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/components/layout/Header", () => ({ Header: () => <div data-testid="header" /> }));
vi.mock("@/components/layout/Sidebar", () => ({ Sidebar: () => <div data-testid="sidebar" /> }));
vi.mock("@/components/workspace/Editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));
vi.mock("@/components/workspace/CommandPanel", () => ({
  CommandPanel: () => null,
}));
vi.mock("@/components/workspace/FileUpload", () => ({
  FileUpload: () => null,
}));
vi.mock("@/components/workspace/WelcomeModal", () => ({
  WelcomeModal: () => null,
}));
vi.mock("@/components/workspace/FileSearch", () => ({
  FileSearch: () => null,
}));
vi.mock("@/components/workspace/AnnotationTooltip", () => ({
  AnnotationTooltip: () => null,
}));
vi.mock("@/components/dashboard/AgenticHubShell", () => ({
  AgenticHubShell: () => <div data-testid="hub-shell" />,
}));
vi.mock("@/components/workspace/RolloutHistoryModal", () => ({
  RolloutHistoryModal: () => null,
}));
vi.mock("@/components/workspace/RightPanel", () => ({
  RightPanel: (props: { onRecoverToActive?: () => void }) => (
    <button onClick={() => props.onRecoverToActive?.()}>Trigger Recover</button>
  ),
}));

vi.mock("@/lib/review-orchestrator", () => ({
  runReview: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  execProjectRepl: (...args: unknown[]) => mocks.execProjectRepl(...args),
  getCrewVersions: (...args: unknown[]) => mocks.getCrewVersions(...args),
  getProjectRolloutHistory: (...args: unknown[]) => mocks.getProjectRolloutHistory(...args),
  rollbackCrewVersion: (...args: unknown[]) => mocks.rollbackCrewVersion(...args),
  persistCrewVersion: (...args: unknown[]) => mocks.persistCrewVersion(...args),
  reviewDocumentShadow: vi.fn(),
  setProjectRolloutMode: (...args: unknown[]) => mocks.setProjectRolloutMode(...args),
}));

vi.mock("@/components/ui/NotificationCenter", () => ({
  notify: {
    success: (...args: unknown[]) => mocks.notifySuccess(...args),
    error: (...args: unknown[]) => mocks.notifyError(...args),
    info: (...args: unknown[]) => mocks.notifyInfo(...args),
    warning: (...args: unknown[]) => mocks.notifyWarning(...args),
  },
}));

vi.mock("@/lib/store", () => ({
  useAppStore: () => mocks.useAppStore(),
}));

function makeStore(overrides?: {
  updateProject?: ReturnType<typeof vi.fn>;
  rolloutMode?: "baseline" | "shadow" | "active";
}) {
  const updateProject = overrides?.updateProject ?? vi.fn();
  return {
    projects: [
      {
        id: "p1",
        name: "Project One",
        goal: "Ship with confidence",
        rolloutMode: overrides?.rolloutMode ?? "shadow",
        rolloutHistory: [],
        syncStatus: "idle",
        connector: null,
        files: [{ id: "f1", name: "brief.md", type: "file" }],
        reviewers: [],
        shadowReview: { status: "idle" },
        decisionLog: [],
        escalation: null,
        capacity: {
          maxConcurrentDoers: 3,
          maxReviewerRunsPerDraft: 5,
          reviewerRunsCurrentDraft: 0,
          queueDepth: 0,
        },
      },
    ],
    selectedProjectId: "p1",
    selectProject: vi.fn(),
    updateProject,
    onboarding: {
      completed: true,
      welcome_dismissed: true,
      user_profile: null,
      workspace: null,
      job_function: "pm",
    },
    setOnboarding: vi.fn(),
    review: {
      isReviewing: false,
      runningJudgeId: null,
      results: [],
      summary: null,
      conflicts: [],
      activeAnnotationId: null,
      visibleJudgeIds: new Set(),
    },
    startReview: vi.fn(),
    setReviewResults: vi.fn(),
    clearReview: vi.fn(),
    setActiveAnnotation: vi.fn(),
    toggleJudgeVisibility: vi.fn(),
    updateSingleResult: vi.fn(),
    setRunningJudgeId: vi.fn(),
    focusMode: false,
    setFocusMode: vi.fn(),
    setGlobalActivity: vi.fn(),
    llmTelemetry: [],
    addLlmTelemetryEvent: vi.fn(),
    hubEvents: [],
    addHubEvent: vi.fn(),
    appendDecisionLog: vi.fn(),
    setProjectEscalation: vi.fn(),
    setProjectCapacity: vi.fn(),
    clearHubEvents: vi.fn(),
    updateProjectSetupDefaults: vi.fn(),
  };
}

describe("Home recovery flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProjectRolloutHistory.mockResolvedValue({ project_id: "p1", events: [] });
    mocks.getCrewVersions.mockResolvedValue({ project_id: "p1", versions: [] });
  });

  it("recovers to active and shows success notification", async () => {
    const updateProject = vi.fn();
    mocks.useAppStore.mockReturnValue(makeStore({ updateProject, rolloutMode: "shadow" }));
    mocks.setProjectRolloutMode.mockResolvedValue({
      project_id: "p1",
      mode: "active",
      updated_at: "2026-02-07T12:00:00Z",
      effective_from_next_run: true,
    });

    render(<Home />);
    await waitFor(() => {
      expect(mocks.getProjectRolloutHistory).toHaveBeenCalledWith("p1");
    });
    updateProject.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /trigger recover/i }));

    await waitFor(() => {
      expect(mocks.setProjectRolloutMode).toHaveBeenCalledWith(
        "p1",
        "active",
        "guided recovery after fallback"
      );
    });
    expect(updateProject).toHaveBeenCalledWith("p1", { rolloutMode: "active" });
    await waitFor(() => {
      expect(mocks.notifySuccess).toHaveBeenCalledWith(
        "Recovery Complete",
        "Project returned to active rollout mode. Monitor next review runs closely."
      );
    });
    expect(mocks.notifyError).not.toHaveBeenCalled();
  });

  it("rolls back mode and shows error when recovery fails", async () => {
    const updateProject = vi.fn();
    mocks.useAppStore.mockReturnValue(makeStore({ updateProject, rolloutMode: "shadow" }));
    mocks.setProjectRolloutMode.mockRejectedValue(new Error("boom"));

    render(<Home />);
    await waitFor(() => {
      expect(mocks.getProjectRolloutHistory).toHaveBeenCalledWith("p1");
    });
    updateProject.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /trigger recover/i }));

    await waitFor(() => {
      expect(mocks.setProjectRolloutMode).toHaveBeenCalled();
    });
    expect(updateProject).toHaveBeenCalledWith("p1", { rolloutMode: "active" });
    await waitFor(() => {
      expect(updateProject).toHaveBeenCalledWith("p1", { rolloutMode: "shadow" });
    });
    expect(mocks.notifyError).toHaveBeenCalledWith("Recovery Failed", "boom");
  });
});
