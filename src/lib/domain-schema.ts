export type StrictnessLevel = "low" | "medium" | "high";
export type RubricSeverity = "critical" | "warning" | "info";

export type RubricCriterion = {
  id: string;
  name: string;
  description: string;
  weight: number;
  threshold: number;
  severity: RubricSeverity;
};

export type RubricDefinition = {
  criteria?: RubricCriterion[];
  scoring_scale?: string;
  decision_rules?: string[];
};

export type DomainUserProfile = {
  user_id?: string;
  display_name?: string;
  email?: string;
  job_function?: string;
  team_size?: string;
  reporting_level?: string;
  industry?: string;
  company_stage?: string;
  current_work?: Record<string, unknown>;
};

export type AgentToolDefinition = {
  tool_name: string;
  tool_description: string;
  tool_output: string;
};

export type DoerDefinition = {
  id: string;
  name: string;
  description: string;
  specialty?: string;
  system_prompt?: string;
  goals_kpis?: string[];
  skills?: string[];
  tools?: AgentToolDefinition[];
  strictness?: StrictnessLevel;
  rubric?: RubricDefinition;
  enabled: boolean;
};

export type ReviewerDefinition = {
  id: string;
  name: string;
  reason: string;
  enabled: boolean;
  description?: string;
  system_prompt?: string;
  goals_kpis?: string[];
  skills?: string[];
  tools?: AgentToolDefinition[];
  strictness?: StrictnessLevel;
  rubric?: RubricDefinition;
};

export type CrewVersionSummary = {
  version_id: string;
  created_at: string;
  source?: string;
  reason?: string | null;
  from_version_id?: string | null;
};

export type DomainProject = {
  id: string;
  name: string;
  description?: string;
  goal?: string | null;
  target_audience?: string;
  key_messages?: string[];
  okrs?: Array<{
    objective: string;
    key_results: Array<{
      metric: string;
      baseline: string;
      target: string;
      timeframe: string;
      description: string;
    }>;
  }>;
  connector?: string | null;
  connectorConfig?: Record<string, unknown>;
  syncStatus?: "idle" | "syncing" | "done";
  files?: Array<{
    id: string;
    name: string;
    type: "folder" | "file";
    children?: Array<{
      id: string;
      name: string;
      type: "folder" | "file";
      children?: unknown[];
    }>;
  }>;
  documents?: Array<{
    id: string;
    title: string;
    outline?: string[];
    status: "draft" | "in_progress" | "complete";
    content?: string;
  }>;
  reviewers?: ReviewerDefinition[];
  doers?: DoerDefinition[];
  quick_actions?: Array<{
    id: string;
    label: string;
    icon: string;
  }>;
  owner?: DomainUserProfile;
  profile_context?: DomainUserProfile;
  active_crew_version_id?: string;
  rolloutMode?: "baseline" | "active";
  rolloutHistory?: unknown[];
};

export type HubActorType = "doer" | "reviewer" | "system";
export type HubEventStatus = "completed" | "info" | "warning" | "error";

export type HubEvent = {
  id: string;
  project_id: string;
  project_name: string;
  actor_type: HubActorType;
  actor_name: string;
  message: string;
  status: HubEventStatus;
  timestamp: string;
};
