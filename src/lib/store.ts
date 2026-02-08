import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { ReviewerColor } from "./reviewer-colors";
import type {
  DoerDefinition,
  DomainProject,
  DomainUserProfile,
  HubEvent as DomainHubEvent,
  ReviewerDefinition,
} from "./domain-schema";
import type {
  BackendConflict,
  RolloutHistoryEvent as ApiRolloutHistoryEvent,
} from "./api";

export type RolloutHistoryEvent = ApiRolloutHistoryEvent;

export type TreeNode = {
  id: string;
  name: string;
  type: "folder" | "file";
  children?: TreeNode[];
};

export type Document = {
  id: string;
  title: string;
  outline?: string[];
  status: "draft" | "in_progress" | "complete";
  content?: string;
};

export type Reviewer = ReviewerDefinition;
export type Doer = DoerDefinition;

// --- Review annotation types ---

export type AnnotationSeverity = "info" | "warning" | "critical";

export type ReviewAnnotation = {
  id: string;
  judgeId: string;
  startLine: number;
  endLine: number;
  startPos?: number;
  endPos?: number;
  message: string;
  severity: AnnotationSeverity;
  criterion?: string;
};

export type ReviewResultFE = {
  judgeId: string;
  judgeName: string;
  score: number;
  decision: "pass" | "pass_with_warnings" | "fail";
  reasoning: string;
  annotations: ReviewAnnotation[];
  filesReferenced: string[];
  color: ReviewerColor;
};

export type ReviewSummaryFE = {
  overallScore: number;
  consensus: Record<string, number>;
  totalIssues: number;
  conflictsDetected: number;
};

export type ReviewState = {
  isReviewing: boolean;
  runningJudgeId: string | null; // non-null when a single reviewer is re-running
  results: ReviewResultFE[];
  summary: ReviewSummaryFE | null;
  conflicts: BackendConflict[];
  activeAnnotationId: string | null;
  visibleJudgeIds: Set<string>;
};

export type GlobalActivity = {
  title: string;
  detail?: string;
  progressCurrent?: number;
  progressTotal?: number;
};

export type LlmRouteAttempt = {
  provider: string;
  model: string;
  success: boolean;
  latency_ms: number;
  error?: string;
};

export type LlmTelemetryEvent = {
  id: string;
  task: string;
  timestamp: string;
  winner_provider?: string;
  winner_model?: string;
  fallback_used: boolean;
  rollout_mode?: string;
  attempts: LlmRouteAttempt[];
};

// --- Existing types ---

export type QuickAction = {
  id: string;
  label: string;
  icon: string;
};

export type ShadowReviewSnapshot = {
  status: "idle" | "running" | "done" | "error";
  last_run_at?: string;
  decision_agreement_rate?: number;
  precision_proxy?: number;
  recall_proxy?: number;
  mean_score_delta?: number;
  pair_count?: number;
  error?: string;
};

export type KeyResult = {
  metric: string;
  baseline: string;
  target: string;
  timeframe: string;
  description: string;
};

export type Objective = {
  objective: string;
  key_results: KeyResult[];
};

export type Project = DomainProject & {
  okrs?: Objective[];
  files?: TreeNode[];
  documents?: Document[];
  quick_actions?: QuickAction[];
  shadowReview?: ShadowReviewSnapshot;
  rolloutHistory?: RolloutHistoryEvent[];
};

export type WorkspaceDefinition = {
  first_project: {
    name: string;
    description: string;
    goal: string;
    target_audience: string;
    key_messages: string[];
    example_document_title: string;
    example_document_outline: string[];
  };
  reviewers: Reviewer[];
  quick_actions: QuickAction[];
  okrs: Objective[];
};

export type UserProfile = DomainUserProfile;

export type HubEvent = DomainHubEvent;

export type OnboardingState = {
  job_function: string | null;
  user_profile: UserProfile | null;
  workspace: WorkspaceDefinition | null;
  completed: boolean;
  welcome_dismissed: boolean;
};

export type ProjectSetupDefaults = {
  connector: string | null;
  localSourcePath: string;
  gdriveFolderId: string | null;
  gdriveFolderName: string | null;
  crewDoers?: Doer[];
  crewReviewers?: Reviewer[];
  crewMeta?: Record<string, unknown> | null;
};

const initialReviewState: ReviewState = {
  isReviewing: false,
  runningJudgeId: null,
  results: [],
  summary: null,
  conflicts: [],
  activeAnnotationId: null,
  visibleJudgeIds: new Set(),
};

const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    const value = localStorage.getItem(name);
    if (!value) return null;

    try {
      JSON.parse(value);
      return value;
    } catch {
      localStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
};

type Store = {
  projects: Project[];
  selectedProjectId: string | null;
  onboarding: OnboardingState;
  focusMode: boolean;
  review: ReviewState;
  globalActivity: GlobalActivity | null;
  llmTelemetry: LlmTelemetryEvent[];
  hubEvents: HubEvent[];
  projectSetupDefaults: ProjectSetupDefaults;

  setOnboarding: (payload: Partial<OnboardingState>) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  completeOnboarding: (workspace: WorkspaceDefinition) => void;
  createProject: (project: Project) => void;
  selectProject: (id: string | null) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  setFocusMode: (enabled: boolean) => void;

  // Review actions
  startReview: () => void;
  setReviewResults: (
    results: ReviewResultFE[],
    summary: ReviewSummaryFE,
    conflicts: BackendConflict[]
  ) => void;
  updateSingleResult: (result: ReviewResultFE) => void;
  setRunningJudgeId: (judgeId: string | null) => void;
  clearReview: () => void;
  setActiveAnnotation: (id: string | null) => void;
  toggleJudgeVisibility: (judgeId: string) => void;
  setGlobalActivity: (activity: GlobalActivity | null) => void;
  addLlmTelemetryEvent: (event: LlmTelemetryEvent) => void;
  clearLlmTelemetry: () => void;
  addHubEvent: (event: Omit<HubEvent, "id" | "timestamp"> & { id?: string; timestamp?: string }) => void;
  clearHubEvents: (projectId?: string) => void;
  updateProjectSetupDefaults: (updates: Partial<ProjectSetupDefaults>) => void;
};

