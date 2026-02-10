/**
 * Backend API client for Project Lens.
 */
import type { DoerDefinition, ReviewerDefinition } from "./domain-schema";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// --- Review API types (mirror backend/src/lens_backend/schemas/reviews.py) ---

export interface ReviewRequestPayload {
  document_text: string;
  judge_ids: string[];
  project_id?: string;
  profile_context?: {
    job_function?: string;
    team_size?: string;
    reporting_level?: string;
    industry?: string;
    company_stage?: string;
    current_work?: Record<string, unknown>;
  };
  reviewer_context?: Array<{
    id: string;
    name: string;
    description?: string;
    system_prompt?: string;
    strictness?: "low" | "medium" | "high";
    rubric?: {
      criteria?: Array<{
        id: string;
        name: string;
        description: string;
        weight: number;
        threshold: number;
        severity: "critical" | "warning" | "info";
      }>;
      scoring_scale?: string;
      decision_rules?: string[];
    };
  }>;
}

export interface BackendAnnotation {
  start: number;
  end: number;
  message: string;
  severity: "info" | "warning" | "critical";
  criterion?: string;
}

export interface BackendReviewResult {
  judge_id: string;
  judge_name: string;
  score: number;
  annotations: BackendAnnotation[];
  decision: string;
  reasoning: string;
  files_referenced?: string[];
}

export interface BackendConflictOpinion {
  judge_id: string;
  judge_name: string;
  severity: string;
  message: string;
  decision: string;
  score: number;
}

export interface BackendResolutionOption {
  label: string;
  description: string;
  tradeoffs: string;
  recommended: boolean;
}

export interface BackendConflict {
  conflict_id: string;
  location: string;
  issue: string;
  reviewers: string[];
  opinions: BackendConflictOpinion[];
  severity: string;
  summary?: string;
  options?: BackendResolutionOption[];
}

export interface BackendReviewSummary {
  overall_score: number;
  consensus: Record<string, number>;
  total_issues: number;
  conflicts_detected: number;
}

export interface BackendLlmRouteAttempt {
  provider: string;
  model: string;
  success: boolean;
  latency_ms: number;
  error?: string;
}

export interface BackendContextFileSummary {
  filename: string;
  chars: number;
  preview: string;
}

export interface BackendCitationTrace {
  filename: string;
  quote: string;
  why?: string;
  line_start?: number | null;
  line_end?: number | null;
}

export interface BackendToolCallTrace {
  tool_name: string;
  source: string;
  file?: string | null;
  status?: string;
  bytes_read?: number | null;
  timestamp?: string | null;
}

export interface BackendLlmRouteEvent {
  trace_id?: string;
  task: string;
  provider: string;
  model: string;
  fallback_used: boolean;
  rollout_mode?: string;
  context_files?: string[];
  context_file_count?: number;
  context_file_summaries?: BackendContextFileSummary[];
  reasoning_summary?: string;
  citations?: BackendCitationTrace[];
  evidence_gaps?: string[];
  tool_calls?: BackendToolCallTrace[];
  attempts: BackendLlmRouteAttempt[];
}

export interface BackendReviewResponse {
  summary: BackendReviewSummary;
  results: BackendReviewResult[];
  conflicts: BackendConflict[];
  llm_meta?: BackendLlmRouteEvent[];
}

export interface ReplExecRequestPayload {
  code: string;
}

export interface BackendReplExecResponse {
  stdout: string;
  result: string | null;
  error: string | null;
  llm_meta?: BackendLlmRouteEvent[];
}

