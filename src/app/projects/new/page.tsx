"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useAppStore, type Doer, type Reviewer, type UserProfile } from "@/lib/store";
import { persistCrewVersion } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { notify } from "@/components/ui/NotificationCenter";
import { CrewIdentityCard } from "@/components/crew/CrewIdentityCard";
import { CrewIdentityEditorModal } from "@/components/crew/CrewIdentityEditorModal";

const connectors = [
  { id: "local", name: "Local Folder", icon: "💻" },
  { id: "gdrive", name: "Google Drive", icon: "📂" },
];

type DriveFolder = { id: string; name: string };
type DriveFile = { id: string; name: string; mime_type: string };
type DrivePreview = {
  parent_id: string;
  folder_count: number;
  syncable_file_count: number;
  unsupported_file_count: number;
  truncated: boolean;
};

type CrewResponse = {
  doers?: Array<Record<string, unknown>>;
  reviewers?: Array<Record<string, unknown>>;
  _meta?: Record<string, unknown>;
  crew_version?: Record<string, unknown>;
};

type EditingCrewTarget =
  | { kind: "doer"; previousId: string; index: number }
  | { kind: "reviewer"; previousId: string; index: number };

type SetupTimelineStep = {
  id: "intent" | "crew" | "tools" | "ready";
  label: string;
  status: "pending" | "active" | "done";
};

const STARTER_KITS: Array<{
  id: string;
  name: string;
  projectName: string;
  goal: string;
  context: string;
}> = [
  {
    id: "launch_brief",
    name: "Launch Brief",
    projectName: "Q2 Launch Brief",
    goal: "Create a launch brief with positioning, risks, timeline, and source-backed claims.",
    context: "Audience: executive + cross-functional leads. Need concise, decision-ready output.",
  },
  {
    id: "sales_proposal",
    name: "Sales Proposal",
    projectName: "Enterprise Proposal",
    goal: "Draft an enterprise proposal with clear value, proof points, and objection handling.",
    context: "Audience: buyer committee. Optimize for clarity, confidence, and next steps.",
  },
  {
    id: "status_update",
    name: "Weekly Update",
    projectName: "Weekly Executive Update",
    goal: "Generate a weekly status update with progress, blockers, dependencies, and asks.",
    context: "Audience: leadership. Keep it short, factual, and action-oriented.",
  },
];

function mapAgentTools(raw: unknown): Array<{
  tool_name: string;
  tool_description: string;
  tool_output: string;
}> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const mapped = raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      tool_name: typeof item.tool_name === "string" ? item.tool_name.trim() : "",
      tool_description: typeof item.tool_description === "string" ? item.tool_description.trim() : "",
      tool_output: typeof item.tool_output === "string" ? item.tool_output.trim() : "",
    }))
    .filter(
      (tool) => tool.tool_name.length > 0 && tool.tool_description.length > 0 && tool.tool_output.length > 0
    );
  return mapped.length > 0 ? mapped : undefined;
}

function mapGeneratedDoer(raw: Record<string, unknown>, index: number): Doer {
  const fallbackName = `Doer ${index + 1}`;
  return {
    id: typeof raw.id === "string" ? raw.id : `doer_${index + 1}`,
    name: typeof raw.name === "string" ? raw.name : fallbackName,
    description:
      typeof raw.description === "string"
        ? raw.description
        : "Executes scoped work tied to project goals.",
    specialty: typeof raw.specialty === "string" ? raw.specialty : "execution",
    system_prompt: typeof raw.system_prompt === "string" ? raw.system_prompt : undefined,
    goals_kpis: Array.isArray(raw.goals_kpis)
      ? raw.goals_kpis.filter((item): item is string => typeof item === "string")
      : undefined,
    skills: Array.isArray(raw.skills)
      ? raw.skills.filter((item): item is string => typeof item === "string")
      : undefined,
    tools: mapAgentTools(raw.tools),
    strictness:
      raw.strictness === "low" || raw.strictness === "medium" || raw.strictness === "high"
        ? raw.strictness
        : "medium",
    rubric:
      raw.rubric && typeof raw.rubric === "object"
        ? (raw.rubric as Doer["rubric"])
        : undefined,
    enabled: raw.enabled === false ? false : true,
  };
}

function mapGeneratedReviewer(raw: Record<string, unknown>, index: number): Reviewer {
  return {
    id: typeof raw.id === "string" ? raw.id : `reviewer_${index + 1}`,
    name: typeof raw.name === "string" ? raw.name : `Reviewer ${index + 1}`,
    reason:
      typeof raw.reason === "string"
        ? raw.reason
        : typeof raw.description === "string"
          ? raw.description
          : "Generated to validate output quality.",
    description:
      typeof raw.description === "string" ? raw.description : "Generated reviewer",
    system_prompt: typeof raw.system_prompt === "string" ? raw.system_prompt : undefined,
    goals_kpis: Array.isArray(raw.goals_kpis)
      ? raw.goals_kpis.filter((item): item is string => typeof item === "string")
      : undefined,
    skills: Array.isArray(raw.skills)
      ? raw.skills.filter((item): item is string => typeof item === "string")
      : undefined,
    tools: mapAgentTools(raw.tools),
    strictness:
      raw.strictness === "low" || raw.strictness === "medium" || raw.strictness === "high"
        ? raw.strictness
        : "medium",
    rubric:
      raw.rubric && typeof raw.rubric === "object"
        ? (raw.rubric as Reviewer["rubric"])
        : undefined,
    enabled: raw.enabled === false ? false : true,
  };
}