export const useAppStore = create<Store>()(
  persist(
    (set) => ({
      projects: [],
      selectedProjectId: null,
      onboarding: {
        job_function: null,
        user_profile: null,
        workspace: null,
        completed: false,
        welcome_dismissed: false,
      },
      focusMode: false,
      review: initialReviewState,
      globalActivity: null,
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

      setOnboarding: (payload) =>
        set((state) => ({ onboarding: { ...state.onboarding, ...payload } })),
      setUserProfile: (profile) =>
        set((state) => ({
          onboarding: {
            ...state.onboarding,
            user_profile: profile,
          },
        })),

      completeOnboarding: (workspace: WorkspaceDefinition) => {
        const projectId = `proj-${Date.now()}`;
        const firstProject: Project = {
          id: projectId,
          name: workspace.first_project.name,
          description: workspace.first_project.description,
          goal: workspace.first_project.goal,
          target_audience: workspace.first_project.target_audience,
          key_messages: workspace.first_project.key_messages,
          okrs: workspace.okrs,
          documents: [
            {
              id: `doc-${Date.now()}`,
              title: workspace.first_project.example_document_title,
              outline: workspace.first_project.example_document_outline,
              status: "draft",
            },
          ],
          reviewers: workspace.reviewers,
          quick_actions: workspace.quick_actions,
          files: [],
          syncStatus: "idle",
          rolloutMode: "active",
        };

        set((state) => ({
          projects: [...state.projects, firstProject],
          selectedProjectId: projectId,
          onboarding: {
            ...state.onboarding,
            workspace,
            completed: true,
          },
        }));
      },

      createProject: (project) =>
        set((state) => ({
          projects: [...state.projects, project],
          selectedProjectId: project.id,
        })),

      selectProject: (id) => set(() => ({ selectedProjectId: id })),

      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),
      setFocusMode: (enabled) => set(() => ({ focusMode: enabled })),

      // Review actions
      startReview: () =>
        set((state) => ({
          review: { ...state.review, isReviewing: true },
        })),

      setReviewResults: (results, summary, conflicts) =>
        set(() => ({
          review: {
            isReviewing: false,
            runningJudgeId: null,
            results,
            summary,
            conflicts,
            activeAnnotationId: null,
            visibleJudgeIds: new Set(results.map((r) => r.judgeId)),
          },
        })),

      updateSingleResult: (result) =>
        set((state) => {
          const existing = state.review.results.findIndex(
            (r) => r.judgeId === result.judgeId
          );
          const results =
            existing >= 0
              ? state.review.results.map((r) =>
                  r.judgeId === result.judgeId ? result : r
                )
              : [...state.review.results, result];
          const visible = new Set(state.review.visibleJudgeIds);
          visible.add(result.judgeId);
          return {
            review: {
              ...state.review,
              runningJudgeId: null,
              results,
              visibleJudgeIds: visible,
            },
          };
        }),

      setRunningJudgeId: (judgeId) =>
        set((state) => ({
          review: { ...state.review, runningJudgeId: judgeId },
        })),

      clearReview: () => set(() => ({ review: initialReviewState })),

      setActiveAnnotation: (id) =>
        set((state) => ({
          review: { ...state.review, activeAnnotationId: id },
        })),

      toggleJudgeVisibility: (judgeId) =>
        set((state) => {
          const next = new Set(state.review.visibleJudgeIds);
          if (next.has(judgeId)) {
            next.delete(judgeId);
          } else {
            next.add(judgeId);
          }
          return { review: { ...state.review, visibleJudgeIds: next } };
        }),

      setGlobalActivity: (activity) => set(() => ({ globalActivity: activity })),

      addLlmTelemetryEvent: (event) =>
        set((state) => ({
          llmTelemetry: [event, ...state.llmTelemetry].slice(0, 40),
        })),
      clearLlmTelemetry: () => set(() => ({ llmTelemetry: [] })),
      addHubEvent: (event) =>
        set((state) => {
          const nextEvent: HubEvent = {
            ...event,
            id: event.id || `hub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: event.timestamp || new Date().toISOString(),
          };
          return {
            hubEvents: [nextEvent, ...state.hubEvents].slice(0, 120),
          };
        }),
      clearHubEvents: (projectId) =>
        set((state) => ({
          hubEvents: projectId
            ? state.hubEvents.filter((event) => event.project_id !== projectId)
            : [],
        })),
      updateProjectSetupDefaults: (updates) =>
        set((state) => ({
          projectSetupDefaults: { ...state.projectSetupDefaults, ...updates },
        })),
    }),
    {
      name: "rlm-prototype-store",
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        projects: state.projects,
        selectedProjectId: state.selectedProjectId,
        onboarding: state.onboarding,
        focusMode: state.focusMode,
        llmTelemetry: state.llmTelemetry,
        hubEvents: state.hubEvents,
        projectSetupDefaults: state.projectSetupDefaults,
        // Do NOT persist review state — positions are ephemeral
        // Do NOT persist global activity — it is runtime-only
      }),
    }
  )
);