export async function reviewDocument(
  payload: ReviewRequestPayload
): Promise<BackendReviewResponse> {
  const response = await fetch(`${API_BASE}/v1/documents/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Review request failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function execProjectRepl(
  projectId: string,
  payload: ReplExecRequestPayload
): Promise<BackendReplExecResponse> {
  const response = await fetch(`${API_BASE}/v1/projects/${projectId}/repl/exec`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "REPL execution failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export type PromptEnhancerFieldType =
  | "text"
  | "textarea"
  | "select"
  | "multi_select"
  | "number"
  | "date"
  | "checkbox";

export interface PromptEnhancerOption {
  label: string;
  value: string;
}

export interface PromptEnhancerUIBlock {
  id: string;
  label: string;
  type: PromptEnhancerFieldType;
  required?: boolean;
  placeholder?: string | null;
  help_text?: string | null;
  default?: unknown;
  options?: PromptEnhancerOption[] | null;
}

export interface PromptEnhancerRewritePlan {
  strategy?: "append" | "replace_section" | "structured_block";
  goals?: string[];
  notes?: string[];
}

export interface PromptEnhancerGenerateRequestPayload {
  prompt: string;
  model?: string;
  task_type?: string;
  project_name?: string;
  project_goal?: string;
  target_audience?: string;
  doers?: Array<Record<string, unknown>>;
  reviewers?: Array<Record<string, unknown>>;
  max_questions?: number;
}

export interface PromptEnhancerGenerateResponse {
  version: string;
  task_type: string;
  confidence: number;
  ui_blocks: PromptEnhancerUIBlock[];
  rewrite_plan: PromptEnhancerRewritePlan;
  meta?: Record<string, unknown>;
}

export interface PromptEnhancerCompileRequestPayload {
  prompt: string;
  mode?: "assist" | "auto";
  answers: Record<string, unknown>;
  ui_blocks: PromptEnhancerUIBlock[];
  rewrite_plan?: PromptEnhancerRewritePlan;
}

export interface PromptEnhancerCompileResponse {
  mode: "assist" | "auto";
  original_prompt: string;
  enhanced_prompt: string;
  applied_fields: string[];
}

export async function generatePromptEnhancer(
  projectId: string,
  payload: PromptEnhancerGenerateRequestPayload
): Promise<PromptEnhancerGenerateResponse> {
  const response = await fetch(`${API_BASE}/v1/projects/${projectId}/prompt-enhancer/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Prompt enhancement generation failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function compilePromptEnhancer(
  projectId: string,
  payload: PromptEnhancerCompileRequestPayload
): Promise<PromptEnhancerCompileResponse> {
  const response = await fetch(`${API_BASE}/v1/projects/${projectId}/prompt-enhancer/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Prompt enhancement compile failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export interface PersistCrewVersionPayload {
  doers: DoerDefinition[];
  reviewers: ReviewerDefinition[];
  reason?: string;
  source?: "generated" | "manual" | "rollback" | "seed";
  meta?: Record<string, unknown>;
}

export interface PersistCrewVersionResponse {
  project_id: string;
  active_version_id: string;
  previous_version_id?: string;
  updated_at: string;
  reason?: string;
  doers_count: number;
  reviewers_count: number;
}

export interface CrewVersionHistoryResponse {
  project_id: string;
  active_version_id?: string;
  updated_at?: string;
  reason?: string;
  versions: Array<{
    version_id: string;
    created_at: string;
    source?: string;
    reason?: string | null;
    from_version_id?: string | null;
    doers?: DoerDefinition[];
    reviewers?: ReviewerDefinition[];
    meta?: Record<string, unknown>;
  }>;
}

export interface RollbackCrewVersionResponse {
  project_id: string;
  active_version_id: string;
  previous_version_id?: string;
  rolled_back_to_version_id: string;
  updated_at: string;
  reason?: string;
  doers: DoerDefinition[];
  reviewers: ReviewerDefinition[];
}

export async function persistCrewVersion(
  projectId: string,
  payload: PersistCrewVersionPayload
): Promise<PersistCrewVersionResponse> {
  const response = await fetch(`${API_BASE}/v1/projects/${projectId}/crew/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to persist crew version" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getCrewVersions(projectId: string): Promise<CrewVersionHistoryResponse> {
  const response = await fetch(`${API_BASE}/v1/projects/${projectId}/crew/versions`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to load crew versions" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function rollbackCrewVersion(
  projectId: string,
  versionId: string,
  reason?: string
): Promise<RollbackCrewVersionResponse> {
  const response = await fetch(`${API_BASE}/v1/projects/${projectId}/crew/rollback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version_id: versionId, reason }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to rollback crew version" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export interface SetRolloutModeResponse {
  project_id: string;
  mode: "baseline" | "active";
  updated_at: string;
  effective_from_next_run: boolean;
}

export interface RolloutHistoryEvent {
  mode: "baseline" | "active";
  from_mode?: "baseline" | "active";
  updated_at: string;
  reason?: string;
  source: "init" | "manual" | "auto_fallback" | "migration" | "hydrate";
  trigger?: string;
}

export interface RolloutHistoryResponse {
  project_id: string;
  events: RolloutHistoryEvent[];
}

export async function setProjectRolloutMode(
  projectId: string,
  mode: "baseline" | "active",
  reason?: string
): Promise<SetRolloutModeResponse> {
  const response = await fetch(`${API_BASE}/v1/projects/${projectId}/rollout-mode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, reason }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to set rollout mode" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getProjectRolloutHistory(
  projectId: string
): Promise<RolloutHistoryResponse> {
  const response = await fetch(`${API_BASE}/v1/projects/${projectId}/rollout-history`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to load rollout history" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export interface OnboardingWorkspaceStreamRequest {
  job_function: string;
  job_title?: string;
  answers: Record<string, unknown>;
  email?: string;
  team_size?: string;
  reporting_level?: string;
  industry?: string;
  company_stage?: string;
  company_info?: Record<string, unknown>;
}

export interface OnboardingWorkspaceStreamComplete {
  workspace?: Record<string, unknown>;
  ui_schema?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

export type OnboardingWorkspaceEventName =
  | "status"
  | "llm_token"
  | "project_name"
  | "project_details"
  | "document"
  | "reviewer"
  | "quick_action"
  | "complete"
  | "error"
  | "done";

export async function streamOnboardingWorkspace(
  payload: OnboardingWorkspaceStreamRequest,
  onEvent: (event: OnboardingWorkspaceEventName, data: unknown) => void
): Promise<OnboardingWorkspaceStreamComplete> {
  const response = await fetch(`${API_BASE}/v1/onboarding/generate-workspace-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Workspace stream failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Streaming not supported by this browser");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completePayload: OnboardingWorkspaceStreamComplete | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const lfBoundary = buffer.indexOf("\n\n");
      const crlfBoundary = buffer.indexOf("\r\n\r\n");
      let eventBoundary = -1;
      let delimiterLength = 2;
      if (crlfBoundary >= 0 && (lfBoundary < 0 || crlfBoundary < lfBoundary)) {
        eventBoundary = crlfBoundary;
        delimiterLength = 4;
      } else {
        eventBoundary = lfBoundary;
      }
      if (eventBoundary < 0) break;

      const rawEvent = buffer.slice(0, eventBoundary);
      buffer = buffer.slice(eventBoundary + delimiterLength);

      const lines = rawEvent.split(/\r?\n/);
      let eventName: OnboardingWorkspaceEventName = "status";
      const dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith("event:")) {
          const maybeEvent = line.slice("event:".length).trim() as OnboardingWorkspaceEventName;
          eventName = maybeEvent;
          continue;
        }
        if (line.startsWith("data:")) {
          dataLines.push(line.slice("data:".length).trimStart());
        }
      }

      if (dataLines.length === 0) continue;
      const rawData = dataLines.join("\n");

      if (eventName === "done" && rawData === "[DONE]") {
        onEvent("done", rawData);
        return completePayload ?? {};
      }

      let parsedData: unknown = rawData;
      try {
        parsedData = JSON.parse(rawData);
      } catch {
        parsedData = rawData;
      }

      onEvent(eventName, parsedData);

      if (eventName === "error") {
        const message =
          typeof parsedData === "object" && parsedData && "message" in parsedData
            ? String((parsedData as { message?: unknown }).message || "Workspace stream failed")
            : "Workspace stream failed";
        throw new Error(message);
      }

      if (eventName === "complete" && typeof parsedData === "object" && parsedData) {
        completePayload = parsedData as OnboardingWorkspaceStreamComplete;
      }
    }
  }

  if (completePayload) return completePayload;
  throw new Error("Workspace stream ended before complete payload");
}

export interface ProjectSyncStreamComplete {
  files_added?: number;
  summary?: {
    total?: number;
    extracted?: number;
    cached?: number;
    unsupported?: number;
    empty?: number;
    errors?: number;
  };
}

export type ProjectSyncEventName =
  | "status"
  | "sync_complete"
  | "extraction_start"
  | "extraction_progress"
  | "extraction_complete"
  | "complete"
  | "error"
  | "done";

export async function streamProjectSync(
  projectId: string,
  onEvent: (event: ProjectSyncEventName, data: unknown) => void
): Promise<ProjectSyncStreamComplete> {
  const response = await fetch(`${API_BASE}/v1/projects/${projectId}/sync-stream`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Project sync failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Streaming not supported by this browser");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completePayload: ProjectSyncStreamComplete | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const lfBoundary = buffer.indexOf("\n\n");
      const crlfBoundary = buffer.indexOf("\r\n\r\n");
      let eventBoundary = -1;
      let delimiterLength = 2;
      if (crlfBoundary >= 0 && (lfBoundary < 0 || crlfBoundary < lfBoundary)) {
        eventBoundary = crlfBoundary;
        delimiterLength = 4;
      } else {
        eventBoundary = lfBoundary;
      }
      if (eventBoundary < 0) break;

      const rawEvent = buffer.slice(0, eventBoundary);
      buffer = buffer.slice(eventBoundary + delimiterLength);

      const lines = rawEvent.split(/\r?\n/);
      let eventName: ProjectSyncEventName = "status";
      const dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith("event:")) {
          const maybeEvent = line.slice("event:".length).trim() as ProjectSyncEventName;
          eventName = maybeEvent;
          continue;
        }
        if (line.startsWith("data:")) {
          dataLines.push(line.slice("data:".length).trimStart());
        }
      }

      if (dataLines.length === 0) continue;
      const rawData = dataLines.join("\n");

      if (eventName === "done" && rawData === "[DONE]") {
        onEvent("done", rawData);
        return completePayload ?? {};
      }

      let parsedData: unknown = rawData;
      try {
        parsedData = JSON.parse(rawData);
      } catch {
        parsedData = rawData;
      }

      onEvent(eventName, parsedData);

      if (eventName === "error") {
        const message =
          typeof parsedData === "object" && parsedData && "message" in parsedData
            ? String((parsedData as { message?: unknown }).message || "Project sync failed")
            : "Project sync failed";
        throw new Error(message);
      }

      if (eventName === "complete" && typeof parsedData === "object" && parsedData) {
        completePayload = parsedData as ProjectSyncStreamComplete;
      }
    }
  }

  if (completePayload) return completePayload;
  throw new Error("Project sync stream ended before completion payload");
}

function adminHeaders(adminKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-user-role": "admin",
  };
  if (adminKey && adminKey.trim()) headers["x-admin-key"] = adminKey.trim();
  return headers;
}

export interface EvalRunSummary {
  run_id: string;
  file_name: string;
  created_at?: string | null;
  model?: string | null;
  dataset?: string | null;
  cases?: number | null;
  failed_cases?: number | null;
  aggregate?: Record<string, unknown>;
}

export interface EvalCaseAnnotation {
  run_id: string;
  case_id: string;
  winner?: string | null;
  label?: string | null;
  action?: string | null;
  note?: string | null;
  tags?: string[];
  actor?: string | null;
  updated_at?: string | null;
}

export interface EvalCaseResult {
  id: string;
  vanilla?: Record<string, unknown> | null;
  rlm?: Record<string, unknown> | null;
  error?: string;
}

export interface EvalRunDetailResponse {
  run_id: string;
  summary: {
    timestamp?: string;
    model?: string;
    dataset?: string;
    cases?: number;
    failed_cases?: number;
    aggregate?: Record<string, unknown>;
  };
  results: EvalCaseResult[];
  annotations: Record<string, EvalCaseAnnotation>;
}

export async function listAdminEvalRuns(
  limit = 50,
  adminKey?: string
): Promise<{ count: number; runs: EvalRunSummary[] }> {
  const response = await fetch(`${API_BASE}/v1/admin/evals/runs?limit=${encodeURIComponent(limit)}`, {
    method: "GET",
    headers: adminHeaders(adminKey),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to load eval runs" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function getAdminEvalRun(
  runId: string,
  adminKey?: string
): Promise<EvalRunDetailResponse> {
  const response = await fetch(`${API_BASE}/v1/admin/evals/runs/${encodeURIComponent(runId)}`, {
    method: "GET",
    headers: adminHeaders(adminKey),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to load eval run" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export interface EvalCaseAnnotationPayload {
  winner?: string | null;
  label?: string | null;
  action?: string | null;
  note?: string | null;
  tags?: string[];
}

export async function annotateAdminEvalCase(
  runId: string,
  caseId: string,
  payload: EvalCaseAnnotationPayload,
  adminKey?: string,
  adminUser?: string
): Promise<{ ok: boolean; annotation: EvalCaseAnnotation }> {
  const headers = adminHeaders(adminKey);
  if (adminUser && adminUser.trim()) headers["x-admin-user"] = adminUser.trim();
  const response = await fetch(
    `${API_BASE}/v1/admin/evals/runs/${encodeURIComponent(runId)}/cases/${encodeURIComponent(caseId)}/annotation`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to annotate eval case" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export interface AdminModelRegistryEntry {
  provider: string;
  model: string;
  name: string;
  enabled: boolean;
  tags?: string[];
}

export async function listAdminModels(
  adminKey?: string
): Promise<{ count: number; models: AdminModelRegistryEntry[] }> {
  const response = await fetch(`${API_BASE}/v1/admin/models`, {
    method: "GET",
    headers: adminHeaders(adminKey),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to load admin models" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function updateAdminModel(
  payload: {
    provider: string;
    model: string;
    enabled: boolean;
    name?: string;
    tags?: string[];
  },
  adminKey?: string
): Promise<{ ok: boolean; model: AdminModelRegistryEntry }> {
  const response = await fetch(`${API_BASE}/v1/admin/models/update`, {
    method: "POST",
    headers: adminHeaders(adminKey),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to update model" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

function userHeaders(userId?: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (userId && userId.trim()) headers["x-user-id"] = userId.trim();
  return headers;
}

export interface UserApiKeyMeta {
  provider: string;
  label?: string | null;
  base_url?: string | null;
  last4?: string | null;
  updated_at?: string | null;
}

export async function listUserApiKeys(
  userId?: string
): Promise<{ user_id: string; count: number; keys: UserApiKeyMeta[] }> {
  const response = await fetch(`${API_BASE}/v1/user/keys`, {
    method: "GET",
    headers: userHeaders(userId),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to load user keys" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function upsertUserApiKey(
  payload: {
    provider: string;
    api_key: string;
    label?: string;
    base_url?: string;
  },
  userId?: string
): Promise<{ ok: boolean; user_id: string; key: UserApiKeyMeta }> {
  const response = await fetch(`${API_BASE}/v1/user/keys`, {
    method: "POST",
    headers: userHeaders(userId),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to save user key" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function testUserApiKey(
  payload: { provider: string; api_key?: string; base_url?: string },
  userId?: string
): Promise<{ ok: boolean; status_code: number; endpoint: string; detail?: string }> {
  const response = await fetch(`${API_BASE}/v1/user/keys/test`, {
    method: "POST",
    headers: userHeaders(userId),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to test user key" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function deleteUserApiKey(
  provider: string,
  userId?: string
): Promise<{ ok: boolean; user_id: string; provider: string }> {
  const response = await fetch(`${API_BASE}/v1/user/keys/${encodeURIComponent(provider)}`, {
    method: "DELETE",
    headers: userHeaders(userId),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to delete user key" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}