function buildPersonalizedDoers(profile: UserProfile | null, goal: string): Doer[] {
  const role = (profile?.job_function || "").toLowerCase();
  const goalSnippet = goal.trim().slice(0, 80) || "project goals";

  const base: Doer[] = [
    {
      id: "mission_planner",
      name: "Orion, the Mission Planner",
      description: `Breaks "${goalSnippet}" into actionable milestones and owners.`,
      specialty: "planning",
      enabled: true,
    },
    {
      id: "draft_builder",
      name: "Cora, the Content Optimizer",
      description: "Produces first-pass drafts from project context and source files.",
      specialty: "drafting",
      enabled: true,
    },
    {
      id: "evidence_hunter",
      name: "Atlas, the Evidence Scout",
      description: "Finds source-backed support and flags unsupported claims.",
      specialty: "evidence",
      enabled: true,
    },
  ];

  if (role.includes("marketing")) {
    base.push({
      id: "audience_storyteller",
      name: "Sierra, the SEO Strategist",
      description: "Tailors narrative and messaging to target audience segments.",
      specialty: "messaging",
      enabled: true,
    });
  } else if (role.includes("sales")) {
    base.push({
      id: "deal_strategist",
      name: "Rex, the Deal Strategist",
      description: "Shapes persuasive deal narratives and objection handling points.",
      specialty: "deal strategy",
      enabled: true,
    });
  } else if (role.includes("success")) {
    base.push({
      id: "retention_planner",
      name: "Lumi, the Retention Planner",
      description: "Builds retention, adoption, and risk-mitigation playbooks.",
      specialty: "customer outcomes",
      enabled: true,
    });
  }

  return base;
}

function titleize(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function defaultReviewers(profile: UserProfile | null): Reviewer[] {
  const role = (profile?.job_function || "").toLowerCase();
  const shared: Reviewer[] = [
    {
      id: "fact_integrity_reviewer",
      name: "Vera, the Fact Sentinel",
      reason: "Validates source-backed claims and factual consistency.",
      description: "Checks claims against uploaded sources and flags unsupported assertions.",
      enabled: true,
      strictness: "high",
    },
    {
      id: "clarity_structure_reviewer",
      name: "Iris, the Clarity Critic",
      reason: "Improves readability, structure, and executive clarity.",
      description: "Evaluates flow, headings, and narrative clarity for fast decision-making.",
      enabled: true,
      strictness: "medium",
    },
  ];

  if (role.includes("marketing")) {
    shared.push({
      id: "brand_voice_reviewer",
      name: "Halo, the Brand Guardian",
      reason: "Ensures tone and positioning match brand expectations.",
      description: "Checks consistency of tone, positioning, and message hierarchy.",
      enabled: true,
      strictness: "medium",
    });
  } else if (role.includes("sales")) {
    shared.push({
      id: "deal_readiness_reviewer",
      name: "Knox, the Deal Risk Auditor",
      reason: "Checks sales narrative quality and buyer confidence gaps.",
      description: "Validates proof points, objections, and closing readiness.",
      enabled: true,
      strictness: "high",
    });
  } else {
    shared.push({
      id: "execution_risk_reviewer",
      name: "Quill, the Execution Risk Sentinel",
      reason: "Flags missing steps, dependencies, and delivery risks.",
      description: "Finds plan gaps and unresolved dependencies before rollout.",
      enabled: true,
      strictness: "medium",
    });
  }

  return shared;
}

export default function NewProject() {
  const router = useRouter();
  const {
    createProject,
    onboarding,
    projectSetupDefaults,
    updateProjectSetupDefaults,
    setGlobalActivity,
  } = useAppStore();
  const [name, setName] = useState("");
  const [connector, setConnector] = useState<string | null>(projectSetupDefaults.connector ?? null);
  const [goal, setGoal] = useState("");
  const [localFolderFiles, setLocalFolderFiles] = useState<File[]>([]);
  const [localFolderLabel, setLocalFolderLabel] = useState<string | null>(null);
  const [localUploading, setLocalUploading] = useState(false);
  const localFolderInputRef = useRef<HTMLInputElement | null>(null);
  const hasAutoGeneratedCrewRef = useRef(false);
  const seededFromOnboardingWorkspaceRef = useRef(false);
  const [doers, setDoers] = useState<Doer[]>(() =>
    Array.isArray(projectSetupDefaults.crewDoers) && projectSetupDefaults.crewDoers.length > 0
      ? projectSetupDefaults.crewDoers.map((doer) => ({ ...doer }))
      : buildPersonalizedDoers(
          onboarding.user_profile || null,
          onboarding.workspace?.first_project?.goal || ""
        )
  );
  const [reviewers, setReviewers] = useState<Reviewer[]>(() =>
    Array.isArray(projectSetupDefaults.crewReviewers) && projectSetupDefaults.crewReviewers.length > 0
      ? projectSetupDefaults.crewReviewers.map((reviewer) => ({ ...reviewer }))
      : defaultReviewers(onboarding.user_profile || null)
  );
  const [crewLoading, setCrewLoading] = useState(false);
  const [crewGenerated, setCrewGenerated] = useState(false);
  const [crewMeta, setCrewMeta] = useState<Record<string, unknown> | null>(
    projectSetupDefaults.crewMeta ?? null
  );
  const [setupMode, setSetupMode] = useState<"simple" | "pro">("simple");
  const [quickIntent, setQuickIntent] = useState("");
  const [setupContext, setSetupContext] = useState("");
  const [setupTimeline, setSetupTimeline] = useState<SetupTimelineStep[]>([]);
  const [editingCrew, setEditingCrew] = useState<EditingCrewTarget | null>(null);

  // Google Drive folder browser state
  const [driveParentId, setDriveParentId] = useState<string | null>(null);
  const [driveTrail, setDriveTrail] = useState<Array<{ id: string | null; name: string }>>([
    { id: null, name: "My Drive" },
  ]);
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<{ id: string | null; name: string } | null>(() =>
    projectSetupDefaults.gdriveFolderName
      ? {
          id: projectSetupDefaults.gdriveFolderId,
          name: projectSetupDefaults.gdriveFolderName,
        }
      : null
  );
  const [drivePreview, setDrivePreview] = useState<DrivePreview | null>(null);
  const [drivePreviewLoading, setDrivePreviewLoading] = useState(false);
  const [drivePreviewError, setDrivePreviewError] = useState<string | null>(null);

  const backendUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8000",
    []
  );
  const userProfile = onboarding.user_profile || null;
  const onboardingFirstProjectGoal = onboarding.workspace?.first_project?.goal;
  const isGDrive = connector === "gdrive";
  const isLocal = connector === "local";
  const activeDoersCount = doers.filter((d) => d.enabled).length;
  const activeReviewersCount = reviewers.filter((r) => r.enabled).length;
  const activeToolsCount =
    doers.reduce((count, doer) => count + (doer.tools?.length || 0), 0) +
    reviewers.reduce((count, reviewer) => count + (reviewer.tools?.length || 0), 0);
  const connectorRequirementsMet = connector !== "local" || localFolderFiles.length > 0;
  const canCreate =
    name.trim().length > 0 &&
    connectorRequirementsMet &&
    activeDoersCount > 0 &&
    activeReviewersCount > 0;

  useEffect(() => {
    if (seededFromOnboardingWorkspaceRef.current) return;
    const workspace = onboarding.workspace;
    if (!workspace?.first_project) return;
    if (!name.trim() && workspace.first_project.name) {
      setName(workspace.first_project.name);
    }
    if (!goal.trim() && workspace.first_project.goal) {
      setGoal(workspace.first_project.goal);
    }
    seededFromOnboardingWorkspaceRef.current = true;
  }, [goal, name, onboarding.workspace]);

  useEffect(() => {
    if (goal.trim().length > 0 || !onboarding.user_profile || onboardingFirstProjectGoal) return;

    const role = onboarding.user_profile.job_function?.replaceAll("_", " ");
    const audience = onboarding.user_profile.industry;
    const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "the team";
    const audienceLabel = audience ? ` in ${audience.toUpperCase()}` : "";
    setGoal(`Create a high-confidence project brief for ${roleLabel}${audienceLabel}.`);
  }, [goal, onboarding.user_profile, onboardingFirstProjectGoal]);

  useEffect(() => {
    if (doers.length > 0) return;
    setDoers(buildPersonalizedDoers(userProfile, goal));
  }, [doers.length, userProfile, goal]);

  useEffect(() => {
    if (reviewers.length > 0) return;
    setReviewers(defaultReviewers(userProfile));
  }, [reviewers.length, userProfile]);

  useEffect(() => {
    if (doers.length === 0 && reviewers.length === 0) return;
    updateProjectSetupDefaults({
      crewDoers: doers,
      crewReviewers: reviewers,
      crewMeta,
    });
  }, [crewMeta, doers, reviewers, updateProjectSetupDefaults]);

  const editingMember = useMemo(() => {
    if (!editingCrew) return null;
    if (editingCrew.kind === "doer") {
      return doers[editingCrew.index] || null;
    }
    return reviewers[editingCrew.index] || null;
  }, [doers, editingCrew, reviewers]);

  const saveEditedCrewIdentity = useCallback(
    async (updated: Doer | Reviewer) => {
      if (!editingCrew) return;
      if (editingCrew.kind === "doer") {
        const nextDoers = doers.map((item, index) =>
          index === editingCrew.index || item.id === editingCrew.previousId
            ? (updated as Doer)
            : item
        );
        if (!nextDoers.some((item) => item.enabled)) {
          throw new Error("At least one doer must stay enabled.");
        }
        if (new Set(nextDoers.map((item) => item.id)).size !== nextDoers.length) {
          throw new Error("Doer IDs must be unique.");
        }
        setDoers(nextDoers);
      } else {
        const nextReviewers = reviewers.map((item, index) =>
          index === editingCrew.index || item.id === editingCrew.previousId
            ? (updated as Reviewer)
            : item
        );
        if (!nextReviewers.some((item) => item.enabled)) {
          throw new Error("At least one reviewer must stay enabled.");
        }
        if (new Set(nextReviewers.map((item) => item.id)).size !== nextReviewers.length) {
          throw new Error("Reviewer IDs must be unique.");
        }
        setReviewers(nextReviewers);
      }
      setCrewGenerated(true);
      notify.success("Identity Updated", `${updated.name} has updated role details.`);
      setEditingCrew(null);
    },
    [doers, editingCrew, reviewers]
  );

  const create = useCallback(async (overrides?: {
    name?: string;
    goal?: string;
    doers?: Doer[];
    reviewers?: Reviewer[];
  }) => {
    const finalName = (overrides?.name ?? name).trim();
    const finalGoal = (overrides?.goal ?? goal).trim();
    const finalDoers = overrides?.doers ?? doers;
    const finalReviewers = overrides?.reviewers ?? reviewers;

    const finalActiveDoers = finalDoers.filter((d) => d.enabled).length;
    const finalActiveReviewers = finalReviewers.filter((r) => r.enabled).length;
    const requirementsMet = connector !== "local" || localFolderFiles.length > 0;
    if (!finalName || !requirementsMet || finalActiveDoers === 0 || finalActiveReviewers === 0) return;

    const projectId = `proj-${Date.now()}`;
    updateProjectSetupDefaults({
      connector,
      localSourcePath: "",
      gdriveFolderId: isGDrive ? (selectedFolder?.id ?? null) : null,
      gdriveFolderName: isGDrive ? (selectedFolder?.name ?? null) : null,
      crewDoers: finalDoers,
      crewReviewers: finalReviewers,
      crewMeta,
    });

    if (isLocal) {
      setLocalUploading(true);
      setGlobalActivity({
        title: "Importing local folder",
        detail: "Uploading files from Finder selection",
        progressCurrent: 0,
        progressTotal: localFolderFiles.length,
      });
      try {
        for (let i = 0; i < localFolderFiles.length; i++) {
          const file = localFolderFiles[i];
          const relPath =
            (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
            file.name;
          const formData = new FormData();
          formData.append("file", file);
          formData.append("rel_path", relPath);

          const uploadResponse = await fetch(
            `${backendUrl}/v1/projects/${projectId}/files/upload`,
            {
              method: "POST",
              body: formData,
            }
          );
          const uploadBody = await uploadResponse.json().catch(() => ({}));
          if (!uploadResponse.ok) {
            throw new Error(uploadBody?.detail || "Failed to upload selected folder");
          }
          const extractionStatus =
            uploadBody?.extraction && typeof uploadBody.extraction.status === "string"
              ? uploadBody.extraction.status
              : "uploaded";
          const fileLabel = relPath.split("/").pop() || relPath;
          setGlobalActivity({
            title: "Importing local folder",
            detail: `${extractionStatus}: ${fileLabel}`,
            progressCurrent: i + 1,
            progressTotal: localFolderFiles.length,
          });
        }

        const filesResponse = await fetch(`${backendUrl}/v1/projects/${projectId}/files`);
        const filesBody = await filesResponse.json().catch(() => ({}));
        if (!filesResponse.ok) {
          throw new Error(filesBody?.detail || "Uploaded files but failed to list project files");
        }

        createProject({
          id: projectId,
          name: finalName,
          connector: null,
          connectorConfig: {},
          goal: finalGoal || null,
          syncStatus: "done",
          files: filesBody.files || [],
          doers: finalDoers,
          reviewers: finalReviewers,
          rolloutMode: "active",
        });
        try {
          await persistCrewVersion(projectId, {
            doers: finalDoers,
            reviewers: finalReviewers,
            reason: "Initial crew from project setup",
            source: "manual",
            meta: crewMeta ?? undefined,
          });
        } catch (err) {
          notify.warning(
            "Crew Version Not Saved",
            err instanceof Error ? err.message : "Continuing with local project state."
          );
        }
        const fileCount = Number(filesBody.count ?? localFolderFiles.length);
        notify.success(
          "Local Folder Imported",
          `${fileCount} ${fileCount === 1 ? "file" : "files"} ready for review`
        );
        router.push("/");
      } catch (error) {
        notify.error(
          "Local Folder Import Failed",
          error instanceof Error ? error.message : "Unable to import selected folder"
        );
      } finally {
        setLocalUploading(false);
        setGlobalActivity(null);
      }
      return;
    }

    createProject({
      id: projectId,
      name: finalName,
      connector,
      connectorConfig: isGDrive
        ? (selectedFolder?.id ? { folder_id: selectedFolder.id } : {})
        : {},
      goal: finalGoal || null,
      syncStatus: connector ? "syncing" : "idle",
      files: [],
      doers: finalDoers,
      reviewers: finalReviewers,
      rolloutMode: "active",
    });
    try {
      await persistCrewVersion(projectId, {
        doers: finalDoers,
        reviewers: finalReviewers,
        reason: "Initial crew from project setup",
        source: "manual",
        meta: crewMeta ?? undefined,
      });
    } catch (err) {
      notify.warning(
        "Crew Version Not Saved",
        err instanceof Error ? err.message : "Continuing with local project state."
      );
    }
    router.push("/");
  }, [
    backendUrl,
    connector,
    createProject,
    crewMeta,
    doers,
    goal,
    isGDrive,
    isLocal,
    localFolderFiles,
    name,
    reviewers,
    router,
    selectedFolder,
    setGlobalActivity,
    updateProjectSetupDefaults,
  ]);

  const loadDriveChildren = useCallback(
    async (parentId: string | null) => {
      setDriveLoading(true);
      setDriveError(null);
      try {
        const url =
          parentId === null
            ? `${backendUrl}/v1/connectors/gdrive/children`
            : `${backendUrl}/v1/connectors/gdrive/children?parent_id=${encodeURIComponent(parentId)}`;
        const r = await fetch(url);
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = typeof body?.detail === "string" ? body.detail : "Failed to load folders";
          throw new Error(msg);
        }
        setDriveFolders((body?.folders ?? []) as DriveFolder[]);
        setDriveFiles((body?.files ?? []) as DriveFile[]);
      } catch (e) {
        setDriveFolders([]);
        setDriveFiles([]);
        setDriveError(e instanceof Error ? e.message : "Failed to load Drive contents");
      } finally {
        setDriveLoading(false);
      }
    },
    [backendUrl]
  );

  const loadDrivePreview = useCallback(
    async (parentId: string | null) => {
      setDrivePreviewLoading(true);
      setDrivePreviewError(null);
      try {
        const url =
          parentId === null
            ? `${backendUrl}/v1/connectors/gdrive/preview`
            : `${backendUrl}/v1/connectors/gdrive/preview?parent_id=${encodeURIComponent(parentId)}`;
        const r = await fetch(url);
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = typeof body?.detail === "string" ? body.detail : "Failed to estimate folder scope";
          throw new Error(msg);
        }
        setDrivePreview(body as DrivePreview);
      } catch (e) {
        setDrivePreview(null);
        setDrivePreviewError(e instanceof Error ? e.message : "Failed to estimate folder scope");
      } finally {
        setDrivePreviewLoading(false);
      }
    },
    [backendUrl]
  );

  const generatePersonalizedCrew = useCallback(async (overrides?: {
    name?: string;
    goal?: string;
    context?: string;
  }) => {
    const effectiveGoal = (overrides?.goal ?? goal).trim();
    const effectiveName = ((overrides?.name ?? name) || "Untitled Project").trim();
    if (!effectiveGoal) {
      notify.warning("Add a Goal First", "Set a project goal so crew prompts can be specific.");
      return null;
    }

    setSetupTimeline([
      { id: "intent", label: "Interpreting your goal", status: "active" },
      { id: "crew", label: "Designing doers and reviewers", status: "pending" },
      { id: "tools", label: "Attaching starter tools", status: "pending" },
      { id: "ready", label: "Ready to launch project", status: "pending" },
    ]);
    setCrewLoading(true);
    try {
      const currentWorkPayload =
        userProfile?.current_work && typeof userProfile.current_work === "object"
          ? { ...userProfile.current_work }
          : {};
      const setupContextText = (overrides?.context ?? setupContext).trim();
      if (setupContextText) {
        currentWorkPayload.setup_context = setupContextText;
      }
      setSetupTimeline((prev) =>
        prev.map((step) =>
          step.id === "intent"
            ? { ...step, status: "done" }
            : step.id === "crew"
              ? { ...step, status: "active" }
              : step
        )
      );

      const response = await fetch(`${backendUrl}/v1/projects/generate-crew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: effectiveName,
          project_goal: effectiveGoal,
          target_audience: "",
          job_function: userProfile?.job_function,
          team_size: userProfile?.team_size,
          reporting_level: userProfile?.reporting_level,
          industry: userProfile?.industry,
          company_stage: userProfile?.company_stage,
          current_work: currentWorkPayload,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail || "Failed to generate crew");
      }
      const body = (await response.json()) as CrewResponse;
      const nextDoers = (body.doers ?? []).map((d, index) => mapGeneratedDoer(d, index));
      const nextReviewers = (body.reviewers ?? []).map((r, index) =>
        mapGeneratedReviewer(r, index)
      );
      setCrewMeta(body._meta && typeof body._meta === "object" ? body._meta : null);

      const resolvedDoers = nextDoers.length ? nextDoers : buildPersonalizedDoers(userProfile, effectiveGoal);
      const resolvedReviewers = nextReviewers.length ? nextReviewers : defaultReviewers(userProfile);
      setDoers(resolvedDoers);
      setReviewers(resolvedReviewers);
      setCrewGenerated(true);
      setSetupTimeline((prev) =>
        prev.map((step) =>
          step.id === "crew"
            ? { ...step, status: "done" }
            : step.id === "tools"
              ? { ...step, status: "done" }
              : step.id === "ready"
                ? { ...step, status: "active" }
                : step
        )
      );
      notify.success("Crew Updated", "Doers, reviewers, and starter tools are ready.");
      setSetupTimeline((prev) =>
        prev.map((step) =>
          step.id === "ready"
            ? { ...step, status: "done" }
            : step
        )
      );
      return { doers: resolvedDoers, reviewers: resolvedReviewers };
    } catch (error) {
      notify.error(
        "Could Not Personalize Crew",
        error instanceof Error ? error.message : "Using default doers/reviewers."
      );
      const fallbackDoers = buildPersonalizedDoers(userProfile, effectiveGoal);
      const fallbackReviewers = defaultReviewers(userProfile);
      setDoers(fallbackDoers);
      setReviewers(fallbackReviewers);
      setCrewMeta(null);
      setCrewGenerated(false);
      setSetupTimeline([]);
      return { doers: fallbackDoers, reviewers: fallbackReviewers };
    } finally {
      setCrewLoading(false);
    }
  }, [backendUrl, goal, name, setupContext, userProfile]);

  const runDoItForMe = useCallback(async () => {
    const intent = quickIntent.trim();
    if (!intent) {
      notify.warning("Add a Goal", "Tell us what you want done this week.");
      return;
    }
    const intentName = name.trim() ? name.trim() : titleize(intent);
    if (!name.trim()) setName(intentName);
    setGoal(intent);
    if (!connector) {
      setConnector("gdrive");
      updateProjectSetupDefaults({ connector: "gdrive" });
    }
    if (connector === "local" && localFolderFiles.length === 0) {
      setConnector("gdrive");
      updateProjectSetupDefaults({ connector: "gdrive" });
      notify.info("Switched to Google Drive", "Simple setup works fastest with cloud sync by default.");
    }
    const generated = await generatePersonalizedCrew({
      name: intentName,
      goal: intent,
      context: setupContext.trim() || `Operator intent: ${intent}`,
    });
    if (!generated) return;
    await create({
      name: intentName,
      goal: intent,
      doers: generated.doers,
      reviewers: generated.reviewers,
    });
  }, [
    connector,
    create,
    generatePersonalizedCrew,
    name,
    quickIntent,
    setupContext,
    updateProjectSetupDefaults,
    localFolderFiles.length,
  ]);

  useEffect(() => {
    if (hasAutoGeneratedCrewRef.current) return;
    if (!userProfile || !goal.trim()) return;
    hasAutoGeneratedCrewRef.current = true;
    void generatePersonalizedCrew();
  }, [generatePersonalizedCrew, goal, userProfile]);

  useEffect(() => {
    if (!isGDrive) return;
    void loadDriveChildren(null);
    setDriveParentId(null);
    setDriveTrail([{ id: null, name: "My Drive" }]);
    setDrivePreviewError(null);
  }, [isGDrive, loadDriveChildren]);

  useEffect(() => {
    if (!isGDrive) return;
    const id = selectedFolder?.id ?? null;
    void loadDrivePreview(id);
  }, [isGDrive, selectedFolder?.id, loadDrivePreview]);

  useEffect(() => {
    if (!isLocal) return;
    if (!localFolderInputRef.current) return;
    localFolderInputRef.current.setAttribute("webkitdirectory", "");
    localFolderInputRef.current.setAttribute("directory", "");
  }, [isLocal]);

  const handleLocalFolderSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setLocalFolderFiles(files);
    const first = files[0] as (File & { webkitRelativePath?: string }) | undefined;
    if (!first) {
      setLocalFolderLabel(null);
      return;
    }
    const relative = first.webkitRelativePath || first.name;
    const folderName = relative.includes("/") ? relative.split("/")[0] : "Selected folder";
    setLocalFolderLabel(folderName);
  };

  const openFolder = async (folder: DriveFolder) => {
    setDriveParentId(folder.id);
    setDriveTrail((prev) => [...prev, { id: folder.id, name: folder.name }]);
    await loadDriveChildren(folder.id);
  };

  const goToCrumb = async (crumbIndex: number) => {
    const crumb = driveTrail[crumbIndex];
    setDriveTrail((prev) => prev.slice(0, crumbIndex + 1));
    setDriveParentId(crumb.id);
    await loadDriveChildren(crumb.id);
  };

  return (
    <div className="min-h-screen bg-[var(--void)] flex flex-col">
      {/* Grid background */}
      <div className="fixed inset-0 grid-pattern pointer-events-none" />

      <div className="relative mx-auto w-full max-w-3xl px-6 py-12 flex flex-col min-h-screen">
        {/* Header */}
        <header className="flex items-center justify-between mb-8 animate-fade-in-up">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="w-10 h-10 flex items-center justify-center bg-[var(--graphite)] border border-[var(--zinc)] hover:border-[var(--ash)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--smoke)]">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--smoke)]">
                Project Lens
              </div>
              <div className="text-lg font-medium text-[var(--pearl)]">
                New Project
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSetupMode("simple")}
              className={`px-2.5 py-1 text-xs border transition-colors ${
                setupMode === "simple"
                  ? "border-[var(--phosphor)]/60 bg-[var(--phosphor-glow)] text-[var(--phosphor)]"
                  : "border-[var(--zinc)] bg-[var(--graphite)] text-[var(--smoke)] hover:text-[var(--pearl)]"
              }`}
            >
              Simple
            </button>
            <button
              type="button"
              onClick={() => setSetupMode("pro")}
              className={`px-2.5 py-1 text-xs border transition-colors ${
                setupMode === "pro"
                  ? "border-[var(--phosphor)]/60 bg-[var(--phosphor-glow)] text-[var(--phosphor)]"
                  : "border-[var(--zinc)] bg-[var(--graphite)] text-[var(--smoke)] hover:text-[var(--pearl)]"
              }`}
            >
              Pro
            </button>
            <Badge variant="default">{setupMode === "simple" ? "Quick Setup" : "Pro Controls"}</Badge>
          </div>
        </header>

        {onboarding.user_profile && (
          <div className="mb-4 rounded-lg border border-[var(--glass-border)] bg-[var(--carbon)] px-4 py-3 animate-fade-in-up">
            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--smoke)] mb-1">
              Persistent Profile Context
            </div>
            <p className="text-sm text-[var(--silver)]">
              Role and team details from onboarding are carried into this wizard and used for project defaults.
            </p>
          </div>
        )}

        {/* Main form */}
        <div className="flex-1 space-y-4">
          {/* Project name */}
          <Panel
            className="animate-fade-in-up stagger-1"
            header={
              <PanelHeader
                title="Project Name"
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                }
              />
            }
          >
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q2 Launch Brief"
              className="
                w-full px-4 py-3
                bg-[var(--graphite)] border border-[var(--zinc)]
                text-[var(--pearl)] text-sm
                placeholder:text-[var(--ash)]
                focus:outline-none focus:border-[var(--phosphor)]/50 focus:ring-1 focus:ring-[var(--phosphor)]/20
                transition-all
              "
            />
          </Panel>

          {/* Connector */}
          <Panel
            className="animate-fade-in-up stagger-2"
            header={
              <PanelHeader
                title="Choose a Connector"
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                  </svg>
                }
              />
            }
          >
            <div className="grid grid-cols-2 gap-2">
              {connectors.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setConnector(c.id);
                    updateProjectSetupDefaults({ connector: c.id });
                  }}
                  className={`
                    p-3 text-left flex items-center gap-3 transition-all
                    ${connector === c.id
                      ? "bg-[var(--phosphor-glow)] border-2 border-[var(--phosphor)]"
                      : "bg-[var(--graphite)] border border-[var(--zinc)] hover:border-[var(--ash)]"
                    }
                  `}
                >
                  <span className="text-lg">{c.icon}</span>
                  <span className={`text-sm ${connector === c.id ? "text-[var(--white)]" : "text-[var(--pearl)]"}`}>
                    {c.name}
                  </span>
                </button>
              ))}
            </div>
          </Panel>

          {isLocal && (
            <Panel
              className="animate-fade-in-up"
              header={
                <PanelHeader
                  title="Local Folder (Finder)"
                  icon={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                    </svg>
                  }
                />
              }
            >
              <div className="space-y-3">
                <p className="text-xs text-[var(--smoke)]">
                  Pick a folder using Finder. We&apos;ll upload it with relative paths preserved.
                </p>
                <input
                  ref={localFolderInputRef}
                  type="file"
                  multiple
                  onChange={handleLocalFolderSelect}
                  className="hidden"
                  disabled={localUploading}
                />
                <Button
                  variant="secondary"
                  onClick={() => localFolderInputRef.current?.click()}
                  disabled={localUploading}
                >
                  Choose Folder in Finder
                </Button>

                {localFolderLabel && (
                  <div className="rounded border border-[var(--zinc)] bg-[var(--graphite)] px-3 py-2 text-sm text-[var(--pearl)]">
                    <div className="font-medium">{localFolderLabel}</div>
                    <div className="text-xs text-[var(--smoke)]">
                      {localFolderFiles.length} {localFolderFiles.length === 1 ? "file selected" : "files selected"}
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* Google Drive folder picker */}
          {isGDrive && (
            <Panel
              className="animate-fade-in-up"
              header={
                <PanelHeader
                  title="Pick a Folder"
                  icon={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                    </svg>
                  }
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadDriveChildren(driveParentId)}
                      disabled={driveLoading}
                      isLoading={driveLoading}
                    >
                      Refresh
                    </Button>
                  }
                />
              }
            >
              {/* Breadcrumb */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {driveTrail.map((crumb, idx) => (
                  <button
                    key={`${crumb.name}-${idx}`}
                    onClick={() => goToCrumb(idx)}
                    disabled={idx === driveTrail.length - 1 || driveLoading}
                    className={`
                      text-xs px-2 py-1 transition-colors
                      ${idx === driveTrail.length - 1
                        ? "text-[var(--pearl)]"
                        : "text-[var(--smoke)] hover:text-[var(--pearl)]"
                      }
                    `}
                  >
                    {crumb.name}
                    {idx < driveTrail.length - 1 && (
                      <span className="ml-2 text-[var(--zinc)]">/</span>
                    )}
                  </button>
                ))}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const nextFolder = {
                      id: driveParentId,
                      name: driveTrail[driveTrail.length - 1]?.name ?? "My Drive",
                    };
                    setSelectedFolder(nextFolder);
                    updateProjectSetupDefaults({
                      gdriveFolderId: nextFolder.id,
                      gdriveFolderName: nextFolder.name,
                    });
                    void loadDrivePreview(nextFolder.id);
                  }}
                  disabled={driveLoading}
                  className="ml-auto"
                >
                  Select This Folder
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadDrivePreview(selectedFolder?.id ?? driveParentId)}
                  disabled={driveLoading}
                  isLoading={drivePreviewLoading}
                >
                  Estimate Sync Scope
                </Button>
              </div>

              {/* Error */}
              {driveError && (
                <div className="mb-4 p-3 bg-[var(--coral-glow)] border border-[var(--coral)]/30 text-sm text-[var(--coral)]">
                  {driveError}
                </div>
              )}

              {/* Contents */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--smoke)] mb-2">
                    Folders
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-auto">
                    {driveFolders.length === 0 && !driveLoading && !driveError && (
                      <div className="py-6 text-center text-sm text-[var(--ash)]">
                        No subfolders
                      </div>
                    )}
                    {driveFolders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => openFolder(folder)}
                        disabled={driveLoading}
                        className="
                          flex items-center gap-2 p-3 text-left
                          bg-[var(--graphite)] border border-[var(--zinc)]
                          hover:border-[var(--ash)] transition-colors
                        "
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--amber)] flex-shrink-0">
                          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                        </svg>
                        <span className="text-sm text-[var(--pearl)] truncate">{folder.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--smoke)] mb-2">
                    Files
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-auto">
                    {driveFiles.length === 0 && !driveLoading && !driveError && (
                      <div className="py-6 text-center text-sm text-[var(--ash)]">
                        No files
                      </div>
                    )}
                    {driveFiles.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-2 p-3 bg-[var(--graphite)] border border-[var(--zinc)]"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--smoke)] flex-shrink-0">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                          <path d="M14 2v6h6" />
                        </svg>
                        <span className="text-sm text-[var(--pearl)] truncate" title={f.name}>
                          {f.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Selected folder display */}
              {selectedFolder && (
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <span className="text-[var(--smoke)]">Selected:</span>
                  <Badge variant="phosphor">{selectedFolder.name}</Badge>
                </div>
              )}

              {(drivePreview || drivePreviewError) && (
                <div className="mt-4 rounded-lg border border-[var(--zinc)] bg-[var(--graphite)] px-3 py-3">
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--smoke)] mb-2">
                    Sync Preview
                  </div>
                  {drivePreviewError ? (
                    <p className="text-sm text-[var(--coral)]">{drivePreviewError}</p>
                  ) : drivePreview ? (
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded border border-[var(--zinc)] bg-[var(--carbon)] px-2 py-2">
                        <div className="text-[var(--ash)] text-xs">Folders</div>
                        <div className="text-[var(--pearl)] font-medium">{drivePreview.folder_count}</div>
                      </div>
                      <div className="rounded border border-[var(--zinc)] bg-[var(--carbon)] px-2 py-2">
                        <div className="text-[var(--ash)] text-xs">Files to Sync</div>
                        <div className="text-[var(--pearl)] font-medium">{drivePreview.syncable_file_count}</div>
                      </div>
                      <div className="rounded border border-[var(--zinc)] bg-[var(--carbon)] px-2 py-2">
                        <div className="text-[var(--ash)] text-xs">Unsupported</div>
                        <div className="text-[var(--pearl)] font-medium">{drivePreview.unsupported_file_count}</div>
                      </div>
                    </div>
                  ) : null}
                  {drivePreview?.truncated && (
                    <p className="mt-2 text-xs text-[var(--smoke)]">
                      Preview capped for performance. Full sync may include more items.
                    </p>
                  )}
                </div>
              )}
            </Panel>
          )}

          {/* Goal */}
          <Panel
            className="animate-fade-in-up stagger-3"
            header={
              <PanelHeader
                title="Project Goal"
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                }
              />
            }
          >
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g., Build launch brief with evidence and risks"
              rows={3}
              className="
                w-full px-4 py-3
                bg-[var(--graphite)] border border-[var(--zinc)]
                text-[var(--pearl)] text-sm
                placeholder:text-[var(--ash)]
                resize-none
                focus:outline-none focus:border-[var(--phosphor)]/50 focus:ring-1 focus:ring-[var(--phosphor)]/20
                transition-all
              "
            />
          </Panel>

          {setupMode === "simple" && (
            <Panel
              className="animate-fade-in-up"
              header={
                <PanelHeader
                  title="Do It For Me"
                  icon={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.77 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                    </svg>
                  }
                />
              }
            >
              <div className="space-y-3">
                <p className="text-xs text-[var(--smoke)]">
                  Describe what you need this week. We will auto-create project, team, and starter tools.
                </p>
                <textarea
                  value={quickIntent}
                  onChange={(e) => setQuickIntent(e.target.value)}
                  rows={2}
                  placeholder="e.g., Build an executive-ready launch brief with risks and next actions."
                  className="
                    w-full px-4 py-3
                    bg-[var(--graphite)] border border-[var(--zinc)]
                    text-[var(--pearl)] text-sm
                    placeholder:text-[var(--ash)]
                    resize-none
                    focus:outline-none focus:border-[var(--phosphor)]/50 focus:ring-1 focus:ring-[var(--phosphor)]/20
                    transition-all
                  "
                />
                <div className="flex flex-wrap gap-2">
                  {STARTER_KITS.map((kit) => (
                    <button
                      key={kit.id}
                      type="button"
                      onClick={() => {
                        setQuickIntent(kit.goal);
                        setName(kit.projectName);
                        setGoal(kit.goal);
                        setSetupContext(kit.context);
                      }}
                      className="rounded border border-[var(--zinc)] bg-[var(--graphite)] px-2.5 py-1.5 text-xs text-[var(--smoke)] hover:border-[var(--phosphor)]/30 hover:text-[var(--pearl)]"
                    >
                      {kit.name}
                    </button>
                  ))}
                </div>
                <Button
                  variant="primary"
                  onClick={runDoItForMe}
                  isLoading={crewLoading || localUploading}
                  disabled={crewLoading || localUploading}
                >
                  Do It For Me
                </Button>
                {setupTimeline.length > 0 && (
                  <div className="rounded border border-[var(--zinc)] bg-[var(--graphite)] px-3 py-2">
                    <div className="mb-1 text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--ash)]">
                      AI Setup Timeline · ~20s
                    </div>
                    <div className="space-y-1">
                      {setupTimeline.map((step) => (
                        <div key={step.id} className="flex items-center gap-2 text-xs">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              step.status === "done"
                                ? "bg-[var(--phosphor)]"
                                : step.status === "active"
                                  ? "bg-[var(--amber)] animate-pulse"
                                  : "bg-[var(--zinc)]"
                            }`}
                          />
                          <span className={step.status === "pending" ? "text-[var(--ash)]" : "text-[var(--smoke)]"}>
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}

          <Panel
            className="animate-fade-in-up"
            header={
              <PanelHeader
                title="Project Context (Optional)"
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                }
              />
            }
          >
            <textarea
              value={setupContext}
              onChange={(e) => setSetupContext(e.target.value)}
              placeholder="Optional: constraints, must-haves, key stakeholders, or brand guardrails."
              rows={2}
              className="
                w-full px-4 py-3
                bg-[var(--graphite)] border border-[var(--zinc)]
                text-[var(--pearl)] text-sm
                placeholder:text-[var(--ash)]
                resize-none
                focus:outline-none focus:border-[var(--phosphor)]/50 focus:ring-1 focus:ring-[var(--phosphor)]/20
                transition-all
              "
            />
          </Panel>

          <Panel
            className="animate-fade-in-up stagger-4"
            header={
              <PanelHeader
                title="Doers (Builders) & Reviewers (Critics)"
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <path d="M20 8v6M23 11h-6" />
                  </svg>
                }
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={generatePersonalizedCrew}
                    isLoading={crewLoading}
                    disabled={crewLoading}
                  >
                    {crewGenerated ? "Regenerate" : "Personalize"}
                  </Button>
                }
              />
            }
          >
            {setupMode === "simple" ? (
              <div className="space-y-4">
                <p className="text-xs text-[var(--smoke)]">
                  One-click team setup. We auto-generate doers, reviewers, and starter tools from your goal + profile.
                </p>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <div className="rounded border border-[var(--zinc)] bg-[var(--graphite)] px-3 py-2">
                    <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--ash)]">Doers</div>
                    <div className="text-lg text-[var(--pearl)]">{activeDoersCount}</div>
                    <div className="text-[10px] text-[var(--smoke)] truncate">
                      {(doers.filter((d) => d.enabled).slice(0, 2).map((d) => d.name).join(", ")) || "Not configured"}
                    </div>
                  </div>
                  <div className="rounded border border-[var(--zinc)] bg-[var(--graphite)] px-3 py-2">
                    <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--ash)]">Reviewers</div>
                    <div className="text-lg text-[var(--pearl)]">{activeReviewersCount}</div>
                    <div className="text-[10px] text-[var(--smoke)] truncate">
                      {(reviewers.filter((r) => r.enabled).slice(0, 2).map((r) => r.name).join(", ")) || "Not configured"}
                    </div>
                  </div>
                  <div className="rounded border border-[var(--zinc)] bg-[var(--graphite)] px-3 py-2">
                    <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--ash)]">Tools</div>
                    <div className="text-lg text-[var(--pearl)]">{activeToolsCount}</div>
                    <div className="text-[10px] text-[var(--smoke)]">Across all active agents</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={generatePersonalizedCrew}
                    isLoading={crewLoading}
                    disabled={crewLoading}
                  >
                    {crewGenerated ? "Refresh Team + Tools" : "Generate Team + Tools"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSetupMode("pro")}
                  >
                    Open Pro Controls
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-[var(--smoke)]">
                  Doers build outcomes. Reviewers critique quality. In Cmd+K you can tag each identity with{" "}
                  <span className="font-mono">@id</span>, <span className="font-mono">@name_alias</span>, or{" "}
                  <span className="font-mono">@&#123;Display Name&#125;</span>.
                </p>

                <div>
                  <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--smoke)]">
                    Doers
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {doers.map((doer, index) => (
                      <div
                        key={doer.id}
                        className="animate-fade-in-up"
                        style={{ animationDelay: `${index * 70}ms` }}
                      >
                        <CrewIdentityCard
                          kind="doer"
                          member={doer}
                          onToggleEnabled={(enabled) =>
                            setDoers((prev) =>
                              prev.map((item) =>
                                item.id === doer.id ? { ...item, enabled } : item
                              )
                            )
                          }
                          onEdit={() =>
                            setEditingCrew({
                              kind: "doer",
                              previousId: doer.id,
                              index,
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--smoke)]">
                    Reviewers
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {reviewers.map((reviewer, index) => (
                      <div
                        key={reviewer.id}
                        className="animate-fade-in-up"
                        style={{ animationDelay: `${index * 70}ms` }}
                      >
                        <CrewIdentityCard
                          kind="reviewer"
                          member={reviewer}
                          onToggleEnabled={(enabled) =>
                            setReviewers((prev) =>
                              prev.map((item) =>
                                item.id === reviewer.id ? { ...item, enabled } : item
                              )
                            )
                          }
                          onEdit={() =>
                            setEditingCrew({
                              kind: "reviewer",
                              previousId: reviewer.id,
                              index,
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between mt-6 pt-6 border-t border-[var(--glass-border)] animate-fade-in-up stagger-4">
          <Button variant="ghost" onClick={() => router.push("/")}>
            Cancel
          </Button>
          <Button variant="primary" onClick={create} disabled={!canCreate || localUploading} isLoading={localUploading}>
            {localUploading ? "Importing Folder..." : "Create Project"}
          </Button>
        </footer>
      </div>

      <CrewIdentityEditorModal
        isOpen={Boolean(editingCrew)}
        kind={editingCrew?.kind || "doer"}
        member={editingMember}
        onClose={() => setEditingCrew(null)}
        onSave={saveEditedCrewIdentity}
      />
    </div>
  );
}
